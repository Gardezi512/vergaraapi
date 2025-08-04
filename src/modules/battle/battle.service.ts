import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Battle } from './entities/battle.entity';
import { CreateBattleDto } from './dto/create-battle.dto';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import { Vote } from '../vote/entities/vote.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { shuffle } from 'lodash';
import { VoteService } from '../vote/vote.service';

@Injectable()
export class BattleService {
  constructor(
    @InjectRepository(Battle)
    private readonly battleRepo: Repository<Battle>,

    @InjectRepository(Thumbnail)
    private readonly thumbnailRepo: Repository<Thumbnail>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    private readonly voteService: VoteService, // ✅ Inject this
  ) {}

  async create(dto: CreateBattleDto, user: User): Promise<Battle> {
    const thumbnailA = await this.thumbnailRepo.findOne({
      where: { id: dto.thumbnailAId },
      relations: ['creator'],
    });
    const thumbnailB = await this.thumbnailRepo.findOne({
      where: { id: dto.thumbnailBId },
      relations: ['creator'],
    });

    if (!thumbnailA || !thumbnailB) {
      throw new NotFoundException('One or both thumbnails not found');
    }

    const tournament = await this.battleRepo.manager
      .getRepository(Tournament)
      .findOne({
        where: { id: dto.tournamentId },
      });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const round = tournament.rounds?.find(
      (r) => r.roundNumber === dto.roundNumber,
    );
    if (!round) {
      throw new BadRequestException(
        `Round #${dto.roundNumber} not found in this tournament.`,
      );
    }

    const now = new Date();
    if (
      now < new Date(round.roundStartDate) ||
      now > new Date(round.roundEndDate)
    ) {
      throw new BadRequestException(
        `Round #${dto.roundNumber} is not active right now.`,
      );
    }

    const battle = this.battleRepo.create({
      thumbnailA,
      thumbnailB,
      tournament,
      roundNumber: dto.roundNumber,
      createdBy: user,
    });

    return this.battleRepo.save(battle);
  }

  private calculateElo(
    winnerElo: number,
    loserElo: number,
    winnerCount: number,
    loserCount: number,
  ) {
    const expectedA = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

    const kA = winnerCount < 10 ? 40 : winnerCount < 20 ? 20 : 10;
    const kB = loserCount < 10 ? 40 : loserCount < 20 ? 20 : 10;

    const newWinnerElo = Math.round(winnerElo + kA * (1 - expectedA));
    const newLoserElo = Math.round(loserElo + kB * (0 - expectedB));

    return { newWinnerElo, newLoserElo };
  }
  async resolveWinnerFromVotes(battleId: number): Promise<any> {
    const battle = await this.battleRepo.findOne({
      where: { id: battleId },
      relations: [
        'thumbnailA',
        'thumbnailB',
        'thumbnailA.creator',
        'thumbnailB.creator',
      ],
    });

    if (!battle) throw new NotFoundException('Battle not found');
    if (battle.winnerUser) {
      throw new BadRequestException('Battle already resolved.');
    }

    const votes = await this.voteRepo.find({
      where: { battle: { id: battleId } },
    });

    const voteCount: Record<number, number> = {};

    for (const vote of votes) {
      const userId = vote.votedFor.id;
      voteCount[userId] = (voteCount[userId] || 0) + 1;
    }

    const aVotes = voteCount[battle.thumbnailA.creator.id] || 0;
    const bVotes = voteCount[battle.thumbnailB.creator.id] || 0;

    if (aVotes === bVotes) {
      throw new BadRequestException('Cannot resolve winner: it’s a tie');
    }

    const winnerThumb = aVotes > bVotes ? battle.thumbnailA : battle.thumbnailB;
    const loserThumb = aVotes > bVotes ? battle.thumbnailB : battle.thumbnailA;

    // Calculate new ELOs
    const updated = this.calculateElo(
      winnerThumb.eloRating,
      loserThumb.eloRating,
      winnerThumb.battleCount,
      loserThumb.battleCount,
    );

    winnerThumb.eloRating = updated.newWinnerElo;
    loserThumb.eloRating = updated.newLoserElo;

    winnerThumb.battleCount++;
    loserThumb.battleCount++;
    winnerThumb.winCount++;
    loserThumb.lossCount++;

    // Arena Points
    winnerThumb.creator.arenaPoints += 10;
    loserThumb.creator.arenaPoints += 5;

    // Save thumbnails and users
    await this.thumbnailRepo.save([winnerThumb, loserThumb]);
    await this.userRepo.save([winnerThumb.creator, loserThumb.creator]);

    // Save resolved winner
    battle.winnerUser = winnerThumb.creator;
    await this.battleRepo.save(battle);

    return {
      battleId: battle.id,
      voteCount,
      winner: {
        userId: winnerThumb.creator.id,
        username: winnerThumb.creator.username,
        thumbnailId: winnerThumb.id,
        eloRating: winnerThumb.eloRating,
        arenaPoints: winnerThumb.creator.arenaPoints,
      },
      loser: {
        userId: loserThumb.creator.id,
        username: loserThumb.creator.username,
        thumbnailId: loserThumb.id,
        eloRating: loserThumb.eloRating,
        arenaPoints: loserThumb.creator.arenaPoints,
      },
      message: `Winner is ${winnerThumb.creator.username}`,
    };
  }

  async generateRandomBattlesForRound(
    tournamentId: number,
    roundNumber: number,
    createdBy: User,
  ): Promise<Battle[]> {
   console.log(`🌀 Tournament ID: ${tournamentId}`);
    console.log(`🏁 Generating battles for round: ${roundNumber}`);

    const tournament = await this.battleRepo.manager
      .getRepository(Tournament)
      .findOne({
        where: { id: tournamentId },
        relations: ['participants'],
      });

    if (!tournament) throw new NotFoundException('Tournament not found');

   console.log(`📦 Rounds from tournament: ${JSON.stringify(tournament.rounds)}`);

    const round = tournament.rounds?.find(r => r.roundNumber === roundNumber);
    if (!round) throw new NotFoundException(`Round #${roundNumber} not found`);

    console.log(`✅ Active Round Info: ${JSON.stringify(round)}`);

    const now = new Date();
    if (now < new Date(round.roundStartDate)) {
      throw new BadRequestException('This round has not started yet.');
    }
    if (now > new Date(round.roundEndDate)) {
      throw new BadRequestException('This round has already ended.');
    }

    const existingBattles = await this.battleRepo.find({
      where: { tournament: { id: tournamentId }, roundNumber },
    });
    if (existingBattles.length > 0) {
      throw new BadRequestException(`Battles for round #${roundNumber} already exist.`);
    }

    // Fetch valid thumbnails of current participants
    const participantIds = tournament.participants.map((p) => p.id);

    const thumbnails = await this.thumbnailRepo.find({
      where: {
        tournament: { id: tournamentId },
        creator: { id: In(participantIds) },
      },
      relations: ['creator'],
    });

    console.log(`🎯 Found ${thumbnails.length} thumbnails for round pairing.`);

    if (thumbnails.length < 2) {
      throw new BadRequestException(
        'Not enough thumbnails submitted to generate battles (minimum 2 required).',
      );
    }

    const shuffled = shuffle(thumbnails);

    if (shuffled.length % 2 !== 0) {
      const excluded = shuffled.pop();
     console.log(
        `⚠️ Thumbnail from user ${excluded.creator.id} excluded due to unpaired count.`,
      );
    }

    const battlesToCreate: Battle[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const thumbnailA = shuffled[i];
      const thumbnailB = shuffled[i + 1];

      console.log(
        `📊 Pairing battle: ${thumbnailA.creator.username} vs ${thumbnailB.creator.username}`,
      );

      const battle = this.battleRepo.create({
        thumbnailA,
        thumbnailB,
        tournament,
        roundNumber,
        createdBy,
      });

      battlesToCreate.push(battle);
    }

    console.log(`💾 Saving ${battlesToCreate.length} battles to DB...`);

    return this.battleRepo.save(battlesToCreate);
  }

  async getWinnersOfRound(
    tournamentId: number,
    roundNumber: number,
  ): Promise<{ thumbnail: Thumbnail; user: User }[]> {
    const battles = await this.battleRepo.find({
      where: {
        tournament: { id: tournamentId },
        roundNumber,
      },
      relations: [
        'thumbnailA',
        'thumbnailB',
        'thumbnailA.creator',
        'thumbnailB.creator',
        'winnerUser',
      ],
    });

    const winners: { thumbnail: Thumbnail; user: User }[] = [];

    for (const battle of battles) {
      if (!battle.winnerUser) continue;

      const winningThumb =
        battle.thumbnailA.creator.id === battle.winnerUser.id
          ? battle.thumbnailA
          : battle.thumbnailB;

      winners.push({
        thumbnail: winningThumb,
        user: winningThumb.creator,
      });
    }

    return winners;
  }

  async generateNextRoundBattles(
    tournamentId: number,
    currentRound: number,
    createdBy: User,
  ): Promise<Battle[]> {
    const tournament = await this.battleRepo.manager
      .getRepository(Tournament)
      .findOne({
        where: { id: tournamentId },
      });

    if (!tournament) throw new NotFoundException('Tournament not found');

    const nextRound = tournament.rounds?.find(
      (r) => r.roundNumber === currentRound + 1,
    );
    if (!nextRound) throw new BadRequestException('Next round not found');

    const winners = await this.getWinnersOfRound(tournamentId, currentRound);

    if (winners.length < 2) {
      throw new BadRequestException(
        'Not enough winners to generate next round battles.',
      );
    }

    const shuffled = shuffle(winners);

    if (shuffled.length % 2 !== 0) {
      const excluded = shuffled.pop();
      console.warn(`Thumbnail ${excluded?.id} excluded due to unpaired count.`);
    }

    const battlesToCreate: Battle[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const thumbnailA = shuffled[i];
      const thumbnailB = shuffled[i + 1];

      const battle = this.battleRepo.create({
        thumbnailA,
        thumbnailB,
        tournament,
        roundNumber: currentRound + 1,
        createdBy,
      });

      battlesToCreate.push(battle);
    }

    return this.battleRepo.save(battlesToCreate);
  }
 
  async calculateWinRates(battle: Battle): Promise<Record<number, number>> {
    const rates: Record<number, number> = {};
    const thumbs = [battle.thumbnailA, battle.thumbnailB];
  
    for (const t of thumbs) {
      const total = t.battleCount;
      const wins = t.winCount;
      rates[t.id] = total === 0 ? 0 : Math.round((wins / total) * 100);
    }
  
    return rates;
  }
  
  async getArenaPoints(thumbnailIds: number[]) {
    const thumbs = await this.thumbnailRepo.find({
      where: { id: In(thumbnailIds) },
      relations: ['creator'],
    });
  
    const map: Record<number, number> = {};
    for (const t of thumbs) {
      map[t.id] = t.creator.arenaPoints || 0;
    }
  
    return map;
  }
  
  async getAllBattles() {
    const battles = await this.battleRepo.find({
      relations: {
        thumbnailA: { creator: { youtubeProfile: true } },
        thumbnailB: { creator: { youtubeProfile: true } },
        tournament: true,
      },
      order: { createdAt: 'ASC' },
    });
  
    const enrichedBattles: any[] = [];
  
    for (const battle of battles) {
      const roundInfo = battle.tournament.rounds?.find(
        (r) => r.roundNumber === battle.roundNumber
      );
  
      if (!roundInfo) continue;
  
      // ⏱️ Round start/end time
      const roundStart = new Date(roundInfo.roundStartDate);
      const roundEnd = new Date(roundInfo.roundEndDate);
  
      const roundBattleCount = await this.battleRepo.count({
        where: {
          tournament: { id: battle.tournament.id },
          roundNumber: battle.roundNumber,
        },
      });
  
      // 🧠 Determine battle index in this round
      const battlesInThisRound = battles.filter(
        (b) =>
          b.tournament.id === battle.tournament.id &&
          b.roundNumber === battle.roundNumber
      );
      const battleIndex = battlesInThisRound.findIndex((b) => b.id === battle.id);
  
      // 🕐 Compute battle timing window
      const totalDuration = roundEnd.getTime() - roundStart.getTime();
      const timePerBattle = totalDuration / roundBattleCount;
  
      const startTime = new Date(roundStart.getTime() + timePerBattle * battleIndex);
      const endTime = new Date(startTime.getTime() + timePerBattle);
      const now = new Date();
      const isLive = now >= startTime && now < endTime;
  
      // ✅ NEW: Get vote counts and win rates from VoteService
      const {
        votesA,
        votesB,
        winRateA,
        winRateB,
      } = await this.voteService.getBattleVoteStats(
        battle.id,
        battle.thumbnailA.creator.id,
        battle.thumbnailB.creator.id
      );
  
      enrichedBattles.push({
        id: battle.id,
        roundNumber: battle.roundNumber,
        tournament: {
          id: battle.tournament.id,
          title: battle.tournament.title,
          category: battle.tournament.category,
        },
        endTime: "5 mints from now", //hard coded for twsting now after "endTime.toISOString(),"
        isLive:true, //harrdcode for testing then true will removed 
        thumbnailA: {
          id: battle.thumbnailA.id,
          imageUrl: battle.thumbnailA.imageUrl,
          title: battle.thumbnailA.title || 'Untitled',
          arenaPoints: battle.thumbnailA.creator.arenaPoints || 0,
          winRate: winRateA,
          votes: votesA,
          creator: {
            username: battle.thumbnailA.creator.username || battle.thumbnailA.creator.name,
            avatar: battle.thumbnailA.creator.youtubeProfile?.thumbnail || null,
          },
        },
        thumbnailB: {
          id: battle.thumbnailB.id,
          imageUrl: battle.thumbnailB.imageUrl,
          title: battle.thumbnailB.title || 'Untitled',
          arenaPoints: battle.thumbnailB.creator.arenaPoints || 0,
          winRate: winRateB,
          votes: votesB,
          creator: {
            username: battle.thumbnailB.creator.username || battle.thumbnailB.creator.name,
            avatar: battle.thumbnailB.creator.youtubeProfile?.thumbnail || null,
          },
        },
      });
    }
  
    return {
      liveBattles: enrichedBattles.filter((b) => b.isLive),
      completedBattles: enrichedBattles.filter((b) => !b.isLive),
    };
  }
  
  


  
}
