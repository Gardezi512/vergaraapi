import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import { BattleService } from '../battle/battle.service';
import { User } from '../auth/entities/user.entity';
import { Battle } from '../battle/entities/battle.entity';
import { isAfter, isBefore, isEqual } from 'date-fns';

@Injectable()
export class TournamentSchedulerService {
  private readonly logger = new Logger(TournamentSchedulerService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepo: Repository<Tournament>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly battleService: BattleService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES) // Runs every 5 minutes
  async handleCron() {
    this.logger.log('Running tournament battle generation check...');

    const adminUser = await this.userRepo.findOne({ where: { role: 'Admin' } });
    if (!adminUser) {
      this.logger.warn('No admin user found to create battles. Please ensure an admin user exists.');
      return;
    }

    const tournaments = await this.tournamentRepo.find({
      relations: ['rounds', 'participants'],
    });

    const now = new Date();

    for (const tournament of tournaments) {
      this.logger.log(`Checking tournament: ${tournament.title} (ID: ${tournament.id})`);

      const sortedRounds = [...(tournament.rounds || [])].sort(
        (a, b) => a.roundNumber - b.roundNumber,
      );

      for (let i = 0; i < sortedRounds.length; i++) {
        const currentRound = sortedRounds[i];
        const previousRound = i > 0 ? sortedRounds[i - 1] : null;

        const roundStartDate = new Date(currentRound.roundStartDate);
        const roundEndDate = new Date(currentRound.roundEndDate);

        let roundStatus: 'upcoming' | 'active' | 'completed';
        if (isBefore(now, roundStartDate)) {
          roundStatus = 'upcoming';
        } else if (isAfter(now, roundEndDate)) {
          roundStatus = 'completed';
        } else {
          roundStatus = 'active';
        }

        if (roundStatus !== 'active') {
          this.logger.debug(`Round ${currentRound.roundNumber} is ${roundStatus}, skipping battle generation.`);
          continue;
        }

        const existingBattlesCount = await this.battleService.countBattlesForRound(
          tournament.id,
          currentRound.roundNumber,
        );

        if (existingBattlesCount > 0) {
          this.logger.debug(
            `Battles already exist for Round ${currentRound.roundNumber} of Tournament ${tournament.id}.`,
          );
          continue;
        }

        let generatedBattles: Battle[] = [];

        if (currentRound.roundNumber === 1) {
          // Logic for Round 1
          const registrationDeadline = tournament.registrationDeadline
            ? new Date(tournament.registrationDeadline)
            : null;

          // Only proceed if registrationDeadline is not null AND it's in the past/now
          if (registrationDeadline && (isAfter(now, registrationDeadline) || isEqual(now, registrationDeadline))) {
            this.logger.log(
              `Attempting to generate battles for Round 1 of Tournament ${tournament.id}...`,
            );
            generatedBattles =
              await this.battleService.generateRandomBattlesForRound(
                tournament.id,
                currentRound.roundNumber,
                adminUser,
              );
          } else {
            this.logger.debug(
              `Registration not yet closed for Tournament ${tournament.id} or Round 1 not active.`,
            );
          }
        } else {
          // Logic for subsequent rounds
          if (previousRound) {
            const prevRoundEndDate = new Date(previousRound.roundEndDate);
            const prevRoundBattlesCount = await this.battleService.countBattlesForRound(
              tournament.id,
              previousRound.roundNumber,
            );
            const prevRoundCompletedBattlesCount = await this.battleService.countCompletedBattlesForRound(
              tournament.id,
              previousRound.roundNumber,
            );

            if (
              (isAfter(now, prevRoundEndDate) || isEqual(now, prevRoundEndDate)) &&
              prevRoundBattlesCount > 0 &&
              prevRoundCompletedBattlesCount === prevRoundBattlesCount
            ) {
              this.logger.log(
                `Attempting to generate battles for Round ${currentRound.roundNumber} (after Round ${previousRound.roundNumber} completion) of Tournament ${tournament.id}...`,
              );
              generatedBattles = await this.battleService.generateNextRoundBattles(
                tournament.id,
                previousRound.roundNumber,
                adminUser,
              );
            } else {
              this.logger.debug(
                `Previous Round ${previousRound.roundNumber} not yet completed or active for Tournament ${tournament.id}.`,
              );
            }
          }
        }

        if (generatedBattles.length > 0) {
          this.logger.log(
            `Generated ${generatedBattles.length} battles for Round ${currentRound.roundNumber} of Tournament ${tournament.id}.`,
          );
        } else if (roundStatus === 'active' && existingBattlesCount === 0) {
          this.logger.log(
            `No battles generated for active Round ${currentRound.roundNumber} of Tournament ${tournament.id}. (Likely due to insufficient participants/winners)`,
          );
        }
      }
    }
    this.logger.log('Tournament battle generation check complete.');
  }
}