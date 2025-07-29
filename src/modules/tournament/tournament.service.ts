// src/modules/tournament/tournament.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BattleRound, Tournament } from './entities/tournament.entity';
import { Community } from 'src/modules/community/entities/community.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { User } from '../auth/entities/user.entity';
import { UsersService } from '../auth/auth.service';
import { differenceInDays } from 'date-fns';
import { isBefore, isAfter } from 'date-fns';
import { Battle } from '../battle/entities/battle.entity';
@Injectable()
export class TournamentService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepo: Repository<Tournament>,
    @InjectRepository(Battle)
    private readonly battleRepo: Repository<Battle>,

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
      TournamentRewards: dto.TournamentRewards,
      imageUrl: dto.imageUrl,
      rounds: dto.rounds,
      registrationDeadline: dto.registrationDeadline,
      maxParticipants: dto.maxParticipants,
      community,
      createdBy: user,
    });

    return this.tournamentRepo.save(tournament);
  }

  async findAll(): Promise<Tournament[]> {
    return this.tournamentRepo.find({ relations: ['community', 'createdBy'] });
  }

  async findOne(id: number): Promise<any> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id },
      relations: ['community', 'participants'],
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

    const totalRounds = roundsWithDetails.length;
    const completedRounds = roundsWithDetails.filter(
      (r) => r.status === 'completed',
    ).length;
    const pendingRounds = roundsWithDetails.filter(
      (r) => r.status === 'upcoming',
    ).length;

    // get participant count
    const participantCount = tournament.participants.length;

    return {
      ...tournament,
      rounds: roundsWithDetails,
      progress: {
        totalRounds,
        completedRounds,
        pendingRounds,
      },
      participantCount,
    };
  }

  async getJoinedTournaments(userId: number): Promise<Tournament[]> {
    return this.tournamentRepo
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.participants', 'participant')
      .leftJoinAndSelect('tournament.community', 'community')
      .leftJoinAndSelect('tournament.createdBy', 'createdBy')
      .where('participant.id = :userId', { userId })
      .getMany();
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
      TournamentRewards: dto.TournamentRewards ?? tournament.TournamentRewards,
      imageUrl: dto.imageUrl ?? tournament.imageUrl,
      rounds: dto.rounds ?? tournament.rounds,
      registrationDeadline:
        dto.registrationDeadline ?? tournament.registrationDeadline,
      maxParticipants: dto.maxParticipants ?? tournament.maxParticipants,
    });

    return this.tournamentRepo.save(tournament);
  }

  async remove(id: number, user: User): Promise<void> {
    const tournament = await this.findOne(id);

    const isOwner = tournament.createdBy?.id === user?.id;
    const isAdmin = user?.role === 'Admin';

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

    // Registration deadline check
    const now = new Date();
    if (
      tournament.registrationDeadline &&
      now > new Date(tournament.registrationDeadline)
    ) {
      throw new BadRequestException(
        'Registration for this tournament has closed.',
      );
    }

    // Access validation
    if (tournament.accessType === 'restricted') {
      const criteria = tournament.accessCriteria;

      const youtubeData =
        await this.authService.fetchYouTubeChannelData(youtubeAccessToken);
      if (!youtubeData) {
        throw new BadRequestException(
          'Unable to fetch YouTube data. Please reconnect your account.',
        );
      }

      const subscribers = parseInt(youtubeData.subscribers, 10);
      const arenaPoints = user.arenaPoints ?? 0;
      const elo = user.elo ?? 0;

      if (criteria?.minSubscribers && subscribers < criteria.minSubscribers) {
        throw new BadRequestException(
          `You need at least ${criteria.minSubscribers} subscribers.`,
        );
      }
      if (criteria?.minArenaPoints && arenaPoints < criteria.minArenaPoints) {
        throw new BadRequestException(
          `You need at least ${criteria.minArenaPoints} arena points.`,
        );
      }
      if (criteria?.minElo && elo < criteria.minElo) {
        throw new BadRequestException(
          `You need at least ${criteria.minElo} ELO rating.`,
        );
      }
    }

    if (tournament.accessType === 'invite-only') {
      throw new ForbiddenException(
        'This is an invite-only tournament. You cannot join directly.',
      );
    }

    const alreadyJoined = tournament.participants.some((p) => p.id === user.id);
    if (alreadyJoined) {
      return 'You have already joined this tournament!';
    }

    tournament.participants.push(user);
    await this.tournamentRepo.save(tournament);

    return 'You have successfully joined the tournament!';
  }

  // src/modules/tournament/tournament.service.ts

  async getUserDashboard(tournamentId: number, userId: number): Promise<any> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
      relations: ['participants', 'createdBy'],
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const battles = await this.battleRepo.find({
      where: { tournament: { id: tournamentId } },
      relations: [
        'thumbnailA',
        'thumbnailB',
        'thumbnailA.creator',
        'thumbnailB.creator',
        'winnerUser',
      ],
    });

    const userBattles = battles.filter(
      (b) =>
        b.thumbnailA.creator.id === userId ||
        b.thumbnailB.creator.id === userId,
    );

    let currentBattleInfo: {
      title: string;
      description: string;
      deadline: string | null;
      opponent: string;
      status: string;
    } | null = null;

    const currentBattle = userBattles.find((b) => !b.winnerUser);

    if (currentBattle) {
      const roundInfo = tournament.rounds?.find(
        (r) => r.roundNumber === currentBattle.roundNumber,
      );

      const deadline = roundInfo
        ? new Date(roundInfo.roundEndDate).toLocaleString()
        : null;

      currentBattleInfo = {
        title: `Battle #${currentBattle.roundNumber}`,
        description: roundInfo?.description || 'Tournament battle in progress',
        deadline,
        opponent:
          currentBattle.thumbnailA.creator.id === userId
            ? currentBattle.thumbnailB.creator.username ||
              currentBattle.thumbnailB.creator.name
            : currentBattle.thumbnailA.creator.username ||
              currentBattle.thumbnailA.creator.name,
        status: 'active',
      };
    }

    // User stats
    const wins = userBattles.filter((b) => b.winnerUser?.id === userId).length;
    const losses = userBattles.filter(
      (b) =>
        b.winnerUser &&
        b.winnerUser.id !== userId &&
        (b.thumbnailA.creator.id === userId ||
          b.thumbnailB.creator.id === userId),
    ).length;
    const totalBattles = userBattles.length;
    const winRate =
      totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;

    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    const userStats = {
      rank: null, // Can be calculated based on ELO if needed
      wins,
      losses,
      winRate,
      arenaPoints: user.arenaPoints,
      battlesCompleted: wins + losses,
      totalBattles,
    };

    // Leaderboard
    const participantIds = tournament.participants.map((p) => p.id);

    const leaderboardUsers = await this.userRepo.find({
      where: { id: In(participantIds) },
      order: { arenaPoints: 'DESC' },
      take: 20,
    });

    const leaderboard = leaderboardUsers.map((u, index) => ({
      rank: index + 1,
      username: u.username || u.name,
      avatar: ':avatar:', // TODO: Replace with actual avatar
      wins: battles.filter((b) => b.winnerUser?.id === u.id).length,
      losses: battles.filter(
        (b) =>
          b.winnerUser &&
          b.winnerUser.id !== u.id &&
          (b.thumbnailA.creator.id === u.id ||
            b.thumbnailB.creator.id === u.id),
      ).length,
      score: u.arenaPoints,
      isCurrentUser: u.id === userId,
    }));

    // Upcoming battles
    const upcomingBattles = userBattles
      .filter((b) => !b.winnerUser)
      .map((b) => ({
        round: b.roundNumber,
        opponent:
          b.thumbnailA.creator.id === userId
            ? b.thumbnailB.creator.username || b.thumbnailB.creator.name
            : b.thumbnailA.creator.username || b.thumbnailA.creator.name,
        date: b.createdAt.toDateString(),
        status: 'active',
      }));

    return {
      currentBattle: currentBattleInfo,
      userStats,
      leaderboard,
      upcomingBattles,
    };
  }
}
