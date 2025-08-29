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
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TournamentSchedulerService {
  private readonly logger = new Logger(TournamentSchedulerService.name);
  private readonly MIN_PARTICIPANTS_FOR_TOURNAMENT = 2;
  private failureCount = 0;
  private readonly MAX_FAILURES = 5;

  constructor(
    private readonly tournamentService: TournamentService,
    @Inject(forwardRef(() => BattleService))
    private readonly battleService: BattleService,
    private readonly arenaPointsService: ArenaPointsService,
    private readonly rewardService: RewardService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>, // ✅ now you can query users
    
  ) {}

  private async safeExecute<T>(operation: () => Promise<T>): Promise<T | null> {
    try {
      const result = await operation();
      this.failureCount = 0; // Reset on success
      return result;
    } catch (error) {
      this.failureCount++;
      this.logger.error(`Operation failed (${this.failureCount}/${this.MAX_FAILURES}): ${error.message}`);
      
      if (this.failureCount >= this.MAX_FAILURES) {
        this.logger.warn('Too many failures, skipping tournament processing');
        return null;
      }
      return null;
    }
  }

  // Instead of multiple array finds, use Map for O(1) lookup
  private createRoundsMap(rounds: any[]) {
    const roundsMap = new Map();
    rounds.forEach(round => {
      roundsMap.set(round.roundNumber, round);
    });
    return roundsMap;
  }

  private performanceMetrics = {
    tournamentsProcessed: 0,
    battlesGenerated: 0,
    averageProcessingTime: 0,
  };

  private updateMetrics(processingTime: number, tournamentsCount: number, battlesCount: number) {
    this.performanceMetrics.tournamentsProcessed += tournamentsCount;
    this.performanceMetrics.battlesGenerated += battlesCount;
    
    // Calculate rolling average
    const currentAvg = this.performanceMetrics.averageProcessingTime;
    this.performanceMetrics.averageProcessingTime = 
      (currentAvg + processingTime) / 2;
    
    this.logger.log(`Performance: ${processingTime}ms, Avg: ${this.performanceMetrics.averageProcessingTime.toFixed(2)}ms`);
  }
  /**
   * Cron job to check and start tournaments whose registration has ended
   * and generate battles for Round 1.
   * Runs every minute.
   */

  @Cron('0 */5 * * * *') // Every 5 minutes instead of every minute
  async handleTournamentStart() {
    const startTime = Date.now();
    const tournaments = await this.tournamentService.findAll()
    const now = new Date() // Single date creation

    // Add this early return if no tournaments
    if (!tournaments || tournaments.length === 0) {
      return;
    }

    for (const tournament of tournaments) {
      // Add early continue for invalid tournaments
      if (!tournament.registrationDeadline || !tournament.rounds || tournament.rounds.length === 0) {
        continue;
      }

      const registrationDeadline = new Date(tournament.registrationDeadline)
      const firstRound = tournament.rounds.find((r) => r.roundNumber === 1)
      
      if (!firstRound || !firstRound.roundStartDate) {
        continue;
      }

      const firstRoundStartDate = new Date(firstRound.roundStartDate)

      // Only process tournaments that are PENDING and whose registration deadline has passed
      // AND the first round start date has arrived or passed.
      if (
        tournament.status === TournamentStatus.PENDING &&
        registrationDeadline &&
        (isAfter(now, registrationDeadline) || isEqual(now, registrationDeadline)) && // Registration is closed
        firstRoundStartDate &&
        (isAfter(now, firstRoundStartDate) || isEqual(now, firstRoundStartDate)) // First round should start
      ) {
        // Check for minimum participants after registration deadline
        if (tournament.participants.length < this.MIN_PARTICIPANTS_FOR_TOURNAMENT) {
          await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
          continue
        }

        // Check if Round 1 battles already exist (idempotency)
        const existingBattlesCount = await this.battleService.countBattlesForRound(tournament.id, 1)

        // Use tournament creator instead of system user
        let systemUser = tournament.createdBy;

        if (!systemUser) {
          // fallback: use tournament creator if system user doesn't exist
          systemUser = tournament.createdBy
        }

        if (existingBattlesCount === 0) {
          try {
            const generatedBattles = await this.battleService.generateRandomBattlesForRound(
              tournament.id,
              1,
              systemUser,
            )
            if (generatedBattles.length > 0) {
              this.logger.log(
                `[Scheduler] Successfully generated ${generatedBattles.length} battles for Round 1 of tournament ${tournament.id}.`,
              )
              // Update tournament status to ACTIVE if battles are generated
              await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.ACTIVE)
            } else {
              // This case should ideally not happen if MIN_PARTICIPANTS_FOR_TOURNAMENT passes
              // but as a fallback, if no battles are generated for Round 1, conclude.
              await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
            }
          } catch (error) {
            // Optionally, set tournament status to ERROR or CANCELLED if battle generation fails
            await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
          }
        } else {
          this.logger.log(`[Scheduler] Battles for Round 1 of tournament ${tournament.id} already exist.`)
          // Ensure status is ACTIVE if battles exist for Round 1
          if (tournament.status === TournamentStatus.PENDING) {
            await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.ACTIVE)
            this.logger.log(`[Scheduler] Tournament ${tournament.id} status updated to ACTIVE (was PENDING).`)
          }
        }
      }
    }
    const endTime = Date.now();
    this.logger.log(`[Scheduler] Tournament start processing completed in ${endTime - startTime}ms for ${tournaments.length} tournaments`);
  }

  /**
   * Cron job to check and advance tournament rounds.
   * Runs every minute.
   */
  @Cron('0 */5 * * * *') // Every 5 minutes instead of every minute
  async handleRoundAdvancement() {
    const activeTournaments = (await this.tournamentService.findAll()).filter(
      (t) => t.status === TournamentStatus.ACTIVE,
    )
    
    // Early exit if no active tournaments
    if (activeTournaments.length === 0) {
      return;
    }

    const now = new Date()

    for (const tournament of activeTournaments) {
      if (!tournament.rounds || tournament.rounds.length === 0) {
        this.logger.warn(`[Scheduler] Tournament ${tournament.id} has no rounds defined. Skipping.`)
        continue
      }

      // Find the round that just ended or is ending now
      const currentRound = tournament.rounds?.find((r) => {
        const roundEndDate = new Date(r.roundEndDate);
        return isAfter(now, roundEndDate) || isEqual(now, roundEndDate);
      });

      if (currentRound) {
        // Force resolution of any unresolved battles in the current round
        const battlesInCurrentRound = await this.battleService.getBattlesForRound(
          tournament.id,
          currentRound.roundNumber,
        )
        for (const battle of battlesInCurrentRound) {
          if (battle.status === BattleStatus.PENDING || battle.status === BattleStatus.ACTIVE) {
            try {
              await this.battleService.resolveWinnerFromVotes(battle.id)
            } catch (resolveError) {
              this.logger.error(
                `[Scheduler] Error resolving battle ${battle.id}: ${resolveError.message}`,
                resolveError.stack,
              )
            }
          }
        }

        const totalBattlesInRound = await this.battleService.countBattlesForRound(
          tournament.id,
          currentRound.roundNumber,
        )
        const completedBattlesInRound = await this.battleService.countCompletedBattlesForRound(
          tournament.id,
          currentRound.roundNumber,
        )

        // Check if all battles in the current round are completed
        if (totalBattlesInRound !== completedBattlesInRound) {
          continue // Do not advance if battles are unresolved
        }

        if (!currentRound.rewardsDistributed) {
          try {
            const roundWinners = await this.battleService.getWinnersOfRound(tournament.id, currentRound.roundNumber)
            const currentRoundConfig = tournament.rounds?.find((r) => r.roundNumber === currentRound.roundNumber)

            // Award arena points for round completion
            if (currentRoundConfig?.rewards?.arenaPoints && roundWinners.length > 0) {
              for (const winner of roundWinners) {
                const winnerBattle = battlesInCurrentRound.find((b) => b.winnerUser?.id === winner.user.id)

                await this.arenaPointsService.awardArenaPoints(
                  winner.user.id,
                  currentRoundConfig.rewards.arenaPoints,
                  APTransactionType.ROUND_COMPLETION,
                  `Round ${currentRound.roundNumber} completion - ${tournament.title}`,
                  tournament.id,
                  winnerBattle?.id, // Now passing the actual battleId
                  currentRound.roundNumber,
                )
              }
            }

            // Award round rewards and badges
            if (currentRoundConfig?.rewards && roundWinners.length > 0) {
              await this.rewardService.awardRoundRewards(
                roundWinners,
                currentRoundConfig.rewards,
                tournament.id,
                currentRound.roundNumber,
              )
            }

            currentRound.rewardsDistributed = true

            // Use tournament creator for the update operation
            let systemUser = tournament.createdBy;

            if (!systemUser) {
              // fallback: use tournament creator if system user doesn't exist
              systemUser = tournament.createdBy
            }

            // Use the correct update method with all required parameters
            await this.tournamentService.update(
              tournament.id,
              {
                rounds: tournament.rounds,
              },
              systemUser,
            )

            this.logger.log(
              `[Scheduler] Round ${currentRound.roundNumber} rewards distributed for tournament ${tournament.id}`,
            )
          } catch (rewardError) {
            this.logger.error(`[Scheduler] Error awarding round rewards: ${rewardError.message}`, rewardError.stack)
          }
        }

        const nextRoundNumber = currentRound.roundNumber + 1
        const nextRoundDefinition = tournament.rounds?.find((r) => r.roundNumber === nextRoundNumber)

        if (nextRoundDefinition) {
          // Check if next round start date has arrived
          const nextRoundStartDate = new Date(nextRoundDefinition.roundStartDate)

          if (isAfter(nextRoundStartDate, now)) {
            this.logger.log(
              `[Scheduler] Next round ${nextRoundNumber} for tournament ${tournament.id} starts at ${nextRoundStartDate}. Waiting...`,
            )
            continue
          }

          // Check if battles for the next round already exist (idempotency)
          const existingNextRoundBattlesCount = await this.battleService.countBattlesForRound(
            tournament.id,
            nextRoundNumber,
          )

          // Use tournament creator instead of system user
          let systemUser = tournament.createdBy;

          if (!systemUser) {
            // fallback: use tournament creator if system user doesn't exist
            systemUser = tournament.createdBy
          }

          if (existingNextRoundBattlesCount === 0) {
            try {
              const generatedBattles = await this.battleService.generateNextRoundBattles(
                tournament.id,
                currentRound.roundNumber,
                systemUser,
              )

              // If no battles generated for the next round (e.g., only one winner)
              if (generatedBattles.length === 0) {
                await this.awardTournamentWinnerRewards(tournament, currentRound.roundNumber)

                await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
              } else {
                this.logger.log(
                  `[Scheduler] Successfully generated ${generatedBattles.length} battles for Round ${nextRoundNumber} of tournament ${tournament.id}.`,
                )
              }
            } catch (error) {
              this.logger.error(
                `[Scheduler] Error generating battles for next round of tournament ${tournament.id}: ${error.message}`,
                error.stack,
              )
              await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
            }
          } else {
            this.logger.log(
              `[Scheduler] Battles for Round ${nextRoundNumber} of tournament ${tournament.id} already exist.`,
            )
          }
        } else {
          // No next round defined, tournament has naturally concluded
          this.logger.log(`[Scheduler] Tournament ${tournament.id} has no more rounds defined. Concluding tournament.`)

          await this.awardTournamentWinnerRewards(tournament, currentRound.roundNumber)

          await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
          this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`)
        }
      }
    }
  }

  private async awardTournamentWinnerRewards(tournament: any, finalRound: number): Promise<void> {
    try {
      if (!tournament.rounds || tournament.rounds.length === 0) {
        this.logger.warn(`[Scheduler] Tournament ${tournament.id} has no rounds defined. Skipping winner rewards.`)
        return
      }

      const tournamentWinners = await this.battleService.getWinnersOfRound(tournament.id, finalRound)

      if (tournamentWinners.length === 1) {
        const champion = tournamentWinners[0].user

        // Award tournament winner arena points
        await this.arenaPointsService.awardArenaPoints(
          champion.id,
          100, // Tournament victory bonus
          APTransactionType.TOURNAMENT_WIN,
          `Tournament "${tournament.title}" victory`,
          tournament.id,
        )

        // Award tournament rewards
        if (tournament.TournamentRewards?.length > 0) {
          await this.rewardService.awardTournamentRewards(champion, tournament.TournamentRewards, tournament.id)
        }

        this.logger.log(
          `[Scheduler] Tournament winner rewards awarded to ${champion.username} for tournament ${tournament.id}`,
        )
      } else {
        this.logger.warn(`[Scheduler] Expected 1 tournament winner, found ${tournamentWinners.length}`)
      }
    } catch (winnerRewardError) {
      this.logger.error(
        `[Scheduler] Error awarding tournament winner rewards: ${winnerRewardError.message}`,
        winnerRewardError.stack,
      )
    }
  }

  // Instead of individual updates, batch them
  private async batchUpdateTournamentStatuses(updates: Array<{id: number, status: TournamentStatus}>) {
    const promises = updates.map(({id, status}) => 
      this.tournamentService.updateTournamentStatus(id, status)
    );
    await Promise.all(promises);
  }
}

