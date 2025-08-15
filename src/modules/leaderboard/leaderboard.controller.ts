import { Controller, Get, Param } from "@nestjs/common"
import { LeaderboardService } from "./leaderboard.service"

@Controller("docs/leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  async getLeaderboard(period = "all-time", category?: string, page = 1, limit = 20) {
    try {
      const data = await this.leaderboardService.getLeaderboardData(period, page, limit)

      return {
        status: true,
        data,
      }
    } catch (error) {
      return {
        status: false,
        message: "Failed to fetch leaderboard",
        error: error.message,
      }
    }
  }

  @Get("progress/:userId")
  async getUserProgress(@Param('userId') userId: number, period = "30d") {
    try {
      const progressData = await this.leaderboardService.getUserProgress(userId, period)

      return {
        status: true,
        data: progressData,
      }
    } catch (error) {
      return {
        status: false,
        message: "Failed to fetch user progress",
        error: error.message,
      }
    }
  }
}
