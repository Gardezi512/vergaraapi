

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
    relations: ["voter", "battle", "votedFor"],
  })

  if (existingVote) {
    this.logger.warn(
      `User ${user.id} has already voted in battle ${battle.id}. Existing vote ID: ${existingVote.id}, voted for thumbnail: ${existingVote.votedFor.id}`,
    )
    throw new BadRequestException("You have already voted on this battle.")
  }

  this.logger.log(`No existing vote found for user ${user.id} in battle ${battle.id}. Proceeding with vote creation.`)

  let votedForThumbnail: Thumbnail
  if (dto.votedFor === "A") {
    votedForThumbnail = battle.thumbnailA
  } else if (dto.votedFor === "B") {
    if (!battle.thumbnailB) {
      throw new BadRequestException("This is a bye battle, cannot vote for Thumbnail B.")
    }
    votedForThumbnail = battle.thumbnailB
  } else {
    throw new BadRequestException("Invalid votedFor option")
  }

  const vote = this.voteRepo.create({
    voter: user,
    battle,
    votedFor: votedForThumbnail, // ✅ Thumbnail, not User
  })

  return this.voteRepo.save(vote)
}

async countVotes(battleId: number) {
  this.logger.log(`Counting votes for battle ${battleId}.`)
  const votes = await this.voteRepo.find({
    where: { battle: { id: battleId } },
    relations: ["votedFor"],
  })
  const count: Record<number, number> = {}
  for (const vote of votes) {
    const thumbnailId = vote.votedFor.id
    count[thumbnailId] = (count[thumbnailId] || 0) + 1
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
    relations: ["votedFor", "votedFor.creator"],
  })

  // count votes where the voted thumbnail's creator matches the given user id
  const receivedVotes = votes.filter((v) => v.votedFor?.creator?.id === userId).length
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
  thumbnailIdA: number,
  thumbnailIdB: number,
): Promise<{ votesA: number; votesB: number; winRateA: number; winRateB: number }> {
  this.logger.log(
    `Fetching battle vote stats for battle ${battleId}, thumbnails A:${thumbnailIdA}, B:${thumbnailIdB}.`,
  )

  const votes = await this.voteRepo.find({
    where: { battle: { id: battleId } },
    relations: ["votedFor"],
  })

  const voteCountMap: Record<number, number> = {}
  for (const vote of votes) {
    const thumbnailId = vote.votedFor.id
    voteCountMap[thumbnailId] = (voteCountMap[thumbnailId] || 0) + 1
  }

  const votesA = voteCountMap[thumbnailIdA] || 0
  const votesB = voteCountMap[thumbnailIdB] || 0
  const totalVotes = votesA + votesB

  const winRateA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 50
  const winRateB = 100 - winRateA

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
    if (vote.votedFor.id === battle.thumbnailA.id) {
      votesA++
    } else if (battle.thumbnailB && vote.votedFor.id === battle.thumbnailB.id) {
      votesB++
    }
  }
  this.logger.log(`Votes for battle ${battleId}: Thumbnail A: ${votesA}, Thumbnail B: ${votesB}`)
  return { votesA, votesB }
}

async getUserVoteForBattle(battleId: number, userId: number): Promise<Vote | null> {
  this.logger.log(`Checking if user ${userId} has voted in battle ${battleId}`)

  const vote = await this.voteRepo.findOne({
    where: {
      battle: { id: battleId },
      voter: { id: userId },
    },
    relations: ["votedFor", "voter", "battle"],
  })

  if (vote) {
    this.logger.log(
      `Found existing vote: User ${userId} voted for thumbnail ${vote.votedFor.id} in battle ${battleId}`,
    )
  } else {
    this.logger.log(`No vote found for user ${userId} in battle ${battleId}`)
  }

  return vote
}

async hasUserVotedInBattle(battleId: number, userId: number): Promise<boolean> {
  this.logger.log(`Checking vote existence for user ${userId} in battle ${battleId}`)

  const count = await this.voteRepo.count({
    where: {
      battle: { id: battleId },
      voter: { id: userId },
    },
  })

  const hasVoted = count > 0
  this.logger.log(
    `Vote check result: User ${userId} ${hasVoted ? "HAS" : "HAS NOT"} voted in battle ${battleId}. Vote count: ${count}`,
  )

  return hasVoted
}
}
