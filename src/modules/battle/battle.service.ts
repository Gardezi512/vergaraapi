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

@Injectable()
export class BattleService {
  private readonly logger = new Logger(BattleService.name) // Initialize Logger
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
  ) {}

//   async create(dto: CreateBattleDto, user: User): Promise<Battle> {
//     const thumbnailA = await this.thumbnailRepo.findOne({
//       where: { id: dto.thumbnailAId },
//       relations: ['creator'],
//     });
//     const thumbnailB = await this.thumbnailRepo.findOne({
//       where: { id: dto.thumbnailBId },
//       relations: ['creator'],
//     });
//     if (!thumbnailA || !thumbnailB) {
//       throw new NotFoundException('One or both thumbnails not found');
//     }
//     const tournament = await this.battleRepo.manager
//       .getRepository(Tournament)
//       .findOne({
//         where: { id: dto.tournamentId },
//       });
//     if (!tournament) {
//       throw new NotFoundException('Tournament not found');
//     }
//     const round = tournament.rounds?.find(
//       (r) => r.roundNumber === dto.roundNumber,
//     );
//     if (!round) {
//       throw new BadRequestException(
//         `Round #${dto.roundNumber} not found in this tournament.`,
//       );
//     }
//     const now = new Date();
//     if (
//       now < new Date(round.roundStartDate) ||
//       now > new Date(round.roundEndDate)
//     ) {
//       throw new BadRequestException(
//         `Round #${dto.roundNumber} is not active right now.`,
//       );
//     }
//     const battle = this.battleRepo.create({
//       thumbnailA,
//       thumbnailB,
//       tournament,
//       roundNumber: dto.roundNumber,
//       createdBy: user,
//     });
//     return this.battleRepo.save(battle);
//   }

//   private calculateElo(
//     winnerElo: number,
//     loserElo: number,
//     winnerCount: number,
//     loserCount: number,
//   ) {
//     const expectedA = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
//     const expectedB = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
//     const kA = winnerCount < 10 ? 40 : winnerCount < 20 ? 20 : 10;
//     const kB = loserCount < 10 ? 40 : loserCount < 20 ? 20 : 10;
//     const newWinnerElo = Math.round(winnerElo + kA * (1 - expectedA));
//     const newLoserElo = Math.round(loserElo + kB * (0 - expectedB));
//     return { newWinnerElo, newLoserElo };
//   }

//   async resolveWinnerFromVotes(battleId: number): Promise<any> {
//     const battle = await this.battleRepo.findOne({
//       where: { id: battleId },
//       relations: [
//         'thumbnailA',
//         'thumbnailB',
//         'thumbnailA.creator',
//         'thumbnailB.creator',
//       ],
//     });
//     if (!battle) throw new NotFoundException('Battle not found');
//     if (battle.winnerUser) {
//       throw new BadRequestException('Battle already resolved.');
//     }
//     const votes = await this.voteRepo.find({
//       where: { battle: { id: battleId } },
//     });
//     const voteCount: Record<number, number> = {};
//     for (const vote of votes) {
//       const userId = vote.votedFor.id;
//       voteCount[userId] = (voteCount[userId] || 0) + 1;
//     }
//     const aVotes = voteCount[battle.thumbnailA.creator.id] || 0;
//     const bVotes = voteCount[battle.thumbnailB.creator.id] || 0;
//     if (aVotes === bVotes) {
//       throw new BadRequestException('Cannot resolve winner: it’s a tie');
//     }
//     const winnerThumb = aVotes > bVotes ? battle.thumbnailA : battle.thumbnailB;
//     const loserThumb = aVotes > bVotes ? battle.thumbnailB : battle.thumbnailA;
//     // Calculate new ELOs
//     const updated = this.calculateElo(
//       winnerThumb.eloRating,
//       loserThumb.eloRating,
//       winnerThumb.battleCount,
//       loserThumb.battleCount,
//     );
//     winnerThumb.eloRating = updated.newWinnerElo;
//     loserThumb.eloRating = updated.newLoserElo;
//     winnerThumb.battleCount++;
//     loserThumb.battleCount++;
//     winnerThumb.winCount++;
//     loserThumb.lossCount++;
//     // Arena Points
//     winnerThumb.creator.arenaPoints += 10;
//     loserThumb.creator.arenaPoints += 5;
//     // Save thumbnails and users
//     await this.thumbnailRepo.save([winnerThumb, loserThumb]);
//     await this.userRepo.save([winnerThumb.creator, loserThumb.creator]);
//     // Save resolved winner
//     battle.winnerUser = winnerThumb.creator;
//     await this.battleRepo.save(battle);
//     return {
//       battleId: battle.id,
//       voteCount,
//       winner: {
//         userId: winnerThumb.creator.id,
//         username: winnerThumb.creator.username,
//         thumbnailId: winnerThumb.id,
//         eloRating: winnerThumb.eloRating,
//         arenaPoints: winnerThumb.creator.arenaPoints,
//       },
//       loser: {
//         userId: loserThumb.creator.id,
//         username: loserThumb.creator.username,
//         thumbnailId: loserThumb.id,
//         eloRating: loserThumb.eloRating,
//         arenaPoints: loserThumb.creator.arenaPoints,
//       },
//       message: `Winner is ${winnerThumb.creator.username}`,
//     };
//   }

//   async generateRandomBattlesForRound(
//     tournamentId: number,
//     roundNumber: number,
//     createdBy: User,
//   ): Promise<Battle[]> {
//     console.log(`🌀 Tournament ID: ${tournamentId}`);
//     console.log(`🏁 Generating battles for round: ${roundNumber}`);
//     const tournament = await this.battleRepo.manager
//       .getRepository(Tournament)
//       .findOne({
//         where: { id: tournamentId },
//         relations: ['participants'],
//       });
//     if (!tournament) throw new NotFoundException('Tournament not found');
//     console.log(`📦 Rounds from tournament: ${JSON.stringify(tournament.rounds)}`);
//     const round = tournament.rounds?.find(r => r.roundNumber === roundNumber);
//     if (!round) throw new NotFoundException(`Round #${roundNumber} not found`);
//     console.log(`✅ Active Round Info: ${JSON.stringify(round)}`);
//     const now = new Date();
//     if (now < new Date(round.roundStartDate)) {
//       throw new BadRequestException('This round has not started yet.');
//     }
//     if (now > new Date(round.roundEndDate)) {
//       throw new BadRequestException('This round has already ended.');
//     }
//     const existingBattles = await this.battleRepo.find({
//       where: { tournament: { id: tournamentId }, roundNumber },
//     });
//     if (existingBattles.length > 0) {
//       throw new BadRequestException(`Battles for round #${roundNumber} already exist.`);
//     }
//     // Fetch valid thumbnails of current participants
//     const participantIds = tournament.participants.map((p) => p.id);
//     const thumbnails = await this.thumbnailRepo.find({
//       where: {
//         tournament: { id: tournamentId },
//         creator: { id: In(participantIds) },
//       },
//       relations: ['creator'],
//     });
//     console.log(`🎯 Found ${thumbnails.length} thumbnails for round pairing.`);
//     if (thumbnails.length < 2) {
//       throw new BadRequestException(
//         'Not enough thumbnails submitted to generate battles (minimum 2 required).',
//       );
//     }
//     const shuffled = shuffle(thumbnails);
//     if (shuffled.length % 2 !== 0) {
//       const excluded = shuffled.pop();
//       console.log(
//         `⚠️ Thumbnail from user ${excluded.creator.id} excluded due to unpaired count.`,
//       );
//     }
//     const battlesToCreate: Battle[] = [];
//     for (let i = 0; i < shuffled.length; i += 2) {
//       const thumbnailA = shuffled[i];
//       const thumbnailB = shuffled[i + 1];
//       console.log(
//         `📊 Pairing battle: ${thumbnailA.creator.username} vs ${thumbnailB.creator.username}`,
//       );
//       const battle = this.battleRepo.create({
//         thumbnailA,
//         thumbnailB,
//         tournament,
//         roundNumber,
//         createdBy,
//       });
//       battlesToCreate.push(battle);
//     }
//     console.log(`💾 Saving ${battlesToCreate.length} battles to DB...`);
//     return this.battleRepo.save(battlesToCreate);
//   }

//   async getWinnersOfRound(
//     tournamentId: number,
//     roundNumber: number,
//   ): Promise<{ thumbnail: Thumbnail; user: User }[]> {
//     const battles = await this.battleRepo.find({
//       where: {
//         tournament: { id: tournamentId },
//         roundNumber,
//       },
//       relations: [
//         'thumbnailA',
//         'thumbnailB',
//         'thumbnailA.creator',
//         'thumbnailB.creator',
//         'winnerUser',
//       ],
//     });
//     const winners: { thumbnail: Thumbnail; user: User }[] = [];
//     for (const battle of battles) {
//       if (!battle.winnerUser) continue;
//       const winningThumb =
//         battle.thumbnailA.creator.id === battle.winnerUser.id
//           ? battle.thumbnailA
//           : battle.thumbnailB;
//       winners.push({
//         thumbnail: winningThumb,
//         user: winningThumb.creator,
//       });
//     }
//     return winners;
//   }

//   async generateNextRoundBattles(
//     tournamentId: number,
//     currentRound: number,
//     createdBy: User,
//   ): Promise<Battle[]> {
//     const tournament = await this.battleRepo.manager
//       .getRepository(Tournament)
//       .findOne({
//         where: { id: tournamentId },
//       });
//     if (!tournament) throw new NotFoundException('Tournament not found');
//     const nextRound = tournament.rounds?.find(
//       (r) => r.roundNumber === currentRound + 1,
//     );
//     if (!nextRound) throw new BadRequestException('Next round not found');
//     const winners = await this.getWinnersOfRound(tournamentId, currentRound);
//     if (winners.length < 2) {
//       // This is the crucial part for small tournaments: if only one winner, tournament concludes.
//       // Instead of throwing an error, return an empty array to signify no new battles.
//       console.log(`Not enough winners (${winners.length}) from round ${currentRound} to generate next round battles. Tournament might be concluded.`);
//       return [];
//     }
//     const shuffled = shuffle(winners);
//     if (shuffled.length % 2 !== 0) {
//       const excluded = shuffled.pop();
//       console.warn(`Thumbnail ${excluded?.id} excluded due to unpaired count.`);
//     }
//     const battlesToCreate: Battle[] = [];
//     for (let i = 0; i < shuffled.length; i += 2) {
//       const thumbnailA = shuffled[i];
//       const thumbnailB = shuffled[i + 1];
//       const battle = this.battleRepo.create({
//         thumbnailA,
//         thumbnailB,
//         tournament,
//         roundNumber: currentRound + 1,
//         createdBy,
//       });
//       battlesToCreate.push(battle);
//     }
//     return this.battleRepo.save(battlesToCreate);
//   }

//   async calculateWinRates(battle: Battle): Promise<Record<number, number>> {
//     const rates: Record<number, number> = {};
//     const thumbs = [battle.thumbnailA, battle.thumbnailB];

//     for (const t of thumbs) {
//       const total = t.battleCount;
//       const wins = t.winCount;
//       rates[t.id] = total === 0 ? 0 : Math.round((wins / total) * 100);
//     }

//     return rates;
//   }

//   async getArenaPoints(thumbnailIds: number[]) {
//     const thumbs = await this.thumbnailRepo.find({
//       where: { id: In(thumbnailIds) },
//       relations: ['creator'],
//     });

//     const map: Record<number, number> = {};
//     for (const t of thumbs) {
//       map[t.id] = t.creator.arenaPoints || 0;
//     }

//     return map;
//   }

//   async getAllBattles() {
//     const battles = await this.battleRepo.find({
//       relations: {
//         thumbnailA: { creator: { youtubeProfile: true } },
//         thumbnailB: { creator: { youtubeProfile: true } },
//         tournament: true,
//       },
//       order: { createdAt: 'ASC' },
//     });

//     const enrichedBattles: any[] = [];

//     for (const battle of battles) {
//       const roundInfo = battle.tournament.rounds?.find(
//         (r) => r.roundNumber === battle.roundNumber
//       );

//       if (!roundInfo) continue;

//       // ⏱️ Round start/end time
//       const roundStart = new Date(roundInfo.roundStartDate);
//       const roundEnd = new Date(roundInfo.roundEndDate);

//       const roundBattleCount = await this.battleRepo.count({
//         where: {
//           tournament: { id: battle.tournament.id },
//           roundNumber: battle.roundNumber,
//         },
//       });

//       // 🧠 Determine battle index in this round
//       const battlesInThisRound = battles.filter(
//         (b) =>
//           b.tournament.id === battle.tournament.id &&
//           b.roundNumber === battle.roundNumber
//       );
//       const battleIndex = battlesInThisRound.findIndex((b) => b.id === battle.id);

//       // 🕐 Compute battle timing window
//       const totalDuration = roundEnd.getTime() - roundStart.getTime();
//       const timePerBattle = totalDuration / roundBattleCount;

//       const startTime = new Date(roundStart.getTime() + timePerBattle * battleIndex);
//       const endTime = new Date(startTime.getTime() + timePerBattle);
//       const now = new Date();

//       const isLive = now >= startTime && now < endTime;

//       // ✅ NEW: Get vote counts and win rates from VoteService
//       // Ensure VoteService is correctly injected and has getBattleVoteStats method
//       const {
//         votesA,
//         votesB,
//         winRateA,
//         winRateB,
//       } = await this.voteService.getBattleVoteStats(
//         battle.id,
//         battle.thumbnailA.creator.id,
//         battle.thumbnailB.creator.id
//       );

//       enrichedBattles.push({
//         id: battle.id,
//         roundNumber: battle.roundNumber,
//         tournament: {
//           id: battle.tournament.id,
//           title: battle.tournament.title,
//           category: battle.tournament.category,
//         },
//         endTime:endTime.toISOString(),
//         isLive, //harrdcode for testing then true will removed
//         thumbnailA: {
//           id: battle.thumbnailA.id,
//           imageUrl: battle.thumbnailA.imageUrl,
//           title: battle.thumbnailA.title || 'Untitled',
//           arenaPoints: battle.thumbnailA.creator.arenaPoints || 0,
//           winRate: winRateA,
//           votes: votesA,
//           creator: {
//             username: battle.thumbnailA.creator.username || battle.thumbnailA.creator.name,
//             avatar: battle.thumbnailA.creator.youtubeProfile?.thumbnail || null,
//           },
//         },
//         thumbnailB: {
//           id: battle.thumbnailB.id,
//           imageUrl: battle.thumbnailB.imageUrl,
//           title: battle.thumbnailB.title || 'Untitled',
//           arenaPoints: battle.thumbnailB.creator.arenaPoints || 0,
//           winRate: winRateB,
//           votes: votesB,
//           creator: {
//             username: battle.thumbnailB.creator.username || battle.thumbnailB.creator.name,
//             avatar: battle.thumbnailB.creator.youtubeProfile?.thumbnail || null,
//           },
//         },
//       });
//     }

//     return {
//       liveBattles: enrichedBattles.filter((b) => b.isLive),
//       completedBattles: enrichedBattles.filter((b) => !b.isLive),
//     };
//   }

//   //Counts the number of battles for a specific tournament and round.

//   async countBattlesForRound(tournamentId: number, roundNumber: number): Promise<number> {
//     return this.battleRepo.count({
//       where: {
//         tournament: { id: tournamentId },
//         roundNumber: roundNumber,
//       },
//     });
//   }

//   // Counts the number of COMPLETED battles for a specific tournament and round.
 
//   async countCompletedBattlesForRound(tournamentId: number, roundNumber: number): Promise<number> {
//     return this.battleRepo.count({
//       where: {
//         tournament: { id: tournamentId },
//         roundNumber: roundNumber,
//         winnerUser: Not(IsNull()), // Check if winnerUser is NOT NULL
//       },
//     });
//   }
// }
async create(dto: CreateBattleDto, user: User): Promise<Battle> {
  this.logger.log(`Attempting to create battle: ${JSON.stringify(dto)}`)

  const thumbnailA = await this.thumbnailRepo.findOne({
    where: { id: dto.thumbnailAId },
    relations: ["creator"],
  })

  const thumbnailB = dto.thumbnailBId
    ? await this.thumbnailRepo.findOne({
        where: { id: dto.thumbnailBId },
        relations: ["creator"],
      })
    : null

  if (!thumbnailA) {
    this.logger.error(`Thumbnail A with ID ${dto.thumbnailAId} not found.`)
    throw new NotFoundException("Thumbnail A not found")
  }

  if (dto.thumbnailBId && !thumbnailB) {
    this.logger.error(`Thumbnail B with ID ${dto.thumbnailBId} not found.`)
    throw new NotFoundException("Thumbnail B not found")
  }

  const tournament = await this.battleRepo.manager.getRepository(Tournament).findOne({
    where: { id: dto.tournamentId },
  })
  if (!tournament) {
    this.logger.error(`Tournament with ID ${dto.tournamentId} not found.`)
    throw new NotFoundException("Tournament not found")
  }

  const round = tournament.rounds?.find((r) => r.roundNumber === dto.roundNumber)
  if (!round) {
    this.logger.error(`Round #${dto.roundNumber} not found in tournament ${dto.tournamentId}.`)
    throw new BadRequestException(`Round #${dto.roundNumber} not found in this tournament.`)
  }

  const now = new Date()
  if (now < new Date(round.roundStartDate) || now > new Date(round.roundEndDate)) {
    this.logger.warn(`Round #${dto.roundNumber} is not active right now.`)
    throw new BadRequestException(`Round #${dto.roundNumber} is not active right now.`)
  }

  const isBye = !thumbnailB
  const battle = this.battleRepo.create({
    thumbnailA,
    thumbnailB,
    tournament,
    roundNumber: dto.roundNumber,
    createdBy: user,
    isByeBattle: isBye,
    status: BattleStatus.PENDING, // Set initial status
    winnerUser: isBye ? thumbnailA.creator : null, // For bye battles, thumbnailA's creator is the winner
  })

  const savedBattle = await this.battleRepo.save(battle)
  this.logger.log(`Battle created successfully with ID: ${savedBattle.id}`)
  return savedBattle
}

private calculateElo(winnerElo: number, loserElo: number, winnerCount: number, loserCount: number) {
  const expectedA = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  const expectedB = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400))
  const kA = winnerCount < 10 ? 40 : winnerCount < 20 ? 20 : 10
  const kB = loserCount < 10 ? 40 : loserCount < 20 ? 20 : 10
  const newWinnerElo = Math.round(winnerElo + kA * (1 - expectedA))
  const newLoserElo = Math.round(loserElo + kB * (0 - expectedB))
  return { newWinnerElo, newLoserElo }
}

async resolveWinnerFromVotes(battleId: number): Promise<any> {
  this.logger.log(`Attempting to resolve battle ${battleId} from votes.`)

  const battle = await this.battleRepo.findOne({
    where: { id: battleId },
    relations: ["thumbnailA", "thumbnailB", "thumbnailA.creator", "thumbnailB.creator"],
  })

  if (!battle) {
    this.logger.error(`Battle with ID ${battleId} not found.`)
    throw new NotFoundException(`Battle with ID ${battleId} not found.`)
  }

  if (battle.status === BattleStatus.COMPLETED) {
    this.logger.log(`Battle ${battleId} already completed. Skipping winner resolution.`)
    return battle
  }

  if (battle.isByeBattle) {
    this.logger.log(
      `Battle ${battleId} is a bye battle. Winner is Thumbnail A's creator. Setting status to COMPLETED.`,
    )
    battle.winnerUser = battle.thumbnailA.creator
    battle.status = BattleStatus.COMPLETED
    return this.battleRepo.save(battle)
  }

  // Highlighted fix start
  // Ensure thumbnailB exists for non-bye battles before proceeding
  if (!battle.thumbnailB) {
    this.logger.error(`Cannot resolve votes for battle ${battleId}: Thumbnail B is missing for a non-bye battle.`)
    throw new BadRequestException("Cannot resolve votes for a battle without a second thumbnail.")
  }
  // Highlighted fix end

  const { votesA, votesB } = await this.voteService.getVotesForBattle(battle.id)
  this.logger.log(
    `Battle ${battle.id} vote counts: Thumbnail A (${battle.thumbnailA.creator.username}): ${votesA}, Thumbnail B (${battle.thumbnailB.creator.username}): ${votesB}`,
  )

  let winnerThumb: Thumbnail
  let loserThumb: Thumbnail
  if (votesA > votesB) {
    winnerThumb = battle.thumbnailA
    loserThumb = battle.thumbnailB
  } else if (votesB > votesA) {
    winnerThumb = battle.thumbnailB
    loserThumb = battle.thumbnailA
  } else {
    // Tie-breaker: Randomly select a winner if votes are equal
    this.logger.log(`Tie in battle ${battle.id}. Randomly selecting winner.`)
    if (Math.random() < 0.5) {
      winnerThumb = battle.thumbnailA
      loserThumb = battle.thumbnailB
    } else {
      winnerThumb = battle.thumbnailB
      loserThumb = battle.thumbnailA
    }
  }

  battle.winnerUser = winnerThumb.creator
  battle.status = BattleStatus.COMPLETED

  // Update thumbnail stats
  winnerThumb.winCount += 1
  loserThumb.lossCount += 1

  winnerThumb.battleCount += 1
  loserThumb.battleCount += 1

  await this.thumbnailRepo.save([winnerThumb, loserThumb])
  await this.userRepo.save([winnerThumb.creator, loserThumb.creator])

  await this.battleRepo.save(battle)

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
  }
}

async generateRandomBattlesForRound(tournamentId: number, roundNumber: number, createdBy: User): Promise<Battle[]> {
  // Changed tournamentId to number
  this.logger.log(`🌀 Tournament ID: ${tournamentId}`)
  this.logger.log(`🏁 Generating battles for round: ${roundNumber}`)

  const tournament = await this.battleRepo.manager.getRepository(Tournament).findOne({
    where: { id: tournamentId },
    relations: ["participants"], // Ensure rounds are loaded
  })
  if (!tournament) {
    this.logger.error(`Tournament with ID ${tournamentId} not found.`)
    throw new NotFoundException("Tournament not found")
  }

  this.logger.log(`📦 Rounds from tournament: ${JSON.stringify(tournament.rounds)}`)
  const round = tournament.rounds?.find((r) => r.roundNumber === roundNumber)
  if (!round) {
    this.logger.error(`Round #${roundNumber} not found in tournament ${tournamentId}.`)
    throw new NotFoundException(`Round #${roundNumber} not found`)
  }
  this.logger.log(`✅ Active Round Info: ${JSON.stringify(round)}`)

  const now = new Date()
  if (now < new Date(round.roundStartDate)) {
    this.logger.warn(`Round #${roundNumber} has not started yet.`)
    throw new BadRequestException("This round has not started yet.")
  }
  if (now > new Date(round.roundEndDate)) {
    this.logger.warn(`Round #${roundNumber} has already ended.`)
    throw new BadRequestException("This round has already ended.")
  }

  const existingBattles = await this.battleRepo.find({
    where: { tournament: { id: tournamentId }, roundNumber },
  })
  if (existingBattles.length > 0) {
    this.logger.warn(`Battles for round #${roundNumber} already exist.`)
    throw new BadRequestException(`Battles for round #${roundNumber} already exist.`)
  }

  // Find valid thumbnails of current participants
  const participantIds = tournament.participants.map((p) => p.id)
  const thumbnails = await this.thumbnailRepo.find({
    where: {
      tournament: { id: tournamentId },
      creator: { id: In(participantIds) },
    },
    relations: ["creator"],
  })
  this.logger.log(`🎯 Found ${thumbnails.length} thumbnails for round pairing.`)

  if (thumbnails.length < 2) {
    this.logger.warn(`Not enough thumbnails submitted to generate battles (minimum 2 required).`)
    throw new BadRequestException("Not enough thumbnails submitted to generate battles (minimum 2 required).")
  }

  const shuffled = shuffle(thumbnails)
  const battlesToCreate: Battle[] = []
  let byeThumbnail: Thumbnail | null = null

  if (shuffled.length % 2 !== 0) {
    byeThumbnail = shuffled.pop() as Thumbnail // This participant gets a bye
    this.logger.log(`⚠️ Thumbnail from user ${byeThumbnail.creator.username} received a bye for this round.`)
  }

  for (let i = 0; i < shuffled.length; i += 2) {
    const thumbnailA = shuffled[i]
    const thumbnailB = shuffled[i + 1]
    this.logger.log(`📊 Pairing battle: ${thumbnailA.creator.username} vs ${thumbnailB.creator.username}`)

    const battle = this.battleRepo.create({
      thumbnailA,
      thumbnailB,
      tournament,
      roundNumber,
      createdBy,
      isByeBattle: false,
      status: BattleStatus.PENDING, // Set initial status for regular battles
    })
    battlesToCreate.push(battle)
  }

  if (byeThumbnail) {
    const byeBattle = this.battleRepo.create({
      thumbnailA: byeThumbnail,
      thumbnailB: null, // Set thumbnailB to null for bye battles
      tournament,
      roundNumber,
      createdBy,
      isByeBattle: true, // Mark as a bye battle
      winnerUser: byeThumbnail.creator, // The bye participant is the winner
      status: BattleStatus.COMPLETED, // Bye battles are immediately completed
    })
    battlesToCreate.push(byeBattle)
    this.logger.log(`Created bye battle for ${byeThumbnail.creator.username} and marked as COMPLETED.`)
  }

  this.logger.log(`💾 Saving ${battlesToCreate.length} battles (including byes) to DB...`)
  return this.battleRepo.save(battlesToCreate)
}

async getWinnersOfRound(tournamentId: number, roundNumber: number): Promise<{ thumbnail: Thumbnail; user: User }[]> {
  // Changed tournamentId to number
  const battles = await this.battleRepo.find({
    where: {
      tournament: { id: tournamentId },
      roundNumber,
      status: BattleStatus.COMPLETED, // Only consider completed battles for winners
    },
    relations: ["thumbnailA", "thumbnailB", "thumbnailA.creator", "thumbnailB.creator", "winnerUser"],
  })

  const winners: { thumbnail: Thumbnail; user: User }[] = []
  for (const battle of battles) {
    if (!battle.winnerUser) {
      this.logger.warn(`Completed battle ${battle.id} has no winnerUser. Skipping.`)
      continue
    }

    // For bye battles, the winner is always thumbnailA's creator
    if (battle.isByeBattle) {
      winners.push({
        thumbnail: battle.thumbnailA,
        user: battle.thumbnailA.creator,
      })
    } else {
      // For regular battles, determine winner based on winnerUser
      const winningThumb =
        battle.thumbnailA.creator.id === battle.winnerUser.id ? battle.thumbnailA : battle.thumbnailB
      if (winningThumb) {
        winners.push({
          thumbnail: winningThumb,
          user: winningThumb.creator,
        })
      } else {
        this.logger.warn(`Battle ${battle.id} has a winner but no corresponding thumbnail found.`)
      }
    }
  }
  this.logger.log(`Found ${winners.length} winners for tournament ${tournamentId}, round ${roundNumber}.`)
  return winners
}

async generateNextRoundBattles(tournamentId: number, currentRound: number, createdBy: User): Promise<Battle[]> {
  // Changed tournamentId to number
  this.logger.log(`Generating next round battles for tournament ${tournamentId}, from round ${currentRound}.`)
  const tournament = await this.battleRepo.manager.getRepository(Tournament).findOne({
    where: { id: tournamentId },
  
  })
  if (!tournament) {
    this.logger.error(`Tournament with ID ${tournamentId} not found.`)
    throw new NotFoundException("Tournament not found")
  }

  const nextRound = tournament.rounds?.find((r) => r.roundNumber === currentRound + 1)
  if (!nextRound) {
    this.logger.warn(`Next round (Round #${currentRound + 1}) not found for tournament ${tournamentId}.`)
    throw new BadRequestException("Next round not found")
  }

  const winners = await this.getWinnersOfRound(tournamentId, currentRound)
  if (winners.length < 2) {
    this.logger.log(
      `Not enough winners (${winners.length}) from round ${currentRound} to generate next round battles. Tournament might be concluded.`,
    )
    return []
  }

  const shuffled = shuffle(winners)
  const battlesToCreate: Battle[] = []
  let byeWinner: { thumbnail: Thumbnail; user: User } | null = null

  if (shuffled.length % 2 !== 0) {
    byeWinner = shuffled.pop() as { thumbnail: Thumbnail; user: User } // This winner gets a bye
    this.logger.log(`⚠️ Winner ${byeWinner.user.username} received a bye for this round.`)
  }

  for (let i = 0; i < shuffled.length; i += 2) {
    const thumbnailA = shuffled[i].thumbnail
    const thumbnailB = shuffled[i + 1].thumbnail
    const battle = this.battleRepo.create({
      thumbnailA,
      thumbnailB,
      tournament,
      roundNumber: currentRound + 1,
      createdBy,
      isByeBattle: false,
      status: BattleStatus.PENDING, // Set initial status for regular battles
    })
    battlesToCreate.push(battle)
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
    })
    battlesToCreate.push(byeBattle)
    this.logger.log(`Created bye battle for ${byeWinner.user.username} in next round and marked as COMPLETED.`)
  }

  this.logger.log(`Finished generating ${battlesToCreate.length} battles (including byes) for next round.`)
  return this.battleRepo.save(battlesToCreate)
}

async calculateWinRates(battle: Battle): Promise<Record<number, number>> {
  // Changed key type to number
  const rates: Record<number, number> = {} // Changed key type to number
  const thumbs = [battle.thumbnailA, battle.thumbnailB].filter(Boolean) as Thumbnail[]

  for (const t of thumbs) {
    const total = t.battleCount
    const wins = t.winCount
    rates[t.id] = total === 0 ? 0 : Math.round((wins / total) * 100)
  }
  return rates
}

async getArenaPoints(thumbnailIds: number[]) {
  // Changed thumbnailIds to number[]
  const thumbs = await this.thumbnailRepo.find({
    where: { id: In(thumbnailIds) },
    relations: ["creator"],
  })

  const map: Record<number, number> = {} // Changed key type to number
  for (const t of thumbs) {
    map[t.id] = t.creator.arenaPoints || 0
  }
  return map
}

async getAllBattles(userId?: number) {
  const battles = await this.battleRepo.find({
    relations: {
      thumbnailA: { creator: { youtubeProfile: true } },
      thumbnailB: { creator: { youtubeProfile: true } },
      tournament:  true , 
    },
    order: { createdAt: "ASC" },
  })

  const enrichedBattles: any[] = []
  for (const battle of battles) {
    const roundInfo = battle.tournament.rounds?.find((r) => r.roundNumber === battle.roundNumber)
    if (!roundInfo) {
      this.logger.warn(`No round info found for battle ${battle.id}. Skipping enrichment.`)
      continue
    }

    const roundStart = new Date(roundInfo.roundStartDate)
    const roundEnd = new Date(roundInfo.roundEndDate)

    // Count battles for the current round to accurately calculate timePerBattle
    const roundBattleCount = await this.battleRepo.count({
      where: {
        tournament: { id: battle.tournament.id },
        roundNumber: battle.roundNumber,
      },
    })

    const hasVoted = userId
    ? !!(await this.voteRepo.findOne({
        where: {
          battle: { id: battle.id }, // assuming `battle` is the object, not just id
          voter: { id: userId },
        },
      }))
    : false;
    const vote = userId ? await this.voteService.getUserVoteForBattle(battle.id, userId) : null;

  
    const battlesInThisRound = battles.filter(
      (b) => b.tournament.id === battle.tournament.id && b.roundNumber === battle.roundNumber,
    )
    const battleIndex = battlesInThisRound.findIndex((b) => b.id === battle.id)

    const totalDuration = roundEnd.getTime() - roundStart.getTime()
    const timePerBattle = totalDuration / roundBattleCount

    const startTime = new Date(roundStart.getTime() + timePerBattle * battleIndex)
    const endTime = new Date(startTime.getTime() + timePerBattle)
    const now = new Date()
    const isLive = now >= startTime && now < endTime && battle.status === BattleStatus.PENDING // Only live if pending

    let votesA = 0
    let votesB = 0
    let winRateA = 0
    let winRateB = 0

    if (!battle.isByeBattle && battle.thumbnailB) {
      const voteStats = await this.voteService.getBattleVoteStats(
        battle.id,
        battle.thumbnailA.creator.id,
        battle.thumbnailB.creator.id,
      )
      votesA = voteStats.votesA
      votesB = voteStats.votesB
      winRateA = voteStats.winRateA
      winRateB = voteStats.winRateB
    } else if (battle.isByeBattle) {
      winRateA = 100 // Bye participant automatically wins
      winRateB = 0 // No opponent, so 0% win rate for B
    }

    enrichedBattles.push({
      id: battle.id,
      roundNumber: battle.roundNumber,
      tournament: {
        id: battle.tournament.id,
        title: battle.tournament.title,
        category: battle.tournament.category,
      },
      endTime: endTime.toISOString(),
      isLive: isLive,
      voteInfo: vote
      ? {
          userHasVoted: true,
          votedFor: vote.votedFor, // or vote.votedFor.id, etc.
        }
      : {
          userHasVoted: false,
          votedFor: null,
        },
      thumbnailA: {
        id: battle.thumbnailA.id,
        imageUrl: battle.thumbnailA.imageUrl,
        title: battle.thumbnailA.title || "Untitled",
        arenaPoints: battle.thumbnailA.creator.arenaPoints || 0,
        winRate: winRateA,
        votes: votesA,
        creator: {
          username: battle.thumbnailA.creator.username || battle.thumbnailA.creator.name,
          avatar: battle.thumbnailA.creator.youtubeProfile?.thumbnail || null,
        },
      },
      thumbnailB: battle.thumbnailB
        ? {
            id: battle.thumbnailB.id,
            imageUrl: battle.thumbnailB.imageUrl,
            title: battle.thumbnailB.title || "Untitled",
            arenaPoints: battle.thumbnailB.creator.arenaPoints || 0,
            winRate: winRateB,
            votes: votesB,
            creator: {
              username: battle.thumbnailB.creator.username || battle.thumbnailB.creator.name,
              avatar: battle.thumbnailB.creator.youtubeProfile?.thumbnail || null,
            },
          }
        : null,
      isByeBattle: battle.isByeBattle,
      status: battle.status, // Include battle status
    })
  }

  return {
    liveBattles: enrichedBattles.filter((b) => b.isLive),
    completedBattles: enrichedBattles.filter((b) => !b.isLive),
  }
}

/**
 * Counts the number of battles for a specific tournament and round.
 * @param tournamentId The ID of the tournament.
 * @param roundNumber The round number.
 * @returns The count of battles.
 */
async countBattlesForRound(tournamentId: number, roundNumber: number): Promise<number> {
  // Changed tournamentId to number
  return this.battleRepo.count({
    where: {
      tournament: { id: tournamentId },
      roundNumber: roundNumber,
    },
  })
}

/**
 * Counts the number of COMPLETED battles for a specific tournament and round.
 * A battle is considered completed if it has a winnerUser.
 * @param tournamentId The ID of the tournament.
 * @param roundNumber The round number.
 * @returns The count of completed battles.
 */
async countCompletedBattlesForRound(tournamentId: number, roundNumber: number): Promise<number> {
  // Changed tournamentId to number
  return this.battleRepo.count({
    where: {
      tournament: { id: tournamentId },
      roundNumber: roundNumber,
      status: BattleStatus.COMPLETED, // Check status instead of winnerUser directly
    },
  })
}

/**
 * Retrieves all battles for a specific tournament and round.
 * @param tournamentId The ID of the tournament.
 * @param roundNumber The round number.
 * @returns An array of battles.
 */
async getBattlesForRound(tournamentId: number, roundNumber: number): Promise<Battle[]> {
  // Added this method back
  return this.battleRepo.find({
    where: {
      tournament: { id: tournamentId },
      roundNumber: roundNumber,
    },
    relations: ["thumbnailA", "thumbnailB", "winnerUser", "votes"],
  })
}
}
