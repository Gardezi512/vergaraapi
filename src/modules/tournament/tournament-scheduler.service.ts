import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TournamentService } from './tournament.service';
import { BattleService } from '../battle/battle.service';
import { TournamentStatus } from './entities/tournament.entity';
import { isAfter, isEqual, isBefore } from 'date-fns';
import { User } from 'src/modules/auth/entities/user.entity';
import { BattleStatus } from '../battle/entities/battle.entity';
import { ArenaPointsService } from '../awards/services/arena-points.service';
import { RewardService } from '../awards/services/reward.service';
import { APTransactionType } from '../awards/entities/arena-points-transaction.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class TournamentSchedulerService {
  private readonly logger = new Logger(TournamentSchedulerService.name);
  private readonly MIN_PARTICIPANTS_FOR_TOURNAMENT = 2;

  constructor(
    private readonly tournamentService: TournamentService,
    @Inject(forwardRef(() => BattleService))
    private readonly battleService: BattleService,
    private readonly arenaPointsService: ArenaPointsService,
    private readonly rewardService: RewardService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>, // ✅ now you can query users
    
  ) {}

  /**
   * Cron job to check and start tournaments whose registration has ended
   * and generate battles for Round 1.
   * Runs every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTournamentStart() {
    this.logger.debug('Running tournament start check...');
    const tournaments = await this.tournamentService.findAll();
    const now = new Date();

    // const systemUser: User = {
    //   id: 0,
    //   username: 'System',
    //   email: 'system@example.com',
    //   role: 'Admin',
    //   name: 'System User',
    //   joinedCommunities: [],
    //   password: '',
    //   createdAt: new Date(),
    //   updatedAt: new Date(),
    //   arenaPoints: 0,
    //   elo: 0,
    //   winCount: 0, // 🎯 ADD THIS
    //   lossCount: 0, // 🎯 ADD THIS
    //   battleCount: 0, // 🎯 ADD THIS
    //   tournamentWins: 0, // 🎯 ADD THIS
    //   youtubeProfile: undefined,
    //   thumbnails: [], // 🎯 ADD THIS
    //   votes: [], // 🎯 ADD THIS
    //   tournaments: [], // 🎯 ADD THIS (if you have this relation)
    //   arenaPointsTransactions: [], // 🎯 ADD THIS
    //   rewards: [], // 🎯 ADD THIS
    // } as User;
    for (const tournament of tournaments) {
      const registrationDeadline = tournament.registrationDeadline
        ? new Date(tournament.registrationDeadline)
        : null;
      const firstRound = tournament.rounds?.find((r) => r.roundNumber === 1);
      const firstRoundStartDate = firstRound
        ? new Date(firstRound.roundStartDate)
        : null;

      // Only process tournaments that are PENDING and whose registration deadline has passed
      // AND the first round start date has arrived or passed.
      if (
        tournament.status === TournamentStatus.PENDING &&
        registrationDeadline &&
        (isAfter(now, registrationDeadline) ||
          isEqual(now, registrationDeadline)) && // Registration is closed
        firstRoundStartDate &&
        (isAfter(now, firstRoundStartDate) || isEqual(now, firstRoundStartDate)) // First round should start
      ) {
        this.logger.log(
          `[Scheduler] Processing tournament: ${tournament.title} (ID: ${tournament.id}) for start.`,
        );

        // Check for minimum participants after registration deadline
        if (
          tournament.participants.length < this.MIN_PARTICIPANTS_FOR_TOURNAMENT
        ) {
          this.logger.warn(
            `[Scheduler] Tournament ${tournament.id} cancelled: Insufficient participants (${tournament.participants.length} < ${this.MIN_PARTICIPANTS_FOR_TOURNAMENT}).`,
          );
          await this.tournamentService.updateTournamentStatus(
            tournament.id,
            TournamentStatus.CANCELLED,
          );
          continue;
        }

        // Check if Round 1 battles already exist (idempotency)
        const existingBattlesCount =
          await this.battleService.countBattlesForRound(tournament.id, 1);

                      // Fetch a real system user from DB
let systemUser = await this.userRepo.findOne({
  where: { email: 'system@example.com' },
});

if (!systemUser) {
  // fallback: use tournament creator if system user doesn't exist
  systemUser = tournament.createdBy;
}
  
        if (existingBattlesCount === 0) {
          try {
            this.logger.log(
              `[Scheduler] System user placeholder (${systemUser.id}) found for battle generation.`,
            );
            this.logger.log(
              `[Scheduler] Generating battles for Round 1 of tournament ${tournament.id}`,
            );
          const generatedBattles =
              await this.battleService.generateRandomBattlesForRound(
                tournament.id,
                1,
                systemUser,
              );
            if (generatedBattles.length > 0) {
              this.logger.log(
                `[Scheduler] Successfully generated ${generatedBattles.length} battles for Round 1 of tournament ${tournament.id}.`,
              );
              // Update tournament status to ACTIVE if battles are generated
              await this.tournamentService.updateTournamentStatus(
                tournament.id,
                TournamentStatus.ACTIVE,
              );
              this.logger.log(
                `[Scheduler] Tournament ${tournament.id} status set to ACTIVE.`,
              );
            } else {
              // This case should ideally not happen if MIN_PARTICIPANTS_FOR_TOURNAMENT passes
              // but as a fallback, if no battles are generated for Round 1, conclude.
              this.logger.warn(
                `[Scheduler] No battles generated for Round 1 of tournament ${tournament.id} despite sufficient participants. Concluding tournament.`,
              );
              await this.tournamentService.updateTournamentStatus(
                tournament.id,
                TournamentStatus.CONCLUDED,
              );
              this.logger.log(
                `[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`,
              );
            }
          } catch (error) {
            this.logger.error(
              `[Scheduler] Error generating battles for tournament ${tournament.id}: ${error.message}`,
              error.stack,
            );
            // Optionally, set tournament status to ERROR or CANCELLED if battle generation fails
            await this.tournamentService.updateTournamentStatus(
              tournament.id,
              TournamentStatus.CANCELLED,
            );
            this.logger.log(
              `[Scheduler] Tournament ${tournament.id} status set to CANCELLED due to error.`,
            );
          }
        } else {
          this.logger.log(
            `[Scheduler] Battles for Round 1 of tournament ${tournament.id} already exist.`,
          );
          // Ensure status is ACTIVE if battles exist for Round 1
          if (tournament.status === TournamentStatus.PENDING) {
            await this.tournamentService.updateTournamentStatus(
              tournament.id,
              TournamentStatus.ACTIVE,
            );
            this.logger.log(
              `[Scheduler] Tournament ${tournament.id} status updated to ACTIVE (was PENDING).`,
            );
          }
        }
      }
    }
  }

  /**
   * Cron job to check and advance tournament rounds.
   * Runs every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleRoundAdvancement() {
    this.logger.debug('Running round advancement check...');
    const activeTournaments = (await this.tournamentService.findAll()).filter(
      (t) => t.status === TournamentStatus.ACTIVE,
    );
    const now = new Date();

    // Define a placeholder system user for battle creation
    // const systemUser: User = {
    //   id: 0,
    //   username: 'System',
    //   email: 'system@example.com',
    //   role: 'Admin',
    //   name: 'System User',
    //   joinedCommunities: [],
    //   password: '',
    //   createdAt: new Date(),
    //   updatedAt: new Date(),
    //   arenaPoints: 0,
    //   elo: 0,
    //   winCount: 0, // 🎯 ADD THIS
    //   lossCount: 0, // 🎯 ADD THIS
    //   battleCount: 0, // 🎯 ADD THIS
    //   tournamentWins: 0, // 🎯 ADD THIS
    //   youtubeProfile: undefined,
    //   thumbnails: [], // 🎯 ADD THIS
    //   votes: [], // 🎯 ADD THIS
    //   tournaments: [], // 🎯 ADD THIS (if you have this relation)
    //   arenaPointsTransactions: [], // 🎯 ADD THIS
    //   rewards: [], // 🎯 ADD THIS
    // } as User;

    for (const tournament of activeTournaments) {
      // 🎯 ADD: Safety check for tournament rounds
      if (!tournament.rounds || tournament.rounds.length === 0) {
        this.logger.warn(
          `[Scheduler] Tournament ${tournament.id} has no rounds defined. Skipping.`,
        );
        continue;
      }
      // Find the round that just ended or is ending now
      const currentRound = tournament.rounds?.find(
        (r) =>
          isAfter(now, new Date(r.roundEndDate)) ||
          isEqual(now, new Date(r.roundEndDate)),
      );

      if (currentRound) {
        this.logger.log(
          `[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id} has ended.`,
        );

        // Force resolution of any unresolved battles in the current round
        const battlesInCurrentRound =
          await this.battleService.getBattlesForRound(
            tournament.id,
            currentRound.roundNumber,
          );
        for (const battle of battlesInCurrentRound) {
          if (
            battle.status === BattleStatus.PENDING ||
            battle.status === BattleStatus.ACTIVE
          ) {
            this.logger.log(
              `[Scheduler] Forcing resolution for battle ${battle.id} in Round ${currentRound.roundNumber}.`,
            );
            try {
              await this.battleService.resolveWinnerFromVotes(battle.id);
              this.logger.log(
                `[Scheduler] Battle ${battle.id} resolved successfully.`,
              );
            } catch (resolveError) {
              this.logger.error(
                `[Scheduler] Error resolving battle ${battle.id}: ${resolveError.message}`,
                resolveError.stack,
              );
              // Optionally, handle battles that fail to resolve (e.g., mark as cancelled or log for manual review)
            }
          }
        }

        const totalBattlesInRound =
          await this.battleService.countBattlesForRound(
            tournament.id,
            currentRound.roundNumber,
          );
        const completedBattlesInRound =
          await this.battleService.countCompletedBattlesForRound(
            tournament.id,
            currentRound.roundNumber,
          );

        this.logger.log(
          `[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id}: Total battles: ${totalBattlesInRound}, Completed battles: ${completedBattlesInRound}.`,
        );

        // Check if all battles in the current round are completed
        if (totalBattlesInRound !== completedBattlesInRound) {
          this.logger.warn(
            `[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id} has unresolved battles (${totalBattlesInRound - completedBattlesInRound} remaining). Skipping advancement.`,
          );
          continue; // Do not advance if battles are unresolved
        }

        // 🎯 NEW: Award round completion rewards (ADD THIS ENTIRE SECTION)
        try {
          const roundWinners = await this.battleService.getWinnersOfRound(
            tournament.id,
            currentRound.roundNumber,
          );
          const currentRoundConfig = tournament.rounds?.find(
            (r) => r.roundNumber === currentRound.roundNumber,
          );

          this.logger.log(
            `[Scheduler] Found ${roundWinners.length} winners for round ${currentRound.roundNumber}`,
          );

          // Award arena points for round completion
          if (
            currentRoundConfig?.rewards?.arenaPoints &&
            roundWinners.length > 0
          ) {
            for (const winner of roundWinners) {
              await this.arenaPointsService.awardArenaPoints(
                winner.user.id,
                currentRoundConfig.rewards.arenaPoints,
                APTransactionType.ROUND_COMPLETION,
                `Round ${currentRound.roundNumber} completion - ${tournament.title}`,
                tournament.id,
                undefined,
                currentRound.roundNumber,
              );
          
            }
          }

          // Award round rewards and badges
          if (currentRoundConfig?.rewards && roundWinners.length > 0) {
            await this.rewardService.awardRoundRewards(
              roundWinners,
              currentRoundConfig.rewards,
              tournament.id,
              currentRound.roundNumber,
            );
            this.logger.log(
              `[Scheduler] Awarded round rewards to ${roundWinners.length} winners`,
            );
          }
        } catch (rewardError) {
          this.logger.error(
            `[Scheduler] Error awarding round rewards: ${rewardError.message}`,
            rewardError.stack,
          );
        }

        const nextRoundNumber = currentRound.roundNumber + 1;
        const nextRoundDefinition = tournament.rounds?.find(
          (r) => r.roundNumber === nextRoundNumber,
        );

        if (nextRoundDefinition) {
          // Check if next round start date has arrived
          const nextRoundStartDate = new Date(
            nextRoundDefinition.roundStartDate,
          );

          if (isAfter(nextRoundStartDate, now)) {
            this.logger.log(
              `[Scheduler] Next round ${nextRoundNumber} for tournament ${tournament.id} starts at ${nextRoundStartDate}. Waiting...`,
            );
            continue;
          }

          this.logger.log(
            `[Scheduler] Next round (${nextRoundNumber}) defined for tournament ${tournament.id}.`,
          );
          // Check if battles for the next round already exist (idempotency)
          const existingNextRoundBattlesCount =
            await this.battleService.countBattlesForRound(
              tournament.id,
              nextRoundNumber,
            );

            // Fetch a real system user from DB
let systemUser = await this.userRepo.findOne({
  where: { email: 'system@example.com' },
});

if (!systemUser) {
  // fallback: use tournament creator if system user doesn't exist
  systemUser = tournament.createdBy;
}
          if (existingNextRoundBattlesCount === 0) {
            try {
              this.logger.log(
                `[Scheduler] System user placeholder (${systemUser.id}) found for next round battle generation.`,
              );
              this.logger.log(
                `[Scheduler] Generating battles for Round ${nextRoundNumber} of tournament ${tournament.id}`,
              );
              const generatedBattles =
                await this.battleService.generateNextRoundBattles(
                  tournament.id,
                  currentRound.roundNumber,
                  systemUser,
                );
              // If no battles generated for the next round (e.g., only one winner)
              if (generatedBattles.length === 0) {
                this.logger.log(
                  `[Scheduler] No battles generated for Round ${nextRoundNumber} of tournament ${tournament.id}. Concluding tournament.`,
                );

                // 🎯 NEW: Award tournament winner rewards (SAFE VERSION)
                try {
                  const tournamentWinners =
                    await this.battleService.getWinnersOfRound(
                      tournament.id,
                      currentRound.roundNumber,
                    );

                  if (tournamentWinners.length === 1) {
                    const champion = tournamentWinners[0].user;

                    await this.arenaPointsService.awardArenaPoints(
                      champion.id,
                      100,
                      APTransactionType.TOURNAMENT_WIN,
                      `Tournament "${tournament.title}" victory`,
                      tournament.id,
                    );

                    if (tournament.TournamentRewards?.length > 0) {
                      await this.rewardService.awardTournamentRewards(
                        champion,
                        tournament.TournamentRewards,
                        tournament.id,
                      );
                    }

                    this.logger.log(
                      `[Scheduler] Tournament ${tournament.id} winner: ${champion.username || champion.name}`,
                    );
                  }
                } catch (winnerRewardError) {
                  this.logger.error(
                    `[Scheduler] Error awarding tournament winner rewards: ${winnerRewardError.message}`,
                    winnerRewardError.stack,
                  );
                }

                await this.tournamentService.updateTournamentStatus(
                  tournament.id,
                  TournamentStatus.CONCLUDED,
                );
                this.logger.log(
                  `[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`,
                );
              } else {
                this.logger.log(
                  `[Scheduler] Successfully generated ${generatedBattles.length} battles for Round ${nextRoundNumber} of tournament ${tournament.id}.`,
                );
              }
            } catch (error) {
              this.logger.error(
                `[Scheduler] Error generating battles for next round of tournament ${tournament.id}: ${error.message}`,
                error.stack,
              );
              // Optionally, set tournament status to ERROR or CANCELLED if battle generation fails
              await this.tournamentService.updateTournamentStatus(
                tournament.id,
                TournamentStatus.CANCELLED,
              );
              this.logger.log(
                `[Scheduler] Tournament ${tournament.id} status set to CANCELLED due to error in next round generation.`,
              );
            }
          } else {
            this.logger.log(
              `[Scheduler] Battles for Round ${nextRoundNumber} of tournament ${tournament.id} already exist.`,
            );
          }
        } else {
          // No next round defined, tournament has naturally concluded

          this.logger.log(
            `[Scheduler] Tournament ${tournament.id} has no more rounds defined. Concluding tournament.`,
          );

          // 🎯 NEW: Award tournament winner rewards
          try {
            // Check if tournament has rounds
            if (!tournament.rounds || tournament.rounds.length === 0) {
              this.logger.warn(
                `[Scheduler] Tournament ${tournament.id} has no rounds defined. Skipping winner rewards.`,
              );
            } else {
              const finalRound = Math.max(
                ...tournament.rounds.map((r) => r.roundNumber),
              );
              const tournamentWinners =
                await this.battleService.getWinnersOfRound(
                  tournament.id,
                  finalRound,
                );

              if (tournamentWinners.length === 1) {
                const champion = tournamentWinners[0].user;

                // Award tournament winner arena points
                await this.arenaPointsService.awardArenaPoints(
                  champion.id,
                  100, // Tournament victory bonus
                  APTransactionType.TOURNAMENT_WIN,
                  `Tournament "${tournament.title}" victory`,
                  tournament.id,
                );

                // Award tournament rewards
                if (tournament.TournamentRewards?.length > 0) {
                  await this.rewardService.awardTournamentRewards(
                    champion,
                    tournament.TournamentRewards,
                    tournament.id,
                  );
                }

                this.logger.log(
                  `[Scheduler] Tournament ${tournament.id} winner: ${champion.username || champion.name}`,
                );
              } else {
                this.logger.warn(
                  `[Scheduler] Expected 1 tournament winner, found ${tournamentWinners.length}`,
                );
              }
            }
          } catch (winnerRewardError) {
            this.logger.error(
              `[Scheduler] Error awarding tournament winner rewards: ${winnerRewardError.message}`,
              winnerRewardError.stack,
            );
          }

          await this.tournamentService.updateTournamentStatus(
            tournament.id,
            TournamentStatus.CONCLUDED,
          );
          this.logger.log(
            `[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`,
          );
        }
      }
    }
  }


}

