import { Injectable } from "@nestjs/common"
import { LeaderboardService } from "../leaderboard/leaderboard.service"
import { Repository } from "typeorm"
import { User } from "../auth/entities/user.entity"
import { InjectRepository } from "@nestjs/typeorm"
import { Tournament } from "../tournament/entities/tournament.entity"

interface CreatorFilters {
  category?: string
  sortBy?: string
  search?: string
  // ✅ REMOVED: tournamentCreatorsOnly?: boolean
}

@Injectable()
export class CreatorService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,

    private readonly leaderboardService: LeaderboardService,
  ) {}

async getCreators(filters: CreatorFilters) {
  const queryBuilder = this.userRepo
    .createQueryBuilder("user")
    .leftJoinAndSelect("user.youtubeProfile", "youtube")
    .leftJoinAndSelect("user.rewards", "rewards");

  // ✅ ALWAYS: Only return users who created tournaments (no more conditional logic)
  queryBuilder
    .innerJoin("user.tournaments", "t") // inner join ensures only creators
    .addSelect("COUNT(DISTINCT t.id)", "tournamentCount")
    .groupBy("user.id")
    .addGroupBy("youtube.id")
    .addGroupBy("rewards.id");

  // ✅ Search filter (by username or name)
  if (filters.search) {
    queryBuilder.andWhere(
      "(user.username ILIKE :search OR user.name ILIKE :search)",
      { search: `%${filters.search}%` }
    );
  }

  // switch (filters.sortBy) {
  //   case "thumbnailScore":
  //     queryBuilder.orderBy("user.arenaPoints", "DESC")
  //     break
  //   case "subscribers":
  //     queryBuilder.orderBy("youtube.subscribers", "DESC")
  //     break
  //   default:
  //     queryBuilder.orderBy("user.arenaPoints", "DESC")
  // }
  // Fix sorting logic
switch (filters.sortBy) {
  case "thumbnailScore":
    queryBuilder.orderBy("user.thumbnailScore", "DESC") // ✅ Fix this
    break
  case "subscribers":
    queryBuilder.orderBy("youtube.subscribers", "DESC")
    break
  case "totalBattles":
    queryBuilder.orderBy("user.battleCount", "DESC") // ✅ Add this case
    break
  default:
    queryBuilder.orderBy("user.arenaPoints", "DESC")
}

// Fix category filtering
if (filters.category && filters.category !== "all") {
  queryBuilder.andWhere("LOWER(user.category) = LOWER(:category)", { 
    category: filters.category 
  });
}

  const users = await queryBuilder.getMany()

  const creators = await Promise.all(
    users.map(async (user) => {
      const [userCategory, monthlyGrowth] = await Promise.all([
        this.leaderboardService.getUserCategory(user.id).catch(() => "General"),
        this.leaderboardService.getMonthlyGrowth(user.id).catch(() => "0%"),
      ])

      if (filters.category && filters.category !== "all" && userCategory !== filters.category) {
        return null
      }

      return {
        id: user.id,
        username: user.username || user.name,
        fullName: user.name || "Unknown User",
        avatar: user.avatar || "/default-avatar.png",
        category: userCategory,
        arenaPoints: user.arenaPoints || 0,
        thumbnailScore: this.calculateThumbnailScore(user),
        totalBattles: user.battleCount || 0,
        winRate:
          user.battleCount && user.battleCount > 0
            ? `${Math.round((user.winCount / user.battleCount) * 100)}%`
            : "0%",
        subscribers: user.youtubeProfile?.subscribers?.toString() || "0",
        rewards: (user.rewards || []).slice(0, 4).map((reward) => ({
          id: reward.id,
          title: reward.rewardName,
          earnedAt: reward.createdAt,
        })),
        monthlyGrowth,
        tournamentCount: (user as any).tournamentCount ?? 0,
      }
    }),
  )

  return creators.filter((creator) => creator !== null)
}
  private calculateThumbnailScore(user: User): number {
    const baseScore = user.arenaPoints || 0
    const winRateMultiplier = user.battleCount > 0 ? user.winCount / user.battleCount : 0
    const battleExperienceBonus = Math.min((user.battleCount || 0) * 50, 500)
    const tournamentBonus = (user.tournamentWins || 0) * 100

    const thumbnailScore = Math.round(
      baseScore * (1 + winRateMultiplier * 0.3) + battleExperienceBonus + tournamentBonus,
    )

    return Math.max(thumbnailScore, 0)
  }
}



