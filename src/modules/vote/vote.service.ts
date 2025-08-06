// import {
//   Injectable,
//   BadRequestException,
//   NotFoundException,
// } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { User } from 'src/modules/auth/entities/user.entity';
// import { Battle } from 'src/modules/battle/entities/battle.entity';
// import { Vote } from './entities/vote.entity';
// import { CreateVoteDto } from './dto/create-vote.dto';

// @Injectable()
// export class VoteService {
//   constructor(
//     @InjectRepository(Vote)
//     private readonly voteRepo: Repository<Vote>,

//     @InjectRepository(Battle)
//     private readonly battleRepo: Repository<Battle>,
//   ) {}

//   async vote(user: User, dto: CreateVoteDto): Promise<Vote> {
//     const battle = await this.battleRepo.findOne({
//       where: { id: dto.battleId },
//       relations: [
//         'thumbnailA',
//         'thumbnailB',
//         'thumbnailA.creator',
//         'thumbnailB.creator',
//       ],
//     });

//     if (!battle) throw new NotFoundException('Battle not found');

//     const existing = await this.voteRepo.findOne({
//       where: { voter: { id: user.id }, battle: { id: dto.battleId } },
//     });
//     if (existing)
//       throw new BadRequestException('You already voted on this battle');

//     let votedForUser: User;

//     if (dto.votedFor === 'A') {
//       votedForUser = battle.thumbnailA.creator;
//     } else if (dto.votedFor === 'B') {
//       votedForUser = battle.thumbnailB.creator;
//     } else {
//       throw new BadRequestException('Invalid votedFor option');
//     }

//     const vote = this.voteRepo.create({
//       voter: user,
//       battle,
//       votedFor: votedForUser,
//     });

//     return this.voteRepo.save(vote);
//   }

//   async countVotes(battleId: number) {
//     const votes = await this.voteRepo.find({
//       where: { battle: { id: battleId } },
//       relations: ['votedFor'],
//     });

//     const count: Record<number, number> = {};

//     for (const vote of votes) {
//       const userId = vote.votedFor.id;
//       count[userId] = (count[userId] || 0) + 1;
//     }

//     return count;
//   }

//   // vote.service.ts

// async getUserStats(userId: number) {
//   const totalVotes = await this.voteRepo.count({
//     where: { voter: { id: userId } },
//   });

//   const user = await this.voteRepo.manager.findOne(User, {
//     where: { id: userId },
//     select: ['arenaPoints'], // avoid sending password or sensitive fields
//   });

//   return {
//     arenaPoints: user?.arenaPoints || 0,
//     totalVotes,
//   };
// }

// async getCreatorStats(userId: number) {
//   const battles = await this.battleRepo.find({
//     where: [
//       { thumbnailA: { creator: { id: userId } } },
//       { thumbnailB: { creator: { id: userId } } },
//     ],
//     relations: ['thumbnailA', 'thumbnailB'],
//   });

//   const battleIds = battles.map((b) => b.id);

//   if (battleIds.length === 0) return { receivedVotes: 0 };

//   const votes = await this.voteRepo.find({
//     where: battleIds.map((id) => ({ battle: { id } })),
//     relations: ['votedFor'],
//   });

//   const receivedVotes = votes.filter(
//     (v) => v.votedFor.id === userId
//   ).length;

//   return { receivedVotes };
// }
// async getFullUserStats(userId: number) {
//   const [votingStats, creatorStats] = await Promise.all([
//     this.getUserStats(userId),
//     this.getCreatorStats(userId),
//   ]);

//   return {
//     ...votingStats,
//     ...creatorStats,
//   };
// }
// // battles vote stats

// async getBattleVoteStats(battleId: number, userIdA: number, userIdB: number) {
//   const votes = await this.voteRepo.find({
//     where: { battle: { id: battleId } },
//     relations: ['votedFor'],
//   });

//   const voteCountMap: Record<number, number> = {};
//   for (const vote of votes) {
//     const userId = vote.votedFor.id;
//     voteCountMap[userId] = (voteCountMap[userId] || 0) + 1;
//   }

//   const votesA = voteCountMap[userIdA] || 0;
//   const votesB = voteCountMap[userIdB] || 0;
//   const totalVotes = votesA + votesB;

//   const winRateA = totalVotes > 0 ? (votesA / totalVotes) * 100 : 50;
//   const winRateB = 100 - winRateA;

//   return { votesA, votesB, winRateA, winRateB };
// }



// }

import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { User } from "src/modules/auth/entities/user.entity"
import { Battle, BattleStatus } from "src/modules/battle/entities/battle.entity"
import { Vote } from "./entities/vote.entity"
import type { CreateVoteDto } from "./dto/create-vote.dto"
import { InjectRepository } from "@nestjs/typeorm"
import { Thumbnail } from "../thumbnail/entities/thumbnail.entity"

@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name)

  
  constructor(
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Battle)
    private readonly battleRepo: Repository<Battle>,
    @InjectRepository(Thumbnail)
    private thumbnailRepo: Repository<Thumbnail>,
  ) {}

  async vote(user: User, dto: CreateVoteDto): Promise<Vote> {
    this.logger.log(`Attempting to create vote: ${JSON.stringify(dto)} by user ${user.id}`)

    const battle = await this.battleRepo.findOne({
      where: { id: dto.battleId },
      relations: ["thumbnailA", "thumbnailB", "thumbnailA.creator", "thumbnailB.creator"],
    })

    if (!battle) {
      this.logger.error(`Battle with ID ${dto.battleId} not found.`)
      throw new NotFoundException("Battle not found")
    }

    if (battle.status !== BattleStatus.PENDING && battle.status !== BattleStatus.ACTIVE) {
      this.logger.warn(`Cannot vote on battle ${battle.id} with status ${battle.status}.`)
      throw new BadRequestException(`Cannot vote on a battle that is not PENDING or ACTIVE.`)
    }

    const existingVote = await this.voteRepo.findOne({
      where: { voter: { id: user.id }, battle: { id: dto.battleId } },
    })

    if (existingVote) {
      this.logger.warn(`User ${user.id} has already voted in battle ${battle.id}.`)
      throw new BadRequestException("You have already voted on this battle.")
    }

    let votedForUser: User
    if (dto.votedFor === "A") {
      votedForUser = battle.thumbnailA.creator
    } else if (dto.votedFor === "B") {
      if (!battle.thumbnailB) {
        this.logger.error(`Battle ${battle.id} is a bye battle, cannot vote for B.`)
        throw new BadRequestException("This is a bye battle, cannot vote for Thumbnail B.")
      }
      votedForUser = battle.thumbnailB.creator
    } else {
      this.logger.error(`Invalid votedFor option: ${dto.votedFor}`)
      throw new BadRequestException("Invalid votedFor option")
    }

    const vote = this.voteRepo.create({
      voter: user,
      battle,
      votedFor: votedForUser,
    })

    const savedVote = await this.voteRepo.save(vote)
    this.logger.log(`Vote created successfully for battle ${battle.id} by user ${user.id}.`)
    return savedVote
  }

  async countVotes(battleId: number) {
    this.logger.log(`Counting votes for battle ${battleId}.`)
    const votes = await this.voteRepo.find({
      where: { battle: { id: battleId } },
      relations: ["votedFor"],
    })
    const count: Record<number, number> = {}
    for (const vote of votes) {
      const userId = vote.votedFor.id
      count[userId] = (count[userId] || 0) + 1
    }
    this.logger.log(`Vote counts for battle ${battleId}: ${JSON.stringify(count)}`)
    return count
  }

  async getUserStats(userId: number) {
    this.logger.log(`Fetching user voting stats for user ${userId}.`)
    const totalVotes = await this.voteRepo.count({
      where: { voter: { id: userId } },
    })
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ["arenaPoints", "elo"], // Select only necessary fields
    })

    return {
      arenaPoints: user?.arenaPoints || 0,
      elo: user?.elo || 0,
      totalVotesCast: totalVotes,
    }
  }

  async getCreatorStats(userId: number) {
    this.logger.log(`Fetching creator stats for user ${userId}.`)
    const battles = await this.battleRepo.find({
      where: [{ thumbnailA: { creator: { id: userId } } }, { thumbnailB: { creator: { id: userId } } }],
      relations: ["thumbnailA", "thumbnailB"],
    })

    const battleIds = battles.map((b) => b.id)
    if (battleIds.length === 0) {
      this.logger.log(`No battles found for creator ${userId}.`)
      return { receivedVotes: 0 }
    }

    const votes = await this.voteRepo.find({
      where: battleIds.map((id) => ({ battle: { id } })),
      relations: ["votedFor"],
    })

    const receivedVotes = votes.filter((v) => v.votedFor.id === userId).length
    this.logger.log(`Creator ${userId} received ${receivedVotes} votes across ${battleIds.length} battles.`)
    return { receivedVotes }
  }

  async getFullUserStats(userId: number) {
    this.logger.log(`Fetching full user stats for user ${userId}.`)
    const [votingStats, creatorStats] = await Promise.all([this.getUserStats(userId), this.getCreatorStats(userId)])

    return {
      ...votingStats,
      ...creatorStats,
    }
  }

  async getBattleVoteStats(
    battleId: number,
    userIdA: number,
    userIdB: number,
  ): Promise<{ votesA: number; votesB: number; winRateA: number; winRateB: number }> {
    this.logger.log(`Fetching battle vote stats for battle ${battleId}, users A:${userIdA}, B:${userIdB}.`)
    const votes = await this.voteRepo.find({
      where: { battle: { id: battleId } },
      relations: ["votedFor"],
    })

    const voteCountMap: Record<number, number> = {}
    for (const vote of votes) {
      const userId = vote.votedFor.id
      voteCountMap[userId] = (voteCountMap[userId] || 0) + 1
    }

    const votesA = voteCountMap[userIdA] || 0
    const votesB = voteCountMap[userIdB] || 0
    const totalVotes = votesA + votesB
    const winRateA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50
    const winRateB = 100 - winRateA // Ensure win rates sum to 100%

    this.logger.log(
      `Battle ${battleId} stats: Votes A: ${votesA}, Votes B: ${votesB}, Win Rate A: ${winRateA}%, Win Rate B: ${winRateB}%`,
    )
    return { votesA, votesB, winRateA, winRateB }
  }
  async getVotesForBattle(battleId: number): Promise<{ votesA: number; votesB: number }> {
    this.logger.log(`Fetching votes for battle ${battleId}.`)
    const battle = await this.battleRepo.findOne({
      where: { id: battleId },
      relations: ["thumbnailA", "thumbnailB", "thumbnailA.creator", "thumbnailB.creator"], // Need creators to map votes
    })

    if (!battle) {
      this.logger.error(`Battle with ID ${battleId} not found for vote counting.`)
      throw new NotFoundException(`Battle with ID ${battleId} not found.`)
    }

    if (battle.isByeBattle) {
      return { votesA: 0, votesB: 0 }
    }

    const votes = await this.voteRepo.find({
      where: { battle: { id: battleId } },
      relations: ["votedFor"], // Load votedFor user
    })

    let votesA = 0
    let votesB = 0

    for (const vote of votes) {
      if (vote.votedFor.id === battle.thumbnailA.creator.id) {
        votesA++
      } else if (battle.thumbnailB && vote.votedFor.id === battle.thumbnailB.creator.id) {
        votesB++
      }
    }

    this.logger.log(`Votes for battle ${battleId}: Thumbnail A: ${votesA}, Thumbnail B: ${votesB}`)
    return { votesA, votesB }
  }
}
