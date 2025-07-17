// src/modules/tournament/tournament.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BattleRound, Tournament } from './entities/tournament.entity';
import { Community } from 'src/modules/community/entities/community.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { User } from '../auth/entities/user.entity';
import { UsersService } from '../auth/auth.service';
import { differenceInDays } from 'date-fns';
import { isBefore, isAfter } from 'date-fns';

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

  private validateRounds(
    rounds: BattleRound[] | undefined,
    tournamentStart: Date,
    tournamentEnd: Date,
  ) {
    if (!rounds?.length) return;

    // every round inside tournament window
    rounds.forEach((r, idx) => {
      if (
        isBefore(r.roundStartDate, tournamentStart) ||
        isAfter(r.roundEndDate, tournamentEnd)
      ) {
        throw new BadRequestException(
          `Round #${idx + 1} dates must be between tournament start & end.`,
        );
      }
      if (isAfter(r.roundStartDate, r.roundEndDate)) {
        throw new BadRequestException(
          `Round #${idx + 1} start date must be ≤ end date.`,
        );
      }
    });

    // no overlaps - sort by start, then compare neighbours
    const sorted = [...rounds].sort(
      (a, b) => +new Date(a.roundStartDate) - +new Date(b.roundStartDate),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      if (
        isBefore(sorted[i + 1].roundStartDate, sorted[i].roundEndDate) ||
        +sorted[i + 1].roundStartDate === +sorted[i].roundStartDate
      ) {
        throw new BadRequestException(
          `Round #${sorted[i].roundNumber} date overlaps with Round #${sorted[i + 1].roundNumber}.`,
        );
      }
    }
  }
  async create(dto: CreateTournamentDto, user: User): Promise<Tournament> {
    const community = await this.communityRepo.findOne({
      where: { id: dto.communityId },
    });
    if (!community) throw new NotFoundException('Community not found');
    this.validateRounds(dto.rounds, dto.startDate, dto.endDate);

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

  async findOne(id: number): Promise<any> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id },
      relations: ['community'],
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const now = new Date();

    const roundsWithDetails =
      tournament.rounds?.map((round) => {
        const start = new Date(round.roundStartDate);
        const end = new Date(round.roundEndDate);

        let status: 'upcoming' | 'active' | 'completed';

        if (isBefore(now, start)) {
          status = 'upcoming';
        } else if (isAfter(now, end)) {
          status = 'completed';
        } else {
          status = 'active';
        }

        return {
          ...round,
          durationDays: differenceInDays(end, start),
          status,
        };
      }) || [];

    // calculate progress summary
    const totalRounds = roundsWithDetails.length;
    const completedRounds = roundsWithDetails.filter(
      (r) => r.status === 'completed',
    ).length;
    const pendingRounds = roundsWithDetails.filter(
      (r) => r.status === 'upcoming',
    ).length;

    return {
      ...tournament,
      rounds: roundsWithDetails,
      progress: {
        totalRounds,
        completedRounds,
        pendingRounds,
      },
    };
  }

  async update(
    id: number,
    dto: UpdateTournamentDto,
    user: User,
  ): Promise<Tournament> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id },
      relations: ['community', 'createdBy'],
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const isOwner = tournament.createdBy?.id === user.id;
    const isAdmin = user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to update this tournament.',
      );
    }
    const newStart = dto.startDate ?? tournament.startDate;
    const newEnd = dto.endDate ?? tournament.endDate;
    const newRounds = dto.rounds ?? tournament.rounds;

    this.validateRounds(newRounds, newStart, newEnd);

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
    youtubeAccessToken: string,
  ): Promise<string> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
      relations: ['participants'],
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

    const alreadyJoined = tournament.participants.some((p) => p.id === user.id);
    if (alreadyJoined) {
      return 'You have already joined this tournament!';
    }

    tournament.participants.push(user);
    await this.tournamentRepo.save(tournament);

    return 'You have successfully joined the tournament!';
  }
}
