// import {  Injectable, Logger } from "@nestjs/common"
// import { Cron, CronExpression } from "@nestjs/schedule"
// import { TournamentService } from "./tournament.service"
// import  { BattleService } from "../battle/battle.service"
// import { TournamentStatus } from "./entities/tournament.entity"
// import { isAfter, isEqual } from "date-fns"
// import type { User } from "src/modules/auth/entities/user.entity" // Import User entity for placeholder

// @Injectable()
// export class TournamentSchedulerService {
//   private readonly logger = new Logger(TournamentSchedulerService.name)
//   private readonly MIN_PARTICIPANTS_FOR_TOURNAMENT = 2 // Define minimum participants

//   constructor(
//     private readonly tournamentService: TournamentService,
//     private readonly battleService: BattleService,
//   ) {}

//   /**
//    * Cron job to check and start tournaments whose registration has ended
//    * and generate battles for Round 1.
//    * Runs every minute.
//    */
//   @Cron(CronExpression.EVERY_MINUTE)
//   async handleTournamentStart() {
//     this.logger.debug("Running tournament start check...")
//     const tournaments = await this.tournamentService.findAll()
//     const now = new Date()

//     // Define a placeholder system user for battle creation.
//     // This is used because the 'createdBy' field in the Battle entity expects a User object.
//     // In a production environment, this would typically be a dedicated system user fetched from the DB
//     // or a specific user ID configured via environment variables.
//     const systemUser: User = {
//       id: 0, // Use a valid UUID format for ID if your DB expects it
//       username: "System",
//       email: "system@example.com",
//       role: "Admin", // Or a specific 'System' role
//       password: "", // Dummy, not used for this placeholder
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       arenaPoints: 0,
//       elo: 0,
//       winCount: 0,
//       lossCount: 0,
//       battleCount: 0,
//       youtubeProfile: undefined,
//       communityMemberships: [],
//       tournamentsCreated: [],
//       tournamentsJoined: [],
//       battlesCreated: [],
//       votes: [],
//       thumbnails: [],
//       name: "System User", // Added missing property
//       joinedCommunities: [], // Added missing property
//     } as User // Cast to User to satisfy type, assuming minimal properties are enough for `createdBy`

//     for (const tournament of tournaments) {
//       const registrationDeadline = tournament.registrationDeadline ? new Date(tournament.registrationDeadline) : null
//       const tournamentStartDate = new Date(tournament.startDate)

//       // Only process tournaments that are PENDING and whose registration deadline has passed
//       // AND the tournament start date has arrived or passed.
//       if (
//         tournament.status === TournamentStatus.PENDING &&
//         registrationDeadline &&
//         isAfter(now, registrationDeadline) && // Registration is closed
//         (isAfter(now, tournamentStartDate) || isEqual(now, tournamentStartDate)) // Tournament start date is now or in past
//       ) {
//         this.logger.log(`[Scheduler] Processing tournament: ${tournament.title} (ID: ${tournament.id}) for start.`)

//         // EC1: Check for minimum participants after registration deadline
//         if (tournament.participants.length < this.MIN_PARTICIPANTS_FOR_TOURNAMENT) {
//           this.logger.warn(
//             `[Scheduler] Tournament ${tournament.id} cancelled: Insufficient participants (${tournament.participants.length} < ${this.MIN_PARTICIPANTS_FOR_TOURNAMENT}).`,
//           )
//           await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
//           continue // Move to the next tournament
//         }
//         // The check for odd number of participants is now handled by BattleService creating a bye.

//         // Check if Round 1 battles already exist (idempotency)
//         const existingBattlesCount = await this.battleService.countBattlesForRound(tournament.id, 1)

//         if (existingBattlesCount === 0) {
//           try {
//             this.logger.log(`[Scheduler] System user placeholder (${systemUser.id}) used for battle generation.`)

//             this.logger.log(`[Scheduler] Generating battles for Round 1 of tournament ${tournament.id}`)
//             const generatedBattles = await this.battleService.generateRandomBattlesForRound(
//               tournament.id,
//               1,
//               systemUser, // Use the system user placeholder
//             )

//             if (generatedBattles.length > 0) {
//               this.logger.log(
//                 `[Scheduler] Successfully generated ${generatedBattles.length} battles for Round 1 of tournament ${tournament.id}.`,
//               )
//               // Update tournament status to ACTIVE if battles are generated
//               await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.ACTIVE)
//               this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to ACTIVE.`)
//             } else {
//               // This case should ideally not happen if MIN_PARTICIPANTS_FOR_TOURNAMENT passes
//               // but as a fallback, if no battles are generated for Round 1, conclude.
//               this.logger.warn(
//                 `[Scheduler] No battles generated for Round 1 of tournament ${tournament.id} despite sufficient participants. Concluding tournament.`,
//               )
//               await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
//               this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`)
//             }
//           } catch (error) {
//             this.logger.error(
//               `[Scheduler] Error generating battles for tournament ${tournament.id}: ${error.message}`,
//               error.stack,
//             )
//             // Optionally, set tournament status to ERROR or CANCELLED if battle generation fails
//             await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
//             this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CANCELLED due to error.`)
//           }
//         } else {
//           this.logger.log(`[Scheduler] Battles for Round 1 of tournament ${tournament.id} already exist.`)
//           // Ensure status is ACTIVE if battles exist for Round 1
//           if (tournament.status === TournamentStatus.PENDING) {
//             await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.ACTIVE)
//             this.logger.log(`[Scheduler] Tournament ${tournament.id} status updated to ACTIVE (was PENDING).`)
//           }
//         }
//       }
//     }
//   }

//   /**
//    * Cron job to check and advance tournament rounds.
//    * Runs every minute.
//    */
//   @Cron(CronExpression.EVERY_MINUTE)
//   async handleRoundAdvancement() {
//     this.logger.debug("Running round advancement check...")
//     const activeTournaments = (await this.tournamentService.findAll()).filter(
//       (t) => t.status === TournamentStatus.ACTIVE,
//     )
//     const now = new Date()

//     // Define a placeholder system user for battle creation.
//     const systemUser: User = {
//       id: 0, // Use a valid UUID format for ID if your DB expects it
//       username: "System",
//       email: "system@example.com",
//       role: "Admin",
//       password: "",
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       arenaPoints: 0,
//       elo: 0,
//       winCount: 0,
//       lossCount: 0,
//       battleCount: 0,
//       youtubeProfile: undefined,
//       communityMemberships: [],
//       tournamentsCreated: [],
//       tournamentsJoined: [],
//       battlesCreated: [],
//       votes: [],
//       thumbnails: [],
//       name: "System User", // Added missing property
//       joinedCommunities: [], // Added missing property
//     } as User

//     for (const tournament of activeTournaments) {
//       // Find the round that just ended or is ending now
//       const currentRound = tournament.rounds?.find(
//         (r) => isAfter(now, new Date(r.roundEndDate)) || isEqual(now, new Date(r.roundEndDate)),
//       )

//       if (currentRound) {
//         this.logger.log(`[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id} has ended.`)

//         const totalBattlesInRound = await this.battleService.countBattlesForRound(
//           tournament.id,
//           currentRound.roundNumber,
//         )
//         const completedBattlesInRound = await this.battleService.countCompletedBattlesForRound(
//           tournament.id,
//           currentRound.roundNumber,
//         )
//         this.logger.log(
//           `[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id}: Total battles: ${totalBattlesInRound}, Completed battles: ${completedBattlesInRound}.`,
//         )

//         // EC9: Check if all battles in the current round are completed
//         if (totalBattlesInRound !== completedBattlesInRound) {
//           this.logger.warn(
//             `[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id} has unresolved battles (${totalBattlesInRound - completedBattlesInRound} remaining). Skipping advancement.`,
//           )
//           continue // Do not advance if battles are unresolved
//         }

//         const nextRoundNumber = currentRound.roundNumber + 1
//         const nextRoundDefinition = tournament.rounds?.find((r) => r.roundNumber === nextRoundNumber)

//         if (nextRoundDefinition) {
//           this.logger.log(`[Scheduler] Next round (${nextRoundNumber}) defined for tournament ${tournament.id}.`)
//           // Check if battles for the next round already exist (idempotency)
//           const existingNextRoundBattlesCount = await this.battleService.countBattlesForRound(
//             tournament.id,
//             nextRoundNumber,
//           )

//           if (existingNextRoundBattlesCount === 0) {
//             try {
//               this.logger.log(
//                 `[Scheduler] System user placeholder (${systemUser.id}) used for next round battle generation.`,
//               )

//               this.logger.log(
//                 `[Scheduler] Generating battles for Round ${nextRoundNumber} of tournament ${tournament.id}`,
//               )
//               const generatedBattles = await this.battleService.generateNextRoundBattles(
//                 tournament.id,
//                 currentRound.roundNumber,
//                 systemUser, // Use the system user placeholder
//               )

//               // EC2: If no battles generated for the next round (e.g., only one winner)
//               if (generatedBattles.length === 0) {
//                 this.logger.log(
//                   `[Scheduler] No battles generated for Round ${nextRoundNumber} of tournament ${tournament.id}. Concluding tournament.`,
//                 )
//                 await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
//                 this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`)
//               } else {
//                 this.logger.log(
//                   `[Scheduler] Successfully generated ${generatedBattles.length} battles for Round ${nextRoundNumber} of tournament ${tournament.id}.`,
//                 )
//               }
//             } catch (error) {
//               this.logger.error(
//                 `[Scheduler] Error generating battles for next round of tournament ${tournament.id}: ${error.message}`,
//                 error.stack,
//               )
//               // Optionally, set tournament status to ERROR or CANCELLED if battle generation fails
//               await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
//               this.logger.log(
//                 `[Scheduler] Tournament ${tournament.id} status set to CANCELLED due to error in next round generation.`,
//               )
//             }
//           } else {
//             this.logger.log(
//               `[Scheduler] Battles for Round ${nextRoundNumber} of tournament ${tournament.id} already exist.`,
//             )
//           }
//         } else {
//           // EC3: No next round defined, tournament has naturally concluded
//           this.logger.log(`[Scheduler] Tournament ${tournament.id} has no more rounds defined. Concluding tournament.`)
//           await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
//           this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`)
//         }
//       }
//     }
//   }
// }

import {  forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { TournamentService } from "./tournament.service"
import { BattleService } from "../battle/battle.service"
import { TournamentStatus } from "./entities/tournament.entity"
import { isAfter, isEqual } from "date-fns"
import type { User } from "src/modules/auth/entities/user.entity" // Import User entity for placeholder
import { BattleStatus } from "../battle/entities/battle.entity"

@Injectable()
export class TournamentSchedulerService {
  private readonly logger = new Logger(TournamentSchedulerService.name)

  private readonly MIN_PARTICIPANTS_FOR_TOURNAMENT = 2 // Define minimum participants

  constructor(
    private readonly tournamentService: TournamentService,
    @Inject(forwardRef(() => BattleService)) // ✅ This is the missing part
    private readonly battleService: BattleService,
  ) {}

  /**
   * Cron job to check and start tournaments whose registration has ended
   * and generate battles for Round 1.
   * Runs every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTournamentStart() {
    this.logger.debug("Running tournament start check...")
    const tournaments = await this.tournamentService.findAll()
    const now = new Date()

    // Define a placeholder system user for battle creation
    // In a production environment, you would fetch a dedicated system/admin user here
    // or use a more robust mechanism to represent system-generated actions.
    const systemUser: User = {
      id: 0, // Placeholder ID (ensure this is a valid UUID format if your DB expects it)
      username: "System",
      email: "system@example.com",
      role: "Admin", // Or a specific 'System' role
      name: "System User", // Added missing property
      joinedCommunities: [], // Added missing property
      password: "", // Dummy
      createdAt: new Date(),
      updatedAt: new Date(),
      arenaPoints: 0,
      elo: 0,
      winCount: 0,
      lossCount: 0,
      battleCount: 0,
      youtubeProfile: undefined,
      communityMemberships: [],
      tournamentsCreated: [],
      tournamentsJoined: [],
      battlesCreated: [],
      votes: [],
      thumbnails: [],
    } as User // Cast to User to satisfy type, assuming minimal properties are enough for `createdBy`

    for (const tournament of tournaments) {
      const registrationDeadline = tournament.registrationDeadline ? new Date(tournament.registrationDeadline) : null
      const tournamentStartDate = new Date(tournament.startDate)

      // Only process tournaments that are PENDING and whose registration deadline has passed
      // AND the tournament start date has arrived or passed.
      if (
        tournament.status === TournamentStatus.PENDING &&
        registrationDeadline &&
        isAfter(now, registrationDeadline) && // Registration is closed
        (isAfter(now, tournamentStartDate) || isEqual(now, tournamentStartDate)) // Tournament start date is now or in past
      ) {
        this.logger.log(`[Scheduler] Processing tournament: ${tournament.title} (ID: ${tournament.id}) for start.`)

        // EC1: Check for minimum participants after registration deadline
        if (tournament.participants.length < this.MIN_PARTICIPANTS_FOR_TOURNAMENT) {
          this.logger.warn(
            `[Scheduler] Tournament ${tournament.id} cancelled: Insufficient participants (${tournament.participants.length} < ${this.MIN_PARTICIPANTS_FOR_TOURNAMENT}).`,
          )
          await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
          continue // Move to the next tournament
        }

        // The check for odd number of participants is now handled by BattleService creating a bye.
        // Check if Round 1 battles already exist (idempotency)
        const existingBattlesCount = await this.battleService.countBattlesForRound(tournament.id, 1)
        if (existingBattlesCount === 0) {
          try {
            this.logger.log(`[Scheduler] System user placeholder (${systemUser.id}) found for battle generation.`)
            this.logger.log(`[Scheduler] Generating battles for Round 1 of tournament ${tournament.id}`)
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
              this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to ACTIVE.`)
            } else {
              // This case should ideally not happen if MIN_PARTICIPANTS_FOR_TOURNAMENT passes
              // but as a fallback, if no battles are generated for Round 1, conclude.
              this.logger.warn(
                `[Scheduler] No battles generated for Round 1 of tournament ${tournament.id} despite sufficient participants. Concluding tournament.`,
              )
              await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
              this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`)
            }
          } catch (error) {
            this.logger.error(
              `[Scheduler] Error generating battles for tournament ${tournament.id}: ${error.message}`,
              error.stack,
            )
            // Optionally, set tournament status to ERROR or CANCELLED if battle generation fails
            await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
            this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CANCELLED due to error.`)
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
  }

  /**
   * Cron job to check and advance tournament rounds.
   * Runs every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleRoundAdvancement() {
    this.logger.debug("Running round advancement check...")
    const activeTournaments = (await this.tournamentService.findAll()).filter(
      (t) => t.status === TournamentStatus.ACTIVE,
    )
    const now = new Date()

    // Define a placeholder system user for battle creation
    const systemUser: User = {
      id: 0, // Placeholder ID (ensure this is a valid UUID format if your DB expects it)
      username: "System",
      email: "system@example.com",
      role: "Admin", // Or a specific 'System' role
      name: "System User", // Added missing property
      joinedCommunities: [], // Added missing property
      password: "", // Dummy
      createdAt: new Date(),
      updatedAt: new Date(),
      arenaPoints: 0,
      elo: 0,
      winCount: 0,
      lossCount: 0,
      battleCount: 0,
      youtubeProfile: undefined,
      communityMemberships: [],
      tournamentsCreated: [],
      tournamentsJoined: [],
      battlesCreated: [],
      votes: [],
      thumbnails: [],
    } as User // Cast to User to satisfy type, assuming minimal properties are enough for `createdBy`

    for (const tournament of activeTournaments) {
      // Find the round that just ended or is ending now
      const currentRound = tournament.rounds?.find(
        (r) => isAfter(now, new Date(r.roundEndDate)) || isEqual(now, new Date(r.roundEndDate)),
      )

      if (currentRound) {
        this.logger.log(`[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id} has ended.`)

        // Force resolution of any unresolved battles in the current round
        const battlesInCurrentRound = await this.battleService.getBattlesForRound(
          tournament.id,
          currentRound.roundNumber,
        )
        for (const battle of battlesInCurrentRound) {
          if (battle.status === BattleStatus.PENDING || battle.status === BattleStatus.ACTIVE) {
            this.logger.log(
              `[Scheduler] Forcing resolution for battle ${battle.id} in Round ${currentRound.roundNumber}.`,
            )
            try {
              await this.battleService.resolveWinnerFromVotes(battle.id)
              this.logger.log(`[Scheduler] Battle ${battle.id} resolved successfully.`)
            } catch (resolveError) {
              this.logger.error(
                `[Scheduler] Error resolving battle ${battle.id}: ${resolveError.message}`,
                resolveError.stack,
              )
              // Optionally, handle battles that fail to resolve (e.g., mark as cancelled or log for manual review)
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
        this.logger.log(
          `[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id}: Total battles: ${totalBattlesInRound}, Completed battles: ${completedBattlesInRound}.`,
        )

        // EC9: Check if all battles in the current round are completed
        if (totalBattlesInRound !== completedBattlesInRound) {
          this.logger.warn(
            `[Scheduler] Round ${currentRound.roundNumber} of tournament ${tournament.id} has unresolved battles (${totalBattlesInRound - completedBattlesInRound} remaining). Skipping advancement.`,
          )
          continue // Do not advance if battles are unresolved
        }

        const nextRoundNumber = currentRound.roundNumber + 1
        const nextRoundDefinition = tournament.rounds?.find((r) => r.roundNumber === nextRoundNumber)

        if (nextRoundDefinition) {
          this.logger.log(`[Scheduler] Next round (${nextRoundNumber}) defined for tournament ${tournament.id}.`)
          // Check if battles for the next round already exist (idempotency)
          const existingNextRoundBattlesCount = await this.battleService.countBattlesForRound(
            tournament.id,
            nextRoundNumber,
          )

          if (existingNextRoundBattlesCount === 0) {
            try {
              this.logger.log(
                `[Scheduler] System user placeholder (${systemUser.id}) found for next round battle generation.`,
              )
              this.logger.log(
                `[Scheduler] Generating battles for Round ${nextRoundNumber} of tournament ${tournament.id}`,
              )
              const generatedBattles = await this.battleService.generateNextRoundBattles(
                tournament.id,
                currentRound.roundNumber,
                systemUser,
              )

              // EC2: If no battles generated for the next round (e.g., only one winner)
              if (generatedBattles.length === 0) {
                this.logger.log(
                  `[Scheduler] No battles generated for Round ${nextRoundNumber} of tournament ${tournament.id}. Concluding tournament.`,
                )
                await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
                this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`)
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
              // Optionally, set tournament status to ERROR or CANCELLED if battle generation fails
              await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CANCELLED)
              this.logger.log(
                `[Scheduler] Tournament ${tournament.id} status set to CANCELLED due to error in next round generation.`,
              )
            }
          } else {
            this.logger.log(
              `[Scheduler] Battles for Round ${nextRoundNumber} of tournament ${tournament.id} already exist.`,
            )
          }
        } else {
          // EC3: No next round defined, tournament has naturally concluded
          this.logger.log(`[Scheduler] Tournament ${tournament.id} has no more rounds defined. Concluding tournament.`)
          await this.tournamentService.updateTournamentStatus(tournament.id, TournamentStatus.CONCLUDED)
          this.logger.log(`[Scheduler] Tournament ${tournament.id} status set to CONCLUDED.`)
        }
      }
    }
  }
}

