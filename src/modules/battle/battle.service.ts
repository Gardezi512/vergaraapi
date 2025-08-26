import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, Not, IsNull } from 'typeorm'; // Ensure Not and IsNull are imported
import { Battle, BattleStatus } from './entities/battle.entity';
import { CreateBattleDto } from './dto/create-battle.dto';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import { Vote } from '../vote/entities/vote.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { shuffle } from 'lodash';
import { VoteService } from '../vote/vote.service';
import { ArenaPointsService } from '../awards/services/arena-points.service';
import { APTransactionType } from '../awards/entities/arena-points-transaction.entity';

@Injectable()
export class BattleService {
  private readonly logger = new Logger(BattleService.name); // Initialize Logger
  constructor(
    @InjectRepository(Battle)
    private readonly battleRepo: Repository<Battle>,
    @InjectRepository(Thumbnail)
    private readonly thumbnailRepo: Repository<Thumbnail>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    private readonly voteService: VoteService,
    private readonly arenaPointsService: ArenaPointsService,
  ) {}

  async create(dto: CreateBattleDto, user: User): Promise<Battle> {


    const thumbnailA = await this.thumbnailRepo.findOne({
      where: { id: dto.thumbnailAId },
      relations: ['creator'],
    });

    const thumbnailB = dto.thumbnailBId
      ? await this.thumbnailRepo.findOne({
          where: { id: dto.thumbnailBId },
          relations: ['creator'],
        })
      : null;

    if (!thumbnailA) throw new NotFoundException('Thumbnail A not found');
    if (dto.thumbnailBId && !thumbnailB)
      throw new NotFoundException('Thumbnail B not found');

    const tournament = await this.battleRepo.manager
      .getRepository(Tournament)
      .findOne({
        where: { id: dto.tournamentId },
        relations: ['createdBy'], // <-- make sure we fetch the owner
      });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (!tournament.createdBy) {
      throw new BadRequestException(
        'Tournament does not have a valid creator assigned.'
      );
    }
    const round = tournament.rounds?.find(
      (r) => r.roundNumber === dto.roundNumber,
    );
    if (!round)
      throw new BadRequestException(
        `Round #${dto.roundNumber} not found in this tournament.`,
      );

    const now = new Date();
    if (
      now < new Date(round.roundStartDate) ||
      now > new Date(round.roundEndDate)
    ) {
      throw new BadRequestException(
        `Round #${dto.roundNumber} is not active right now.`,
      );
    }

    const isBye = !thumbnailB;

    const battle = this.battleRepo.create({
      thumbnailA,
      thumbnailB: isBye ? null : thumbnailB,
      tournament,
      roundNumber: dto.roundNumber,
      
      createdBy: { id: tournament.createdBy.id } as User, // ✅ safest way to set relation
      isByeBattle: isBye,
      ...(isBye
        ? { status: BattleStatus.COMPLETED, winnerUser: thumbnailA.creator }
        : { status: BattleStatus.PENDING }), // 🔑 omit winnerUser entirely when not bye
    });

    const savedBattle = await this.battleRepo.save(battle);
    this.logger.log(`Battle created successfully with ID: ${savedBattle.id}`);
    return savedBattle;
  }

  private async updateThumbnailELO(
    winnerThumb: Thumbnail,
    loserThumb: Thumbnail,
  ): Promise<void> {
    // Dynamic K-value based on battle count (client's specification)
    const getKValue = (battleCount: number): number => {
      if (battleCount < 10) return 40;
      if (battleCount < 20) return 20;
      return 10;
    };

    const kWinner = getKValue(winnerThumb.battleCount);
    const kLoser = getKValue(loserThumb.battleCount);

    // Client's exact ELO formula
    const expectedWinner =
      1 /
      (1 + Math.pow(10, (loserThumb.eloRating - winnerThumb.eloRating) / 400));
    const expectedLoser =
      1 /
      (1 + Math.pow(10, (winnerThumb.eloRating - loserThumb.eloRating) / 400));

    // Update ELO ratings
    const newWinnerELO = Math.round(
      winnerThumb.eloRating + kWinner * (1 - expectedWinner),
    );
    const newLoserELO = Math.round(
      loserThumb.eloRating + kLoser * (0 - expectedLoser),
    );

    this.logger.log(
      `ELO Update - Winner: ${winnerThumb.eloRating} → ${newWinnerELO} (K=${kWinner}), ` +
        `Loser: ${loserThumb.eloRating} → ${newLoserELO} (K=${kLoser})`,
    );

    winnerThumb.eloRating = newWinnerELO;
    loserThumb.eloRating = newLoserELO;
  }

  async resolveWinnerFromVotes(battleId: number): Promise<any> {
    this.logger.log(`Attempting to resolve battle ${battleId} from votes.`);

    const battle = await this.battleRepo.findOne({
      where: { id: battleId },
      relations: [
        'thumbnailA',
        'thumbnailB',
        'thumbnailA.creator',
        'thumbnailB.creator',
        'tournament',
      ],
    });

    if (!battle) {
      this.logger.error(`Battle with ID ${battleId} not found.`);
      throw new NotFoundException(`Battle with ID ${battleId} not found.`);
    }

    if (battle.status === BattleStatus.COMPLETED) {
      this.logger.log(
        `Battle ${battleId} already completed. Skipping winner resolution.`,
      );
      return battle;
    }

    if (battle.isByeBattle) {
      this.logger.log(
        `Battle ${battleId} is a bye battle. Winner is Thumbnail A's creator. Setting status to COMPLETED.`,
      );
      battle.winnerUser = battle.thumbnailA.creator;
      battle.status = BattleStatus.COMPLETED;

      // 🎯 NEW: Award arena points for bye battle advancement
      await this.arenaPointsService.awardArenaPoints(
        battle.thumbnailA.creator.id,
        5, // Smaller reward for bye
        APTransactionType.BATTLE_WIN,
        'Bye battle advancement',
        battle.tournament.id,
        battle.id,
      );

      return this.battleRepo.save(battle);
    }

    if (!battle.thumbnailB) {
    
      throw new BadRequestException(
        'Cannot resolve votes for a battle without a second thumbnail.',
      );
    }

    const { votesA, votesB } = await this.voteService.getVotesForBattle(
      battle.id,
    );

    this.logger.log(
      `Battle ${battle.id} vote counts: Thumbnail A (${battle.thumbnailA.creator.username}): ${votesA}, Thumbnail B (${battle.thumbnailB.creator.username}): ${votesB}`,
    );

    let winnerThumb: Thumbnail;
    let loserThumb: Thumbnail;

    if (votesA > votesB) {
      winnerThumb = battle.thumbnailA;
      loserThumb = battle.thumbnailB;
    } else if (votesB > votesA) {
      winnerThumb = battle.thumbnailB;
      loserThumb = battle.thumbnailA;
    } else {
      // 🎯 ENHANCED: ELO-based tie-breaker instead of pure random
      this.logger.log(
        `Tie in battle ${battle.id}. Using ELO-based tie-breaker.`,
      );
      if (battle.thumbnailA.eloRating >= battle.thumbnailB.eloRating) {
        winnerThumb = battle.thumbnailA;
        loserThumb = battle.thumbnailB;
      } else {
        winnerThumb = battle.thumbnailB;
        loserThumb = battle.thumbnailA;
      }
    }

    battle.winnerUser = winnerThumb.creator;
    battle.status = BattleStatus.COMPLETED;

    // 🎯 NEW: Update ELO ratings using client's exact formula
    await this.updateThumbnailELO(winnerThumb, loserThumb);

    // 🎯 NEW: Update user statistics
    winnerThumb.creator.winCount += 1;
    winnerThumb.creator.battleCount += 1;
    loserThumb.creator.lossCount += 1;
    loserThumb.creator.battleCount += 1;

    // Update thumbnail stats (existing logic)
    winnerThumb.winCount += 1;
    loserThumb.lossCount += 1;
    winnerThumb.battleCount += 1;
    loserThumb.battleCount += 1;

    // 🎯 NEW: Award arena points for battle win
    await this.arenaPointsService.awardArenaPoints(
      winnerThumb.creator.id,
      10, // Battle win points
      APTransactionType.BATTLE_WIN,
      `Battle victory vs ${loserThumb.creator.username || loserThumb.creator.name}`,
      battle.tournament.id,
      battle.id,
    );

    // Save all updates
    await this.thumbnailRepo.save([winnerThumb, loserThumb]);
    await this.userRepo.save([winnerThumb.creator, loserThumb.creator]);
    await this.battleRepo.save(battle);

    return {
      battleId: battle.id,
      voteCount: {
        [battle.thumbnailA.creator.id]: votesA,
        [battle.thumbnailB.creator.id]: votesB,
      },
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
    const tournament = await this.battleRepo.manager
      .getRepository(Tournament)
      .findOne({
        where: { id: tournamentId },
        relations: ['participants'],
      });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const round = tournament.rounds?.find((r) => r.roundNumber === roundNumber);
    if (!round) throw new NotFoundException(`Round #${roundNumber} not found`);

    const now = new Date();
    if (now < new Date(round.roundStartDate))
      throw new BadRequestException('This round has not started yet.');
    if (now > new Date(round.roundEndDate))
      throw new BadRequestException('This round has already ended.');

    const existing = await this.battleRepo.count({
      where: { tournament: { id: tournamentId }, roundNumber },
    });
    if (existing)
      throw new BadRequestException(
        `Battles for round #${roundNumber} already exist.`,
      );

    const participantIds = tournament.participants.map((p) => p.id);
    const thumbnails = (
      await this.thumbnailRepo.find({
        where: {
          tournament: { id: tournamentId },
          creator: { id: In(participantIds) },
        },
        relations: ['creator'],
      })
    ).filter((t) => !!t.creator);

    if (thumbnails.length === 0) {
      throw new BadRequestException(
        'No thumbnails available to generate battles.',
      );
    }

    // Single participant => auto-advance via bye (winner must be real user)
    if (thumbnails.length === 1) {
      const byeBattle = this.battleRepo.create({
        thumbnailA: thumbnails[0],
        thumbnailB: null,
        tournament,
        roundNumber,
        createdBy,
        isByeBattle: true,
        status: BattleStatus.COMPLETED,
        winnerUser: thumbnails[0].creator,
      });
      return this.battleRepo.save([byeBattle]);
    }

    const shuffled = shuffle(thumbnails);
    const battlesToCreate: Battle[] = [];
    let byeThumbnail: Thumbnail | null = null;

    if (shuffled.length % 2 !== 0) {
      byeThumbnail = shuffled.pop() || null;
      if (byeThumbnail?.creator?.username) {
        this.logger.log(
          `Thumbnail from user ${byeThumbnail.creator.username} received a bye.`,
        );
      }
    }

    for (let i = 0; i < shuffled.length; i += 2) {
      battlesToCreate.push(
        this.battleRepo.create({
          thumbnailA: shuffled[i],
          thumbnailB: shuffled[i + 1],
          tournament,
          roundNumber,
          createdBy,
          isByeBattle: false,
          status: BattleStatus.PENDING,
        }),
      );
    }

    if (byeThumbnail) {
      battlesToCreate.push(
        this.battleRepo.create({
          thumbnailA: byeThumbnail,
          thumbnailB: null,
          tournament,
          roundNumber,
          createdBy,
          isByeBattle: true,
          status: BattleStatus.COMPLETED,
          winnerUser: byeThumbnail.creator,
        }),
      );
    }

    return this.battleRepo.save(battlesToCreate);
  }

  async getWinnersOfRound(
    tournamentId: number,
    roundNumber: number,
  ): Promise<{ thumbnail: Thumbnail; user: User }[]> {
    // Changed tournamentId to number
    const battles = await this.battleRepo.find({
      where: {
        tournament: { id: tournamentId },
        roundNumber,
        status: BattleStatus.COMPLETED, // Only consider completed battles for winners
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
      if (!battle.winnerUser) {
        this.logger.warn(
          `Completed battle ${battle.id} has no winnerUser. Skipping.`,
        );
        continue;
      }

      let winningThumb: Thumbnail | null = null;

      if (battle.isByeBattle) {
        if (!battle.thumbnailA?.creator) {
          this.logger.error(
            `Bye battle ${battle.id} has no creator on thumbnailA. Skipping.`,
          );
          continue;
        }
        winningThumb = battle.thumbnailA;
      } else {
        if (battle.thumbnailA?.creator?.id === battle.winnerUser.id) {
          winningThumb = battle.thumbnailA;
        } else if (battle.thumbnailB?.creator?.id === battle.winnerUser.id) {
          winningThumb = battle.thumbnailB;
        }

        if (!winningThumb) {
          this.logger.error(
            `Battle ${battle.id} winnerUser ${battle.winnerUser.id} does not match any thumbnail creator. Skipping.`,
          );
          continue;
        }
        if (!winningThumb.creator) {
          this.logger.error(
            `Winning thumbnail ${winningThumb.id} has no creator. Skipping.`,
          );
          continue;
        }
      }

      winners.push({ thumbnail: winningThumb, user: winningThumb.creator });
    }

    this.logger.log(
      `Found ${winners.length} winners for tournament ${tournamentId}, round ${roundNumber}.`,
    );
    return winners;
  }

  async generateNextRoundBattles(
    tournamentId: number,
    currentRound: number,
    createdBy: User,
  ): Promise<Battle[]> {
    // Changed tournamentId to number
    this.logger.log(
      `Generating next round battles for tournament ${tournamentId}, from round ${currentRound}.`,
    );
    const tournament = await this.battleRepo.manager
      .getRepository(Tournament)
      .findOne({
        where: { id: tournamentId },
      });
    if (!tournament) {
      this.logger.error(`Tournament with ID ${tournamentId} not found.`);
      throw new NotFoundException('Tournament not found');
    }
    if (!Array.isArray(tournament.rounds) || tournament.rounds.length === 0) {
      throw new BadRequestException('Tournament rounds data is missing.');
    }

    const nextRound = tournament.rounds?.find(
      (r) => r.roundNumber === currentRound + 1,
    );
    if (!nextRound) {
    
      throw new BadRequestException('Next round not found');
    }

    const winners = await this.getWinnersOfRound(tournamentId, currentRound);
    if (winners.length < 2) {
      this.logger.log(
        `Not enough winners (${winners.length}) from round ${currentRound} to generate next round battles. Tournament might be concluded.`,
      );
      return [];
    }

    const shuffled = shuffle(winners);
    const battlesToCreate: Battle[] = [];
    let byeWinner: { thumbnail: Thumbnail; user: User } | null = null;

    if (shuffled.length % 2 !== 0) {
      byeWinner = shuffled.pop() as { thumbnail: Thumbnail; user: User }; // This winner gets a bye
      this.logger.log(
        `⚠️ Winner ${byeWinner.user.username} received a bye for this round.`,
      );
    }

    for (let i = 0; i < shuffled.length; i += 2) {
      const thumbnailA = shuffled[i].thumbnail;
      const thumbnailB = shuffled[i + 1].thumbnail;
      const battle = this.battleRepo.create({
        thumbnailA,
        thumbnailB,
        tournament,
        roundNumber: currentRound + 1,
        createdBy,
        isByeBattle: false,
        status: BattleStatus.PENDING, // Set initial status for regular battles
      });
      battlesToCreate.push(battle);
    }

    if (byeWinner) {
      const byeBattle = this.battleRepo.create({
        thumbnailA: byeWinner.thumbnail,
        thumbnailB: null, // Set thumbnailB to null for bye battles
        tournament,
        roundNumber: currentRound + 1,
        createdBy,
        isByeBattle: true, // Mark as a bye battle
        winnerUser: byeWinner.user, // The bye winner is the winner
        status: BattleStatus.COMPLETED, // Bye battles are immediately completed
      });
      battlesToCreate.push(byeBattle);
      this.logger.log(
        `Created bye battle for ${byeWinner.user.username} in next round and marked as COMPLETED.`,
      );
    }

    return this.battleRepo.save(battlesToCreate);
  }

  async calculateWinRates(battle: Battle): Promise<Record<number, number>> {
    // Changed key type to number
    const rates: Record<number, number> = {}; // Changed key type to number
    const thumbs = [battle.thumbnailA, battle.thumbnailB].filter(
      Boolean,
    ) as Thumbnail[];

    for (const t of thumbs) {
      const total = t.battleCount;
      const wins = t.winCount;
      rates[t.id] = total === 0 ? 0 : Math.round((wins / total) * 100);
    }
    return rates;
  }

  async getArenaPoints(thumbnailIds: number[]) {
    // Changed thumbnailIds to number[]
    const thumbs = await this.thumbnailRepo.find({
      where: { id: In(thumbnailIds) },
      relations: ['creator'],
    });

    const map: Record<number, number> = {}; // Changed key type to number
    for (const t of thumbs) {
      map[t.id] = t.creator.arenaPoints || 0;
    }
    return map;
  }


async getAllBattles(userId?: number) {


  const battles = await this.battleRepo.find({
    relations: {
      thumbnailA: { creator: { youtubeProfile: true } },
      thumbnailB: { creator: { youtubeProfile: true } },
      tournament: true,
    },
    order: { createdAt: "ASC" },
  })

  if (!battles?.length) {
    return { liveBattles: [], completedBattles: [] }
  }

  const battleIds = battles.map((b) => b.id)

  // 1) Round counts (tournamentId + roundNumber => number of battles)
  const roundCountsRaw = await this.battleRepo
    .createQueryBuilder("battle")
    .select("battle.tournamentId", "tournamentId")
    .addSelect("battle.roundNumber", "roundNumber")
    .addSelect("COUNT(*)", "count")
    .where("battle.id IN (:...battleIds)", { battleIds })
    .groupBy("battle.tournamentId")
    .addGroupBy("battle.roundNumber")
    .getRawMany()

  const roundCountsMap = new Map<string, number>()
  for (const r of roundCountsRaw) {
    const key = `${r.tournamentId}:${r.roundNumber}`
    roundCountsMap.set(key, Number(r.count))
  }

  // 2) Vote counts grouped by battleId and votedFor (votedFor is thumbnail id, not user id)
  const voteCountsRaw = await this.voteRepo
    .createQueryBuilder("vote")
    .select("vote.battleId", "battleId")
    .addSelect("vote.votedForId", "votedForId") // This is thumbnail ID
    .addSelect("COUNT(*)", "count")
    .where("vote.battleId IN (:...battleIds)", { battleIds })
    .groupBy("vote.battleId")
    .addGroupBy("vote.votedForId")
    .getRawMany()

  // countsMap[battleId] = { [thumbnailId]: count }
  const countsMap: Record<number, Record<number, number>> = {}
  for (const row of voteCountsRaw) {
    const bId = Number(row.battleId)
    const thumbnailId = Number(row.votedForId) // This is thumbnail ID
    const cnt = Number(row.count)
    countsMap[bId] = countsMap[bId] || {}
    countsMap[bId][thumbnailId] = cnt
  }

  // 3) User's votes across these battles - using proper relations and logging
  let userVotes: Vote[] = []
  if (userId) {


    userVotes = await this.voteRepo.find({
      where: {
        voter: { id: userId },
        battle: { id: In(battleIds) },
      },
      relations: ["votedFor", "battle", "voter"],
    })

   
    userVotes.forEach((vote) => {
 
    })
  } else {
 
  }

  // 4) Build helper map for battles in same round to compute index
  const battlesByRound = new Map<string, number[]>() // key -> list of battle ids in original order
  for (const b of battles) {
    const key = `${b.tournament.id}:${b.roundNumber}`
    if (!battlesByRound.has(key)) battlesByRound.set(key, [])
    battlesByRound.get(key)!.push(b.id)
  }

  const enrichedBattles = battles.map((battle) => {
    // safe guards
    const hasB = !!battle.thumbnailB
    const thumbnailAId = battle.thumbnailA?.id
    const thumbnailBId = battle.thumbnailB?.id

    // votes (from grouped counts) - now using thumbnail IDs
    const countsFor = countsMap[battle.id] || {}
    const votesA = thumbnailAId ? countsFor[thumbnailAId] || 0 : 0
    const votesB = thumbnailBId ? countsFor[thumbnailBId] || 0 : 0
    const totalVotes = votesA + votesB
    const winRateA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50
    const winRateB = 100 - winRateA

    // user's vote for this battle (if any)
    const userVote = userVotes.find((uv) => uv.battle.id === battle.id) || null


    let votedFor: "A" | "B" | null = null
    let votedForThumbnailId: number | null = null

    if (userVote) {
      votedForThumbnailId = userVote.votedFor.id

      if (votedForThumbnailId === battle.thumbnailA?.id) {
        votedFor = "A"
      } else if (hasB && votedForThumbnailId === battle.thumbnailB?.id) {
        votedFor = "B"
      }

    }

    // compute round time windows (use round info stored on tournament)
    const roundInfo = battle.tournament.rounds?.find((r) => r.roundNumber === battle.roundNumber)
    const now = new Date()
    let isLive = false
    let endTimeIso = ""

    if (roundInfo) {
      const roundStart = new Date(roundInfo.roundStartDate)
      const roundEnd = new Date(roundInfo.roundEndDate)
      const roundKey = `${battle.tournament.id}:${battle.roundNumber}`
      const roundCount = roundCountsMap.get(roundKey) || battlesByRound.get(roundKey)?.length || 1
      const safeRoundCount = Math.max(1, roundCount)
      const totalDuration = roundEnd.getTime() - roundStart.getTime()
      const timePerBattle = safeRoundCount > 0 ? totalDuration / safeRoundCount : 0

      const battlesInRound = battlesByRound.get(roundKey) || []
      const indexInRound = battlesInRound.findIndex((id) => id === battle.id)

      const startTime = new Date(roundStart.getTime() + timePerBattle * indexInRound)
      const endTime = new Date(startTime.getTime() + timePerBattle)
      endTimeIso = endTime.toISOString()

      const isInTimeWindow = now >= startTime && now < endTime
      const isPending = battle.status === BattleStatus.PENDING
      isLive = isInTimeWindow && isPending
     
    }

    const voteInfo = {
      userHasVoted: !!userVote,
      votedFor, // 'A' | 'B' | null
      votedForThumbnailId, // the thumbnail the user voted for
      votesA,
      votesB,
      winRateA,
      winRateB,
    }
    return {
      id: battle.id,
      roundNumber: battle.roundNumber,
      tournament: {
        id: battle.tournament.id,
        title: battle.tournament.title,
        category: battle.tournament.category,
      },
      endTime: endTimeIso,
      isLive,
      voteInfo,
      thumbnailA: {
        id: battle.thumbnailA.id,
        imageUrl: battle.thumbnailA.imageUrl,
        title: battle.thumbnailA.title || "Untitled",
        arenaPoints: battle.thumbnailA.creator?.arenaPoints || 0,
        winRate: winRateA,
        votes: votesA,
        creator: {
          id: battle.thumbnailA.creator?.id,
          username: battle.thumbnailA.creator?.username || battle.thumbnailA.creator?.name,
          avatar: battle.thumbnailA.creator?.youtubeProfile?.thumbnail || null,
        },
      },
      thumbnailB: battle.thumbnailB
        ? {
            id: battle.thumbnailB.id,
            imageUrl: battle.thumbnailB.imageUrl,
            title: battle.thumbnailB.title || "Untitled",
            arenaPoints: battle.thumbnailB.creator?.arenaPoints || 0,
            winRate: winRateB,
            votes: votesB,
            creator: {
              id: battle.thumbnailB.creator?.id,
              username: battle.thumbnailB.creator?.username || battle.thumbnailB.creator?.name,
              avatar: battle.thumbnailB.creator?.youtubeProfile?.thumbnail || null,
            },
          }
        : null,
      isByeBattle: battle.isByeBattle,
      status: battle.status,
    }
  })

  const liveBattles = enrichedBattles.filter((b) => b.isLive)
  const completedBattles = enrichedBattles.filter((b) => !b.isLive)

  return {
    liveBattles,
    completedBattles,
  }
}


  /**
   * Counts the number of battles for a specific tournament and round.
   * @param tournamentId The ID of the tournament.
   * @param roundNumber The round number.
   * @returns The count of battles.
   */
  async countBattlesForRound(
    tournamentId: number,
    roundNumber: number,
  ): Promise<number> {
    // Changed tournamentId to number
    return this.battleRepo.count({
      where: {
        tournament: { id: tournamentId },
        roundNumber: roundNumber,
      },
    });
  }


  async countCompletedBattlesForRound(
    tournamentId: number,
    roundNumber: number,
  ): Promise<number> {
    // Changed tournamentId to number
    return this.battleRepo.count({
      where: {
        tournament: { id: tournamentId },
        roundNumber: roundNumber,
        status: BattleStatus.COMPLETED, // Check status instead of winnerUser directly
      },
    });
  }

  async getBattlesForRound(
    tournamentId: number,
    roundNumber: number,
  ): Promise<Battle[]> {
    // Added this method back
    return this.battleRepo.find({
      where: {
        tournament: { id: tournamentId },
        roundNumber: roundNumber,
      },
      relations: ['thumbnailA', 'thumbnailB', 'winnerUser', 'votes'],
    });
  }
}
