
import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { User } from "../auth/entities/user.entity"
import { Tournament } from "../tournament/entities/tournament.entity"
import { Battle } from "../battle/entities/battle.entity"
import { Thumbnail } from "../thumbnail/entities/thumbnail.entity"
import { ArenaPointsTransaction } from "../awards/entities/arena-points-transaction.entity"
import { InjectRepository } from "@nestjs/typeorm"

@Injectable()
export class LeaderboardService {
    constructor(
        @InjectRepository(User)
        private userRepo: Repository<User>,
    
        @InjectRepository(Tournament)
        private tournamentRepo: Repository<Tournament>,
    
        @InjectRepository(Battle)
        private battleRepo: Repository<Battle>,
    
        @InjectRepository(Thumbnail)
        private thumbnailRepo: Repository<Thumbnail>,
    
        @InjectRepository(ArenaPointsTransaction)
        private arenaPointsTransactionRepo: Repository<ArenaPointsTransaction>,
  ) {}

  async getUserCategory(userId: number): Promise<string> {
    try {
      const result = await this.tournamentRepo
        .createQueryBuilder("tournament")
        .select("tournament.category", "category")
        .addSelect("COUNT(*)", "count")
        .innerJoin("tournament.participants", "participant")
        .where("participant.id = :userId", { userId })
        .groupBy("tournament.category")
        .orderBy("count", "DESC")
        .limit(1)
        .getRawOne()

      if (result?.category) {
        return result.category
      }

      const alternativeResult = await this.userRepo
        .createQueryBuilder("user")
        .select("tournament.category", "category")
        .addSelect("COUNT(*)", "count")
        .innerJoin("tournament_participants_user", "tp", "tp.userId = user.id")
        .innerJoin("tournament", "tournament", "tournament.id = tp.tournamentId")
        .where("user.id = :userId", { userId })
        .groupBy("tournament.category")
        .orderBy("count", "DESC")
        .limit(1)
        .getRawOne()

      return alternativeResult?.category || "General"
    } catch (error) {
      return "General"
    }
  }

  async getMonthlyGrowth(userId: number): Promise<string> {
    try {
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

      const [currentMonthPoints, lastMonthPoints] = await Promise.all([
        this.arenaPointsTransactionRepo
          .createQueryBuilder("apt")
          .select("COALESCE(SUM(apt.points), 0)", "total")
          .where("apt.user.id = :userId", { userId })
          .andWhere("apt.createdAt >= :start", { start: currentMonthStart })
          .getRawOne(),

        this.arenaPointsTransactionRepo
          .createQueryBuilder("apt")
          .select("COALESCE(SUM(apt.points), 0)", "total")
          .where("apt.user.id = :userId", { userId })
          .andWhere("apt.createdAt >= :start AND apt.createdAt <= :end", {
            start: lastMonthStart,
            end: lastMonthEnd,
          })
          .getRawOne(),
      ])

      const currentTotal = Number.parseInt(currentMonthPoints.total)
      const lastTotal = Number.parseInt(lastMonthPoints.total)

      if (lastTotal === 0) {
        return currentTotal > 0 ? `+${Math.min(currentTotal, 100)}%` : "0%"
      }

      const growth = ((currentTotal - lastTotal) / Math.abs(lastTotal)) * 100
      const cappedGrowth = Math.max(-100, Math.min(100, growth))

      return cappedGrowth > 0 ? `+${Math.round(cappedGrowth)}%` : `${Math.round(cappedGrowth)}%`
    } catch (error) {
      return "0%"
    }
  }
  

  async getPlatformStats() {
    try {
      const [totalCreators, totalBattles, totalThumbnails] = await Promise.all([
        this.userRepo.count(),
        this.battleRepo.count(),
        this.thumbnailRepo.count(),
      ])

      const avgEloResult = await this.userRepo.createQueryBuilder("user").select("AVG(user.elo)", "avgElo").getRawOne()

      return {
        totalCreators,
        totalBattles,
        totalThumbnails,
        avgScore: Math.round(Number.parseFloat(avgEloResult.avgElo) || 1200),
      }
    } catch (error) {
      return {
        totalCreators: 0,
        totalBattles: 0,
        totalThumbnails: 0,
        avgScore: 1200,
      }
    }
  }

  async getLeaderboardData(period: string, page: number, limit: number) {
    const pageNum = Number.parseInt(page.toString()) || 1
    const limitNum = Number.parseInt(limit.toString()) || 20

    // Get users ordered by arena points
    const users = await this.userRepo
      .createQueryBuilder("user")
      .orderBy("user.arenaPoints", "DESC")
      .addOrderBy("user.battleCount", "DESC")
      .addOrderBy("user.id", "ASC")
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum)
      .getMany()

    // Fetch related data separately
    const userIds = users.map((u) => u.id)

    const youtubeProfiles = await this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.youtubeProfile", "youtube")
      .where("user.id IN (:...userIds)", { userIds })
      .getMany()

    const userRewards = await this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.rewards", "rewards")
      .where("user.id IN (:...userIds)", { userIds })
      .getMany()

    const youtubeMap = new Map(youtubeProfiles.map((u) => [u.id, u.youtubeProfile]))
    const rewardsMap = new Map(userRewards.map((u) => [u.id, u.rewards]))

    const leaderboard = await Promise.all(
      users.map(async (user, index) => {
        const [userCategory, monthlyGrowth] = await Promise.all([
          this.getUserCategory(user.id).catch(() => "General"),
          this.getMonthlyGrowth(user.id).catch(() => "0%"),
        ])

        const youtubeProfile = youtubeMap.get(user.id)
        const rewards = rewardsMap.get(user.id) || []

        return {
            
          id: user.id,
          rank: (pageNum - 1) * limitNum + index + 1,
          name: user.name || "Unknown User",
          avatar: user.avatar || "/default-avatar.png",
          thumbnailScore: user.arenaPoints || 0,
          totalBattles: user.battleCount || 0,
          winRate:
            user.battleCount && user.battleCount > 0
              ? `${Math.round((user.winCount / user.battleCount) * 100)}%`
              : "0%",
          subscribers: youtubeProfile?.subscribers?.toString() || "0",
          category: userCategory,
          badges: rewards.map((r) => r.rewardName) || [],
          monthlyGrowth: monthlyGrowth,
        }
      }),
    )

    const stats = await this.getPlatformStats()

    return {
      leaderboard,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: await this.userRepo.count(),
      },
    }
  }

  async getUserProgress(userId: number, period = "30d") {
    // This will fetch user's historical data
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new Error("User not found")
    }

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    // Get arena points history
    const pointsHistory = await this.arenaPointsTransactionRepo
      .createQueryBuilder("apt")
      .where("apt.user.id = :userId", { userId })
      .andWhere("apt.createdAt >= :startDate", { startDate })
      .orderBy("apt.createdAt", "ASC")
      .getMany()

    // Calculate cumulative points over time
    let cumulativePoints = user.arenaPoints - pointsHistory.reduce((sum, t) => sum + t.points, 0)
    const progressData = pointsHistory.map((transaction) => {
      cumulativePoints += transaction.points
      return {
        date: transaction.createdAt,
        points: cumulativePoints,
        change: transaction.points,
      }
    })

    return {
      userId,
      period,
      currentRank: await this.getUserCurrentRank(userId),
      currentPoints: user.arenaPoints,
      progressData,
      summary: {
        totalChange: pointsHistory.reduce((sum, t) => sum + t.points, 0),
        averageDaily:
          pointsHistory.reduce((sum, t) => sum + t.points, 0) /
          Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))),
        bestDay: Math.max(...pointsHistory.map((t) => t.points), 0),
        worstDay: Math.min(...pointsHistory.map((t) => t.points), 0),
      },
    }
  }

private async getUserCurrentRank(userId: number): Promise<number> {
    const userArenaPoints = await this.userRepo
      .createQueryBuilder("user")
      .select("user.arenaPoints")
      .where("user.id = :userId", { userId })
      .getRawOne()

    if (!userArenaPoints) {
      return 1
    }

    const result = await this.userRepo
      .createQueryBuilder("user")
      .select("COUNT(*) + 1", "rank")
      .where("user.arenaPoints > :userPoints", {
        userPoints: userArenaPoints.user_arenaPoints || userArenaPoints.arenaPoints,
      })
      .getRawOne()

    return Number.parseInt(result.rank) || 1
  }
}
