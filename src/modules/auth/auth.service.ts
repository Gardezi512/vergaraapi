import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { instanceToPlain } from 'class-transformer';
import { LoginUserDto } from './dto/auth-login-dto';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { YouTubeProfile } from '../youtubeprofile/entities/youtube.profile.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
    @InjectRepository(YouTubeProfile)
    private readonly youtubeProfileRepo: Repository<YouTubeProfile>,
  ) {}

  async create(data: CreateUserDto): Promise<User> {
    let userData = { ...data };

    try {
      if (data.password) {
        const hashed = await bcrypt.hash(data.password, 10);
        userData = { ...data, password: hashed };
      }

      const user = this.usersRepo.create(userData);
      return await this.usersRepo.save(user);
    } catch (error) {
      // Handle unique constraint violation (e.g., email already exists)
      if (error.code === '23505') {
        throw new BadRequestException('Email is already in use');
      }

      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async login(loginDto: LoginUserDto) {
    const { email, password } = loginDto;

    try {
      const user = await this.usersRepo.findOne({ where: { email } });

      if (
        !user ||
        !user.password ||
        !(await bcrypt.compare(password, user.password))
      ) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const payload = { id: user.id, email: user.email, role: user.role };
      const token = this.jwtService.sign(payload);

      const { password: _, ...userWithoutPassword } = instanceToPlain(user);

      return {
        status: true,
        data: {
          ...userWithoutPassword,
          arenaPoints: user.arenaPoints,
          accessToken: token,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException(
        'Login failed. Please try again later.',
      );
    }
  }

  async fetchYouTubeChannelData(accessToken: string) {
    console.log('[YouTube] Fetching channel data with access token...');

    try {
      const res = await axios.get(
        'https://www.googleapis.com/youtube/v3/channels',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            part: 'snippet,statistics',
            mine: true,
          },
        },
      );

      const channel = res.data.items[0];

      const youtubeInfo = {
        channelName: channel.snippet.title,
        subscribers: channel.statistics.subscriberCount,
        totalViews: channel.statistics.viewCount,
        thumbnail: channel.snippet.thumbnails?.default?.url,
      };

      console.log('[YouTube] Channel data fetched successfully:', youtubeInfo);
      return youtubeInfo;
    } catch (err) {
      console.error('[YouTube API ERROR]', err?.response?.data || err.message);
      return null;
    }
  }

  async loginOrCreateWithNextAuth({
    idToken,
    accessToken,
    refreshToken,
  }: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
  }) {
    console.log('[Google Login] Verifying token...');

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    let ticket;

    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      console.error('[Google Login] Token verification failed:', err.message);
      throw new UnauthorizedException('Invalid Google token');
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.name) {
      console.error('[Google Login] Missing email or name in token payload');
      throw new UnauthorizedException('Invalid Google user data');
    }

    const { email, name } = payload;
    console.log('[Google Login] User info from token:', { email, name });

    // First: Try to fetch YouTube data
    let youtubeData = await this.fetchYouTubeChannelData(accessToken);

    // If token failed and refreshToken available, try to refresh
    if (!youtubeData && refreshToken) {
      console.log('[Google Login] Trying token refresh...');
      try {
        const newAccessToken =
          await this.refreshYouTubeAccessToken(refreshToken);
        youtubeData = await this.fetchYouTubeChannelData(newAccessToken);
        accessToken = newAccessToken;
      } catch (e) {
        console.warn('[Google Login] Token refresh failed');
      }
    }

    //  Block if still no channel data
    if (!youtubeData) {
      throw new ForbiddenException(
        'No YouTube channel found for this Google account. Please connect a valid YouTube account.',
      );
    }

    // Only now: proceed to save user + YouTubeProfile
    let user = await this.usersRepo.findOne({
      where: { email },
      relations: ['youtubeProfile'],
    });

    if (!user) {
      console.log('[Google Login] Creating new user...');
      user = this.usersRepo.create({ email, name });
      await this.usersRepo.save(user);
    }

    let profile = user.youtubeProfile;

    if (!profile) {
      profile = this.youtubeProfileRepo.create({
        user,
      });
    }

    profile.accessToken = accessToken;
    if (refreshToken) profile.refreshToken = refreshToken;

    profile.channelName = youtubeData.channelName;
    profile.thumbnail = youtubeData.thumbnail;
    profile.subscribers = parseInt(youtubeData.subscribers, 10) || 0;
    profile.totalViews = parseInt(youtubeData.totalViews, 10) || 0;

    await this.youtubeProfileRepo.save(profile);

    const jwtToken = this.jwtService.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      status: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        arenaPoints: user.arenaPoints,
        accessToken: jwtToken,
        youtube: youtubeData,
      },
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async update(id: number, data: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const updated = Object.assign(user, data);
    return this.usersRepo.save(updated);
  }

  async remove(id: number): Promise<{ message: string }> {
    const user = await this.findOne(id);
    await this.usersRepo.remove(user);
    return { message: `User with ID ${id} deleted successfully` };
  }
  async refreshYouTubeAccessToken(refreshToken: string): Promise<string> {
    try {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await axios.post(
        'https://oauth2.googleapis.com/token',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const newAccessToken = response.data.access_token;
      console.log('[YouTube] Access token refreshed successfully.');
      return newAccessToken;
    } catch (error) {
      console.error(
        '[YouTube] Failed to refresh access token:',
        error?.response?.data || error.message,
      );
      throw new UnauthorizedException('Could not refresh access token');
    }
  }

  async getLiveYouTubeStats(user: User): Promise<YouTubeProfile> {
    const profile = await this.youtubeProfileRepo.findOneOrFail({
      where: { user: { id: user.id } },
    });

    if (!profile.accessToken) {
      throw new UnauthorizedException('No YouTube access token available.');
    }

    let data = await this.fetchYouTubeChannelData(profile.accessToken);

    if (!data) {
      if (!profile.refreshToken) {
        throw new UnauthorizedException(
          'YouTube access token expired and no refresh token available.',
        );
      }

      const newAccessToken = await this.refreshYouTubeAccessToken(
        profile.refreshToken,
      );
      profile.accessToken = newAccessToken;

      data = await this.fetchYouTubeChannelData(newAccessToken);
    }

    if (data) {
      profile.channelName = data.channelName;
      profile.thumbnail = data.thumbnail;
      profile.subscribers = parseInt(data.subscribers, 10) || 0;
      profile.totalViews = parseInt(data.totalViews, 10) || 0;
      await this.youtubeProfileRepo.save(profile);
    }

    return profile;
  }
}
