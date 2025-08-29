import { Controller, Get, Param } from "@nestjs/common"
import {LeaderboardService } from "./leaderboard.service"


@Controller("docs/leaderboard")
export class LeaderboardController {
  constructor(private readonly LeaderboardService: LeaderboardService) {}

  @Get()
  async getLeaderboard(period = "all-time", page = 1, limit = 20) {
    try {
      const data = await this.LeaderboardService.getLeaderboardData(
        period as any,
        Number(page),
        Number(limit),
      )

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
  async getUserProgress(@Param('userId') userId: string, period = "30d") {
    try {
      const progressData = await this.LeaderboardService.getUserProgress(Number(userId), period as any)

      return {
        status: true,
        data: progressData,
      }
    } catch (error) {
      return {
        status: false,
        message: "Failed to fetch user progress",
        error: error.message
      }
    }
  }
}
