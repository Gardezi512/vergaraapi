import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
        private readonly jwtService: JwtService,
    ) { }

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

            if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
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
            throw new InternalServerErrorException('Login failed. Please try again later.');
        }
    }


    async fetchYouTubeChannelData(accessToken: string) {
        console.log('[YouTube] Fetching channel data with access token...');

        try {
            const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                params: {
                    part: 'snippet,statistics',
                    mine: true,
                },
            });

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
    }: {
        idToken: string;
        accessToken: string;
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

        let user = await this.usersRepo.findOne({ where: { email } });

        if (!user) {
            console.log('[Google Login] No existing user found. Creating new user...');
            user = this.usersRepo.create({ email, name });
            await this.usersRepo.save(user);
            console.log('[Google Login] New user saved:', user);
        } else {
            console.log('[Google Login] Existing user found:', user);
        }

        const jwtToken = this.jwtService.sign({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        console.log('[Google Login] JWT access token generated:', jwtToken);

        const youtubeData = await this.fetchYouTubeChannelData(accessToken); // ✅ access token used here

        if (youtubeData) {
            console.log('[Google Login] YouTube data:', youtubeData);
        } else {
            console.log('[Google Login] YouTube data not available or failed to fetch');
        }

        return {
            status: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
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

}
