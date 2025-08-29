import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Tournament } from "../tournament/entities/tournament.entity"
import { User } from "../auth/entities/user.entity"
import { Vote } from "../vote/entities/vote.entity"
import  { BattleService } from "../battle/battle.service"
import { TournamentStatus } from "../tournament/entities/tournament.entity"
import { InjectRepository } from "@nestjs/typeorm"

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentRepo: Repository<Tournament>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(Vote)
    private voteRepo: Repository<Vote>,

    private battleService: BattleService,
  ) {}

  async getHomePageData() {
    const [activeTournaments, votesToday, activeCreators, liveBattlesData] = await Promise.all([
      this.getActiveTournamentsCount(),
      this.getVotesTodayCount(),
      this.getActiveCreatorsCount(),
      this.getLiveBattles(),
    ])

    return {
      stats: {
        activeTournaments,
        votesToday,
        activeCreators,
      },
      liveBattles: liveBattlesData,
    }
  }

  private async getActiveTournamentsCount(): Promise<number> {
    try {
      return await this.tournamentRepo.count({
        where: { status: TournamentStatus.ACTIVE },
      })
    } catch (error) {
      return 0
    }
  }

  private async getVotesTodayCount(): Promise<string> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const count = await this.voteRepo
        .createQueryBuilder("vote")
        .where("vote.createdAt >= :today", { today })
        .andWhere("vote.createdAt < :tomorrow", { tomorrow })
        .getCount()

      if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`
      }
      return count.toString()
    } catch (error) {
      return "0"
    }
  }

  private async getActiveCreatorsCount(): Promise<string> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const count = await this.userRepo
        .createQueryBuilder("user")
        .innerJoin("tournament_participants_user", "tp", "tp.userId = user.id")
        .innerJoin("tournament", "t", "t.id = tp.tournamentId")
        .where("t.createdAt >= :thirtyDaysAgo", { thirtyDaysAgo })
        .getCount()

      if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`
      }
      return count.toString()
    } catch (error) {
      return "0"
    }
  }

  private async getLiveBattles() {
    try {
      const battlesData = await this.battleService.getAllBattles()

      return battlesData.liveBattles.slice(0, 2).map((battle) => ({
        id: battle.id,
        tournament: {
          id: battle.tournament.id,
          title: battle.tournament.title,
          category: battle.tournament.category,
        },
        thumbnailA: {
          id: battle.thumbnailA.id,
          imageUrl: battle.thumbnailA.imageUrl,
          title: battle.thumbnailA.title,
          creator: {
            username: battle.thumbnailA.creator.username,
            avatar: battle.thumbnailA.creator.avatar,
          },
        },
        thumbnailB: battle.thumbnailB
          ? {
              id: battle.thumbnailB.id,
              imageUrl: battle.thumbnailB.imageUrl,
              title: battle.thumbnailB.title,
              creator: {
                username: battle.thumbnailB.creator.username,
                avatar: battle.thumbnailB.creator.avatar,
              },
            }
          : null,
        endTime: battle.endTime,
        voteInfo: {
          votesA: battle.voteInfo.votesA,
          votesB: battle.voteInfo.votesB,
          winRateA: battle.voteInfo.winRateA,
          winRateB: battle.voteInfo.winRateB,
        },
      }))
    } catch (error) {
      return []
    }
  }
}
