// src/modules/tournament/tournament.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import { Community } from 'src/modules/community/entities/community.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { User } from '../auth/entities/user.entity';
import { UsersService } from '../auth/auth.service';

@Injectable()
export class TournamentService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepo: Repository<Tournament>,

    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authService: UsersService,
  ) {}

  // tournament.service.ts
  async create(dto: CreateTournamentDto, user: User): Promise<Tournament> {
    const community = await this.communityRepo.findOne({
      where: { id: dto.communityId },
    });
    if (!community) throw new NotFoundException('Community not found');

    const tournament = this.tournamentRepo.create({
      title: dto.title,
      description: dto.description,
      startDate: dto.startDate,
      endDate: dto.endDate,
      format: dto.format || '1v1',
      structure: dto.structure || 'single-elimination',
      category: dto.category,
      subcategory: dto.subcategory,
      accessType: dto.accessType || 'public',
      accessCriteria: dto.accessCriteria,
      rewards: dto.rewards,
      imageUrl: dto.imageUrl,
      rounds: dto.rounds,
      community,
      createdBy: user,
    });

    return this.tournamentRepo.save(tournament);
  }

  async findAll(): Promise<Tournament[]> {
    return this.tournamentRepo.find({ relations: ['community'] });
  }

  async findOne(id: number): Promise<Tournament> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id },
      relations: ['community'],
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return tournament;
  }

  async update(
    id: number,
    dto: UpdateTournamentDto,
    user: User,
  ): Promise<Tournament> {
    const tournament = await this.findOne(id);

    const isOwner = tournament.createdBy.id === user.id;
    const isAdmin = user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to update this tournament.',
      );
    }

    Object.assign(tournament, {
      title: dto.title ?? tournament.title,
      description: dto.description ?? tournament.description,
      startDate: dto.startDate ?? tournament.startDate,
      endDate: dto.endDate ?? tournament.endDate,
      format: dto.format ?? tournament.format,
      structure: dto.structure ?? tournament.structure,
      category: dto.category ?? tournament.category,
      subcategory: dto.subcategory ?? tournament.subcategory,
      accessType: dto.accessType ?? tournament.accessType,
      accessCriteria: dto.accessCriteria ?? tournament.accessCriteria,
      rewards: dto.rewards ?? tournament.rewards,
      imageUrl: dto.imageUrl ?? tournament.imageUrl,
      rounds: dto.rounds ?? tournament.rounds,
    });

    return this.tournamentRepo.save(tournament);
  }

  async remove(id: number, user: User): Promise<void> {
    const tournament = await this.findOne(id);

    const isOwner = tournament.createdBy.id === user.id;
    const isAdmin = user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to delete this tournament.',
      );
    }

    await this.tournamentRepo.remove(tournament);
  }
  async joinTournament(
    tournamentId: number,
    user: User,
    youtubeAccessToken: string, // required to call YouTube API
  ): Promise<string> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const minSubs = tournament.accessCriteria?.minSubscribers;

    if (minSubs) {
      const youtubeData =
        await this.authService.fetchYouTubeChannelData(youtubeAccessToken);
      if (!youtubeData) {
        throw new BadRequestException(
          'Unable to fetch YouTube data. Please reconnect your account.',
        );
      }
      const subscribers = parseInt(youtubeData.subscribers, 10);
      if (isNaN(subscribers)) {
        throw new BadRequestException(
          'Could not determine your subscriber count.',
        );
      }
      if (subscribers < minSubs) {
        throw new BadRequestException(
          `You need at least ${minSubs} subscribers to join this tournament.`,
        );
      }
    }

    // ✅ Here add the user to your participant list (if you have a join table)
    // For now, just return success
    return `You have successfully joined the tournament!`;
  }
}
