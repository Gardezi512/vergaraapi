import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { UserReward, RewardType } from '../entities/user-reward.entity';

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);

  constructor(
    @InjectRepository(UserReward)
    private readonly userRewardRepo: Repository<UserReward>,
  ) {}

  async awardReward(
    user: User,
    rewardType: RewardType,
    rewardName: string,
    tournamentId: number,
    rewardData?: any,
    roundNumber?: number,
  ): Promise<void> {
    const reward = this.userRewardRepo.create({
      user,
      rewardType,
      rewardName,
      rewardData,
      tournamentId,
      roundNumber,
    });

    await this.userRewardRepo.save(reward);

    this.logger.log(
      `Awarded ${rewardType} "${rewardName}" to user ${user.username || user.name} for tournament ${tournamentId}`
    );
  }

  async awardRoundRewards(
    winners: { user: User }[],
    roundRewards: any,
    tournamentId: number,
    roundNumber: number,
  ): Promise<void> {
    if (!roundRewards) return;

    for (const winner of winners) {
      // Award special rewards
      if (roundRewards.specialRewards?.length > 0) {
        for (const reward of roundRewards.specialRewards) {
          await this.awardReward(
            winner.user,
            RewardType.ROUND_REWARD,
            reward,
            tournamentId,
            { reward },
            roundNumber,
          );
        }
      }

      // Award badges
      if (roundRewards.possibleBadges?.length > 0) {
        for (const badge of roundRewards.possibleBadges) {
          await this.awardReward(
            winner.user,
            RewardType.COMPLETION_BADGE,
            badge,
            tournamentId,
            { badge },
            roundNumber,
          );
        }
      }
    }
  }

  async awardTournamentRewards(
    winner: User,
    tournamentRewards: any[],
    tournamentId: number,
  ): Promise<void> {
    if (!tournamentRewards?.length) return;

    for (const reward of tournamentRewards) {
      await this.awardReward(
        winner,
        RewardType.TOURNAMENT_REWARD,
        typeof reward === 'string' ? reward : reward.name || 'Tournament Reward',
        tournamentId,
        reward,
      );
    }
  }

  async getUserRewards(userId: number): Promise<UserReward[]> {
    return this.userRewardRepo.find({
      where: { user: { id: userId } },
      order: { awardedAt: 'DESC' },
    });
  }
}