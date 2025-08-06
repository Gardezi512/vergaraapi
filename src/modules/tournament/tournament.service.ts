// src/modules/tournament/tournament.service.ts
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BattleRound, Tournament, TournamentStatus } from './entities/tournament.entity';
import { Community } from 'src/modules/community/entities/community.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { User } from '../auth/entities/user.entity';
import { UsersService } from '../auth/auth.service';
import { differenceInDays, isEqual } from 'date-fns';
import { isBefore, isAfter } from 'date-fns';
import { Battle } from '../battle/entities/battle.entity';
import { YouTubeProfile } from '../youtubeprofile/entities/youtube.profile.entity';
import { Thumbnail } from '../thumbnail/entities/thumbnail.entity';
import { Vote } from '../vote/entities/vote.entity';
import { VoteService } from '../vote/vote.service';
import { ThumbnailService } from '../thumbnail/thumbnail.service';

@Injectable()
export class TournamentService {
  private readonly logger = new Logger(TournamentService.name);
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepo: Repository<Tournament>,
    @InjectRepository(Battle)
    private readonly battleRepo: Repository<Battle>,

    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>,
    @InjectRepository(YouTubeProfile)
    private readonly youTubeProfileRepo: Repository<YouTubeProfile>,
    @InjectRepository(Thumbnail)
    private readonly thumbnailRepo: Repository<Thumbnail>,
    private readonly thumbnailService: ThumbnailService, 
    @InjectRepository(Vote)
    private readonly voteRepo: Repository<Vote>,
    private readonly voteService: VoteService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly authService: UsersService,
   
    
  ) {}


private validateRounds(rounds: BattleRound[] | undefined, tournamentStart: Date, tournamentEnd: Date) {
  this.logger.log(`Validating rounds. Total rounds: ${rounds?.length || 0}`)
  if (!rounds?.length) {
    throw new BadRequestException("A tournament must have at least one round.")
  }
  // Every round inside tournament window
  rounds.forEach((r, idx) => {
    const roundStartDate = new Date(r.roundStartDate)
    const roundEndDate = new Date(r.roundEndDate)
    if (isBefore(roundStartDate, tournamentStart) || isAfter(roundEndDate, tournamentEnd)) {
      this.logger.error(
        `Round #${idx + 1} dates (${roundStartDate.toISOString()} - ${roundEndDate.toISOString()}) are outside tournament dates (${tournamentStart.toISOString()} - ${tournamentEnd.toISOString()}).`,
      )
      throw new BadRequestException(`Round #${idx + 1} dates must be between tournament start & end.`)
    }
    if (isAfter(roundStartDate, roundEndDate)) {
      this.logger.error(
        `Round #${idx + 1} start date (${roundStartDate.toISOString()}) is after end date (${roundEndDate.toISOString()}).`,
      )
      throw new BadRequestException(`Round #${idx + 1} start date must be ≤ end date.`)
    }
  })
  // No overlaps - sort by start, then compare neighbours
  const sorted = [...rounds].sort((a, b) => +new Date(a.roundStartDate) - +new Date(b.roundStartDate))
  for (let i = 0; i < sorted.length - 1; i++) {
    const currentRoundEnd = new Date(sorted[i].roundEndDate)
    const nextRoundStart = new Date(sorted[i + 1].roundStartDate)
    if (isBefore(nextRoundStart, currentRoundEnd) || isEqual(nextRoundStart, currentRoundEnd)) {
      this.logger.error(
        `Round #${sorted[i].roundNumber} (ends ${currentRoundEnd.toISOString()}) overlaps with Round #${
          sorted[i + 1].roundNumber
        } (starts ${nextRoundStart.toISOString()}).`,
      )
      throw new BadRequestException(
        `Round #${sorted[i].roundNumber} date overlaps with Round #${sorted[i + 1].roundNumber}.`,
      )
    }
  }
  this.logger.log("Rounds validated successfully.")
}

// // Re-added: Dedicated method for tournament date validation
// private validateTournamentDates(startDate: Date, endDate: Date, registrationDeadline?: Date) {
//   this.logger.log(
//     `Validating tournament dates: Start ${new Date(startDate).toISOString()}, End ${endDate.toISOString()}, Registration Deadline ${
//       registrationDeadline?.toISOString() || "N/A"
//     }`,
//   )
//   if (isAfter(startDate, endDate)) {
//     this.logger.error("Tournament start date cannot be after end date.")
//     throw new BadRequestException("Tournament start date cannot be after end date.")
//   }
//   // NEW LOGIC: Registration deadline can be after start date, but not before it.
//   // It must also be before or on the end date.
//   if (registrationDeadline) {
//     if (isBefore(registrationDeadline, startDate)) {
//       this.logger.error("Registration deadline cannot be before tournament start date.")
//       throw new BadRequestException("Registration deadline cannot be before tournament start date.")
//     }
//     if (isAfter(registrationDeadline, endDate)) {
//       this.logger.error("Registration deadline cannot be after tournament end date.")
//       throw new BadRequestException("Registration deadline cannot be after tournament end date.")
//     }
//   }
//   this.logger.log("Tournament dates validated successfully.")
// }
private validateTournamentDates(
  startDate: Date | string,
  endDate: Date | string,
  registrationDeadline?: Date | string
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const deadline = registrationDeadline ? new Date(registrationDeadline) : null;

  // Validate all parsed dates
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || (deadline && isNaN(deadline.getTime()))) {
    this.logger.error("One or more tournament dates are invalid.");
    throw new BadRequestException("Invalid tournament date(s) provided.");
  }

  // Log all dates in ISO format
  this.logger.log(
    `Validating tournament dates: Start ${start.toISOString()}, End ${end.toISOString()}, Registration Deadline ${deadline?.toISOString() || "N/A"}`
  );

  // Check: Start must not be after End
  if (isAfter(start, end)) {
    this.logger.error("Tournament start date cannot be after end date.");
    throw new BadRequestException("Tournament start date cannot be after end date.");
  }

  // Check: Deadline must not be before Start and must not be after End
  if (deadline) {
    if (isBefore(deadline, start)) {
      this.logger.error("Registration deadline cannot be before tournament start date.");
      throw new BadRequestException("Registration deadline cannot be before tournament start date.");
    }
    if (isAfter(deadline, end)) {
      this.logger.error("Registration deadline cannot be after tournament end date.");
      throw new BadRequestException("Registration deadline cannot be after tournament end date.");
    }
  }

  this.logger.log("Tournament dates validated successfully.");
}


async create(dto: CreateTournamentDto, user: User): Promise<Tournament> {
  this.logger.log(`Attempting to create tournament: ${dto.title}`)
  const community = await this.communityRepo.findOne({
    where: { id: dto.communityId },
  })
  if (!community) {
    this.logger.error(`Community ${dto.communityId} not found.`)
    throw new NotFoundException("Community not found")
  }
  this.logger.log(`Community ${community.title} found.`)

  // Call new date validation
  this.validateTournamentDates(dto.startDate, dto.endDate, dto.registrationDeadline)
  this.validateRounds(dto.rounds, dto.startDate, dto.endDate)

  if (dto.maxParticipants !== undefined && dto.maxParticipants < 2) {
    this.logger.error(`Max participants (${dto.maxParticipants}) must be at least 2.`)
    throw new BadRequestException("Maximum participants must be at least 2 for a tournament.")
  }
  this.logger.log(`Max participants (${dto.maxParticipants}) validated.`)

  const tournament = this.tournamentRepo.create({
    title: dto.title,
    description: dto.description,
    startDate: dto.startDate,
    endDate: dto.endDate,
    format: dto.format , // Added default
    structure: dto.structure , // Added default
    category: dto.category,
    subcategory: dto.subcategory,
    accessType: dto.accessType, // Added default
    accessCriteria: dto.accessCriteria,
    TournamentRewards: dto.TournamentRewards,
    imageUrl: dto.imageUrl,
    rounds: dto.rounds,
    registrationDeadline: dto.registrationDeadline,
    maxParticipants: dto.maxParticipants,
    community,
    createdBy: user,
  })
  this.logger.log(`Tournament object created. Saving to DB...`)
  return this.tournamentRepo.save(tournament)
}

async findAll(): Promise<Tournament[]> {
  this.logger.log("Fetching all tournaments.")
  return this.tournamentRepo.find({
    relations: ["community", "createdBy", "participants"],
  })
}

async findOne(id: number): Promise<any> {
  this.logger.log(`Fetching tournament with ID: ${id}`)
  const tournament = await this.tournamentRepo.findOne({
    where: { id },
    relations: ["community", "participants"], // Ensure rounds are loaded
  })
  if (!tournament) {
    this.logger.error(`Tournament ${id} not found.`)
    throw new NotFoundException("Tournament not found")
  }
  this.logger.log(`Tournament ${tournament.id} found.`)

  const now = new Date()
  const roundsWithDetails =
    tournament.rounds?.map((round) => {
      const start = new Date(round.roundStartDate)
      const end = new Date(round.roundEndDate)
      let status: "upcoming" | "active" | "completed"
      if (isBefore(now, start)) {
        status = "upcoming"
      } else if (isAfter(now, end)) {
        status = "completed"
      } else {
        status = "active"
      }
      return {
        ...round,
        durationDays: differenceInDays(end, start),
        status,
      }
    }) || []
  this.logger.log(`Processed ${roundsWithDetails.length} rounds.`)

  const totalRounds = roundsWithDetails.length
  const completedRounds = roundsWithDetails.filter((r) => r.status === "completed").length
  const pendingRounds = roundsWithDetails.filter((r) => r.status === "upcoming").length

  // get participant count
  const participantCount = tournament.participants.length
  this.logger.log(`Participant count: ${participantCount}`)

  return {
    ...tournament,
    rounds: roundsWithDetails,
    progress: {
      totalRounds,
      completedRounds,
      pendingRounds,
    },
    participantCount,
  }
}

async getJoinedTournaments(userId: number): Promise<Tournament[]> {
  this.logger.log(`Fetching tournaments joined by user ${userId}.`)
  return this.tournamentRepo
    .createQueryBuilder("tournament")
    .leftJoinAndSelect("tournament.participants", "participant")
    .leftJoinAndSelect("tournament.community", "community")
    .leftJoinAndSelect("tournament.createdBy", "createdBy")
    .where("participant.id = :userId", { userId })
    .getMany()
}

async update(id: number, dto: UpdateTournamentDto, user: User): Promise<Tournament> {
  this.logger.log(`Attempting to update tournament ${id}.`)
  const tournament = await this.tournamentRepo.findOne({
    where: { id },
    relations: ["community", "createdBy"], // Load rounds for validation
  })
  if (!tournament) {
    this.logger.error(`Tournament ${id} not found for update.`)
    throw new NotFoundException("Tournament not found")
  }
  this.logger.log(`Tournament ${tournament.id} found for update.`)

  const community = await this.communityRepo.findOne({
    where: { id: dto.communityId ?? tournament.community.id }, // Use existing community ID if not provided
  })
  if (!community) {
    this.logger.error(`Community ${dto.communityId} not found for update.`)
    throw new NotFoundException("Community not found ")
  }
  this.logger.log(`Community ${community.title} found for update.`)

  const isOwner = tournament.createdBy?.id === user.id
  const isAdmin = user.role === "Admin"
  if (!isOwner && !isAdmin) {
    this.logger.warn(`User ${user.id} forbidden to update tournament ${id}. Not owner or admin.`)
    throw new ForbiddenException("You do not have permission to update this tournament.")
  }
  this.logger.log(`User ${user.id} has permission to update tournament ${id}.`)

  const newStart = dto.startDate ?? tournament.startDate
  const newEnd = dto.endDate ?? tournament.endDate
  const newRegistrationDeadline = dto.registrationDeadline ?? tournament.registrationDeadline
  const newRounds = dto.rounds ?? tournament.rounds
  const newMaxParticipants = dto.maxParticipants ?? tournament.maxParticipants

  // Call new date validation
  this.validateTournamentDates(newStart, newEnd, newRegistrationDeadline)
  this.validateRounds(newRounds, newStart, newEnd)

  if (newMaxParticipants !== undefined && newMaxParticipants < 2) {
    this.logger.error(`Max participants (${newMaxParticipants}) must be at least 2 for tournament ${id}.`)
    throw new BadRequestException("Maximum participants must be at least 2 for a tournament.")
  }
  this.logger.log(`Max participants (${newMaxParticipants}) validated for update.`)

  Object.assign(tournament, {
    title: dto.title ?? tournament.title,
    community: community,
    description: dto.description ?? tournament.description,
    startDate: newStart,
    endDate: newEnd,
    format: dto.format ?? tournament.format,
    structure: dto.structure ?? tournament.structure,
    category: dto.category ?? tournament.category,
    subcategory: dto.subcategory ?? tournament.subcategory,
    accessType: dto.accessType ?? tournament.accessType,
    accessCriteria: dto.accessCriteria ?? tournament.accessCriteria,
    TournamentRewards: dto.TournamentRewards ?? tournament.TournamentRewards,
    imageUrl: dto.imageUrl ?? tournament.imageUrl,
    rounds: newRounds,
    registrationDeadline: newRegistrationDeadline,
    maxParticipants: newMaxParticipants,
    status: dto.status ?? tournament.status, // Allow status update via DTO for admin/owner
  })
  this.logger.log(`Tournament ${tournament.id} object updated. Saving to DB...`)
  return this.tournamentRepo.save(tournament)
}

async remove(id: number, user: User): Promise<void> {
  this.logger.log("--- Starting Tournament Deletion Check ---")
  this.logger.log("Attempting to delete Tournament ID:", id)
  this.logger.log("User attempting deletion (full object):", user)

  if (!user || !user.id || !user.role) {
    this.logger.error("Error: User object is incomplete or null.")
    throw new ForbiddenException("Authentication required to perform this action.")
  }

  const tournament = await this.tournamentRepo.findOne({
    where: { id },
    relations: ["createdBy"],
  })
  if (!tournament) {
    this.logger.warn(`Tournament with ID ${id} not found for deletion.`)
    throw new NotFoundException(`Tournament with ID ${id} not found.`)
  }
  this.logger.log("Fetched Tournament (in remove method):", tournament.id, tournament.title)
  this.logger.log("Tournament Creator ID (from tournament.createdBy?.id):", tournament.createdBy?.id)
  this.logger.log(
    "Tournament Creator Username (from tournament.createdBy?.username):",
    tournament.createdBy?.username,
  )

  const isOwner = tournament.createdBy?.id === user.id
  const isAdmin = user.role === "Admin"
  this.logger.log("Is current user the owner (tournament.createdBy?.id === user.id)?", isOwner)
  this.logger.log("Is current user an Admin (user.role === 'Admin')?", isAdmin)

  if (!isOwner && !isAdmin) {
    this.logger.warn(`Deletion forbidden: User ${user.id} is not owner (${tournament.createdBy?.id}) and not Admin.`)
    throw new ForbiddenException("You do not have permission to delete this tournament.")
  }
  this.logger.log("Permission granted. Deleting tournament...")
  await this.tournamentRepo.delete(id)
  this.logger.log(`Tournament ID ${id} successfully deleted.`)
  this.logger.log("--- Tournament Deletion Check Complete ---")
}

// async joinTournament(
//   tournamentId: number,
//   user: User,
//   youtubeAccessToken: string,
//   thumbnailUrl: string,
// ): Promise<{ message: string; thumbnail: Thumbnail }> {
//   this.logger.log(`User ${user.id} attempting to join tournament ${tournamentId}.`)
//   const tournament = await this.tournamentRepo.findOne({
//     where: { id: tournamentId },
//     relations: ["participants"],
//   })
//   if (!tournament) {
//     this.logger.error(`Tournament ${tournamentId} not found for joining.`)
//     throw new NotFoundException("Tournament not found")
//   }
//   this.logger.log(`Tournament ${tournament.id} found. Status: ${tournament.status}`)

//   // EC6: Prevent joining cancelled or concluded tournaments
//   if (tournament.status === TournamentStatus.CANCELLED) {
//     this.logger.warn(`User ${user.id} tried to join cancelled tournament ${tournamentId}.`)
//     throw new BadRequestException("This tournament has been cancelled and cannot be joined.")
//   }
//   if (tournament.status === TournamentStatus.CONCLUDED) {
//     this.logger.warn(`User ${user.id} tried to join concluded tournament ${tournamentId}.`)
//     throw new BadRequestException("This tournament has concluded and cannot be joined.")
//   }
//   this.logger.log(`Tournament ${tournamentId} is not cancelled or concluded.`)

//   // 1. Validate thumbnail
//   if (!thumbnailUrl || thumbnailUrl.trim() === "") {
//     this.logger.error(`Thumbnail URL is missing for user ${user.id} joining tournament ${tournamentId}.`)
//     throw new BadRequestException("A thumbnail URL is required.")
//   }
//   const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(thumbnailUrl)
//   const isImageUrl = /\.(jpeg|jpg|gif|png|webp)$/.test(thumbnailUrl)
//   if (!isYouTubeUrl && !isImageUrl) {
//     this.logger.error(
//       `Invalid thumbnail URL format for user ${user.id} joining tournament ${tournamentId}: ${thumbnailUrl}`,
//     )
//     throw new BadRequestException("Invalid thumbnail URL. Provide a YouTube link or image URL.")
//   }
//   this.logger.log(`Thumbnail URL validated: ${thumbnailUrl}`)

//   // 2. Access checks
//   const now = new Date()
//   const tournamentStartDate = new Date(tournament.startDate)
//   const tournamentRegistrationDeadline = tournament.registrationDeadline
//     ? new Date(tournament.registrationDeadline)
//     : null

//   // EC4: Prevent joining before tournament start date
//   if (isBefore(now, tournamentStartDate)) {
//     this.logger.warn(
//       `User ${user.id} tried to join tournament ${tournamentId} before its start date (${tournamentStartDate.toISOString()}).`,
//     )
//     throw new BadRequestException("This tournament has not started yet.")
//   }
//   this.logger.log(`Tournament ${tournamentId} has started or is currently active.`)

//   // EC4: Prevent joining after registration deadline
//   if (tournamentRegistrationDeadline && isAfter(now, tournamentRegistrationDeadline)) {
//     this.logger.warn(
//       `User ${user.id} tried to join tournament ${tournamentId} after registration deadline (${tournamentRegistrationDeadline.toISOString()}).`,
//     )
//     throw new BadRequestException("Registration for this tournament has closed.")
//   }
//   this.logger.log(`Registration for tournament ${tournamentId} is still open.`)

//   // EC5: Prevent joining a full tournament
//   if (tournament.maxParticipants && tournament.participants.length >= tournament.maxParticipants) {
//     this.logger.warn(
//       `User ${user.id} tried to join full tournament ${tournamentId}. Current participants: ${tournament.participants.length}, Max: ${tournament.maxParticipants}.`,
//     )
//     throw new BadRequestException("This tournament has reached its maximum number of participants.")
//   }
//   this.logger.log(`Tournament ${tournamentId} is not full.`)

//   if (tournament.accessType === 'invite-only') {
//     this.logger.warn(`User ${user.id} tried to join invite-only tournament ${tournamentId}.`)
//     throw new ForbiddenException("This is an invite-only tournament.")
//   }
//   this.logger.log(`Tournament ${tournamentId} is not invite-only.`)

//   if (tournament.accessType === 'restricted') {
//     this.logger.log(`Checking restricted access criteria for user ${user.id} in tournament ${tournamentId}.`)
//     const criteria = tournament.accessCriteria
//     const youtubeData = await this.authService.fetchYouTubeChannelData(youtubeAccessToken)
//     if (!youtubeData) {
//       this.logger.error(`Failed to fetch YouTube data for user ${user.id}.`)
//       throw new BadRequestException("Unable to fetch YouTube data. Please reconnect your account.")
//     }
//     const subscribers = Number.parseInt(youtubeData.subscribers, 10)
//     const arenaPoints = user.arenaPoints ?? 0
//     const elo = user.elo ?? 0

//     if (criteria?.minSubscribers && subscribers < criteria.minSubscribers) {
//       this.logger.warn(
//         `User ${user.id} (subscribers: ${subscribers}) does not meet min subscribers criteria (${criteria.minSubscribers}).`,
//       )
//       throw new BadRequestException(`You need at least ${criteria.minSubscribers} subscribers.`)
//     }
//     if (criteria?.minArenaPoints && arenaPoints < criteria.minArenaPoints) {
//       this.logger.warn(
//         `User ${user.id} (arena points: ${arenaPoints}) does not meet min arena points criteria (${criteria.minArenaPoints}).`,
//       )
//       throw new BadRequestException(`You need at least ${criteria.minArenaPoints} arena points.`)
//     }
//     if (criteria?.minElo && elo < criteria.minElo) {
//       this.logger.warn(`User ${user.id} (ELO: ${elo}) does not meet min ELO criteria (${criteria.minElo}).`)
//       throw new BadRequestException(`You need at least ${criteria.minElo} ELO rating.`)
//     }
//     this.logger.log(`User ${user.id} meets all restricted access criteria.`)
//   }

//   const alreadyJoined = tournament.participants.some((p) => p.id === user.id)
//   if (alreadyJoined) {
//     this.logger.log(`User ${user.id} has already joined tournament ${tournamentId}.`)
//     // Return the existing thumbnail if the user has already joined
//     const existingThumbnail = await this.thumbnailRepo.findOne({
//       where: { creator: { id: user.id }, tournament: { id: tournamentId } },
//     })
//     if (!existingThumbnail) {
//       // This case indicates a data inconsistency: user is a participant but has no thumbnail.
//       // Depending on business logic, you might want to create one or throw an error.
//       // For now, we'll throw an error as it's an unexpected state.
//       this.logger.error(
//         `User ${user.id} is a participant in tournament ${tournamentId} but has no associated thumbnail.`,
//       )
//       throw new BadRequestException(
//         "You have already joined this tournament, but your thumbnail could not be found. Please contact support.",
//       )
//     }
//     return {
//       message: "You have already joined this tournament!",
//       thumbnail: existingThumbnail,
//     }
//   }
//   this.logger.log(`User ${user.id} has not yet joined tournament ${tournamentId}.`)

//   // 3. Save participant
//   tournament.participants.push(user)
//   await this.tournamentRepo.save(tournament)
//   this.logger.log(`User ${user.id} added as participant to tournament ${tournamentId}.`)

//   // 4. Save thumbnail
//   let finalImageUrl: string | undefined
//   if (isImageUrl) {
//     finalImageUrl = thumbnailUrl
//   } else if (isYouTubeUrl) {
//     const videoId = this.extractYouTubeVideoId(thumbnailUrl)
//     if (!videoId) {
//       this.logger.error(`Invalid YouTube URL format for thumbnail: ${thumbnailUrl}`)
//       throw new BadRequestException("Invalid YouTube URL format.")
//     }
//     finalImageUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
//   }
//   this.logger.log(`Final thumbnail image URL: ${finalImageUrl}`)

//   const newThumbnail = this.thumbnailRepo.create({
//     creator: user, // Pass the full user object
//     tournament: tournament, // Pass the full tournament object
//     imageUrl: finalImageUrl, // Use 'url' property as per Thumbnail entity
//     title: `Thumbnail for ${user.username || user.email}`,
//     description: `Submitted for tournament ${tournament.title}`,
//   })
//   const savedThumbnail = await this.thumbnailRepo.save(newThumbnail)
//   this.logger.log(`Thumbnail ${savedThumbnail.id} saved for user ${user.id} in tournament ${tournamentId}.`)

//   return {
//     message: "You have successfully joined the tournament!",
//     thumbnail: savedThumbnail,
//   }
// }
async joinTournament(
  tournamentId: number,
  user: User,
  youtubeAccessToken: string,
  thumbnailUrl: string,
): Promise<{ message: string; thumbnail: Thumbnail }> {
  const tournament = await this.tournamentRepo.findOne({
    where: { id: tournamentId },
    relations: ["participants"],
  });

  if (!tournament) throw new NotFoundException("Tournament not found");

  if ([TournamentStatus.CANCELLED, TournamentStatus.CONCLUDED].includes(tournament.status)) {
    throw new BadRequestException("This tournament cannot be joined.");
  }

  const now = new Date();
  if (isBefore(now, new Date(tournament.startDate))) {
    throw new BadRequestException("Tournament has not started yet.");
  }
  if (tournament.registrationDeadline && isAfter(now, new Date(tournament.registrationDeadline))) {
    throw new BadRequestException("Registration for this tournament has closed.");
  }
  if (tournament.maxParticipants && tournament.participants.length >= tournament.maxParticipants) {
    throw new BadRequestException("This tournament is full.");
  }

  if (tournament.accessType === 'invite-only') {
    throw new ForbiddenException("Invite-only tournament.");
  }

  if (tournament.accessType === 'restricted') {
    const criteria = tournament.accessCriteria;
    const youtubeData = await this.authService.fetchYouTubeChannelData(youtubeAccessToken);
    if (!youtubeData) throw new BadRequestException("Unable to fetch YouTube data.");

    const subscribers = parseInt(youtubeData.subscribers || '0', 10);
    const arenaPoints = user.arenaPoints ?? 0;
    const elo = user.elo ?? 0;

    if (criteria?.minSubscribers && subscribers < criteria.minSubscribers) {
      throw new BadRequestException(`You need at least ${criteria.minSubscribers} subscribers.`);
    }
    if (criteria?.minArenaPoints && arenaPoints < criteria.minArenaPoints) {
      throw new BadRequestException(`You need at least ${criteria.minArenaPoints} arena points.`);
    }
    if (criteria?.minElo && elo < criteria.minElo) {
      throw new BadRequestException(`You need at least ${criteria.minElo} ELO.`);
    }
  }

  const alreadyJoined = tournament.participants.some(p => p.id === user.id);
  if (alreadyJoined) {
    const existingThumbnail = await this.thumbnailRepo.findOne({
      where: { creator: { id: user.id }, tournament: { id: tournamentId } },
    });
    if (!existingThumbnail) {
      throw new BadRequestException("You already joined, but your thumbnail is missing.");
    }
    return {
      message: "You have already joined this tournament!",
      thumbnail: existingThumbnail,
    };
  }

  // ✅ Validate thumbnail
  if (!thumbnailUrl || thumbnailUrl.trim() === "") {
    throw new BadRequestException("A thumbnail URL is required.");
  }

  const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(thumbnailUrl);
  const isImageUrl = /\.(jpeg|jpg|gif|png|webp)$/.test(thumbnailUrl);

  if (!isYouTubeUrl && !isImageUrl) {
    throw new BadRequestException("Invalid thumbnail URL.");
  }

  // ✅ Normalize YouTube link
  let finalImageUrl = thumbnailUrl;
  if (isYouTubeUrl) {
    const videoId = this.extractYouTubeVideoId(thumbnailUrl);
    if (!videoId) throw new BadRequestException("Invalid YouTube URL format.");
    finalImageUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  // ✅ Save thumbnail first
  const savedThumbnail = await this.thumbnailService.create(
    {
      tournamentId,
      imageUrl: finalImageUrl,
      title: `Thumbnail for ${user.username || user.email}`,
    },
    user,
  );

  // ✅ Then add participant
  tournament.participants.push(user);
  await this.tournamentRepo.save(tournament);

  return {
    message: "You have successfully joined the tournament!",
    thumbnail: savedThumbnail,
  };
}


private extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

async getUserDashboard( tournamentId: number,userId: number): Promise<any> {
  this.logger.log(`Fetching user dashboard for tournament ${tournamentId}, user ${userId}.`)
  const tournament = await this.tournamentRepo.findOne({
    where: { id: tournamentId },
    relations: [   "participants",        
     
      "createdBy",
      "community",],
  })
  if (!tournament) {
    this.logger.error(`Tournament ${tournamentId} not found for user dashboard.`)
    throw new NotFoundException("Tournament not found")
  }
  this.logger.log(`Tournament ${tournament.id} found.`)

  const battles = await this.battleRepo.find({
    where: { tournament: { id: tournamentId } },
    relations: ["thumbnailA", "thumbnailB", "thumbnailA.creator", "thumbnailB.creator", "winnerUser"],
  })
  this.logger.log(`Found ${battles.length} battles for tournament ${tournamentId}.`)

  // Fetch real-time vote counts for each battle using the new getVotesForBattle
  const battlesWithRealtimeVotes = await Promise.all(
    battles.map(async (battle) => {
      if (battle.isByeBattle) {
        return { ...battle, votesA: 0, votesB: 0 } // Bye battles have no votes
      }
      const { votesA, votesB } = await this.voteService.getVotesForBattle(battle.id)
      return { ...battle, votesA, votesB }
    }),
  )

  const userBattles = battlesWithRealtimeVotes.filter(
    (b) => b.thumbnailA.creator.id === userId || b.thumbnailB?.creator.id === userId,
  )
  this.logger.log(`Found ${userBattles.length} battles involving user ${userId}.`)

  // Dynamically determine active round based on current time
  const now = new Date()
  const activeRound = tournament.rounds?.find((r) => {
    // Added optional chaining
    const start = new Date(r.roundStartDate)
    const end = new Date(r.roundEndDate)
    return now >= start && now <= end
  })
  this.logger.log(`Active Round: ${activeRound?.roundNumber || "None"}, ${activeRound?.battleName || "N/A"}`)

  let currentBattleInfo: {
    title: string
    description: string
    deadline: string | null
    status: string
    opponent?: string
    battleId?: number
    requiresSubmission?: boolean
    isByeBattle?: boolean
  } | null = null
  let currentBattle: Battle | null = null

  if (activeRound) {
    // Find an active battle for the user that is not yet resolved
    currentBattle = userBattles.find((b) => b?.roundNumber === activeRound?.roundNumber && !b.winnerUser) ?? null
    if (currentBattle) {
      // If it's a bye battle, the opponent is "N/A" or similar
      const opponent = currentBattle.isByeBattle
        ? "N/A (Bye)"
        : currentBattle.thumbnailA.creator.id === userId
          ? currentBattle.thumbnailB?.creator.username || currentBattle.thumbnailB?.creator.name
          : currentBattle.thumbnailA.creator.username || currentBattle.thumbnailA.creator.name
      this.logger.log("🎯 Current Battle Found:", currentBattle.id, "vs", opponent)
      currentBattleInfo = {
        title: `Battle #${currentBattle.roundNumber}`,
        description: activeRound.focus ?? "Tournament battle in progress", // Changed to focus
        deadline: activeRound.roundEndDate ? new Date(activeRound.roundEndDate).toISOString() : null,
        status: "active",
        opponent,
        battleId: currentBattle.id,
        requiresSubmission: !currentBattle.isByeBattle, // Bye battles don't require submission
        isByeBattle: currentBattle.isByeBattle,
      }
    } else {
      this.logger.log("⚠️ No active battle found for user in round", activeRound.roundNumber)
      currentBattleInfo = {
        title: activeRound.battleName ?? `Round #${activeRound.roundNumber}`,
        description: activeRound.focus ?? "Waiting for pairing", // Changed to focus
        deadline: activeRound.roundEndDate ? new Date(activeRound.roundEndDate).toISOString() : null,
        status: "waiting",
        requiresSubmission: false,
      }
    }
  }

  // --- NEW LOGIC FOR NEXT UPCOMING BATTLE ---
  let nextUpcomingBattle: {
    roundNumber: number
    roundName: string
    opponent?: string
    startDate: string
    battleId?: number
    isByeBattle?: boolean
  } | null = null

  // Sort rounds by start date to find the next one chronologically
  const sortedRounds = [...(tournament.rounds || [])].sort(
    (a, b) => new Date(a.roundStartDate).getTime() - new Date(b.roundStartDate).getTime(),
  )

  for (const round of sortedRounds) {
    const roundStartDate = new Date(round.roundStartDate)
    const roundEndDate = new Date(round.roundEndDate)

    // If the round is upcoming or active (but not yet ended)
    if (isBefore(now, roundEndDate) || isEqual(now, roundEndDate)) {
      // Find a battle for the current user in this round that is not yet completed
      const userBattleInRound = userBattles.find((b) => b.roundNumber === round.roundNumber && !b.winnerUser)
      if (userBattleInRound) {
        // Found the next battle for the user
        const opponent = userBattleInRound.isByeBattle
          ? "N/A (Bye)"
          : userBattleInRound.thumbnailA.creator.id === userId
            ? userBattleInRound.thumbnailB?.creator.username || userBattleInRound.thumbnailB?.creator.name
            : userBattleInRound.thumbnailA.creator.username || userBattleInRound.thumbnailA.creator.name
        nextUpcomingBattle = {
          roundNumber: round.roundNumber,
          roundName: round.battleName || `Round ${round.roundNumber}`,
          opponent,
          startDate: roundStartDate.toISOString(),
          battleId: userBattleInRound.id,
          isByeBattle: userBattleInRound.isByeBattle,
        }
        this.logger.log(
          `Next upcoming battle found for user ${userId}: Round ${nextUpcomingBattle.roundNumber} vs ${nextUpcomingBattle.opponent}`,
        )
        break
      } else if (isBefore(now, roundStartDate) && !userBattleInRound) {
        // If the round is upcoming and no battle is assigned yet,
        // it means battles for this round haven't been generated or assigned.
        // We can still inform the user about the upcoming round.
        nextUpcomingBattle = {
          roundNumber: round.roundNumber,
          roundName: round.battleName || `Round ${round.roundNumber}`,
          startDate: roundStartDate.toISOString(),
          // No opponent or battleId yet as battle hasn't been created/assigned
        }
        this.logger.log(
          `Next upcoming round for user ${userId} is ${nextUpcomingBattle.roundNumber}, battles not yet generated.`,
        )
        break
      }
    }
  }
  // --- END NEW LOGIC ---

  const wins = userBattles.filter((b) => b.winnerUser?.id === userId).length
  const losses = userBattles.filter(
    (b) =>
      b.winnerUser &&
      b.winnerUser.id !== userId &&
      (b.thumbnailA.creator.id === userId || b.thumbnailB?.creator.id === userId),
  ).length
  const totalBattles = userBattles.length
  const winRate = totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0
  this.logger.log(
    `User ${userId} stats: Wins ${wins}, Losses ${losses}, Total Battles ${totalBattles}, Win Rate ${winRate}%`,
  )

  const userEntity = await this.userRepo.findOneOrFail({ where: { id: userId } })
  const participantIds = tournament.participants.map((p) => p.id)
  const leaderboardUsers = await this.userRepo.find({
    where: { id: In(participantIds) },
    order: { arenaPoints: "DESC" },
    take: 20,
    relations: ["youtubeProfile"], // Load youtubeProfile for avatar
  })
  this.logger.log(`Generated leaderboard for ${leaderboardUsers.length} participants.`)

  const leaderboard = leaderboardUsers.map((u, index) => ({
    rank: index + 1,
    username: u.username || u.name,
    avatar: u.youtubeProfile?.thumbnail || null,
    wins: battlesWithRealtimeVotes.filter((b) => b.winnerUser?.id === u.id).length,
    losses: battlesWithRealtimeVotes.filter(
      (b) =>
        b.winnerUser &&
        b.winnerUser.id !== u.id &&
        (b.thumbnailA.creator.id === u.id || b.thumbnailB?.creator.id === u.id),
    ).length,
    score: u.arenaPoints,
    isCurrentUser: u.id === userId,
  }))

  const userStats = {
    rank: leaderboard.find((entry) => entry.isCurrentUser),
    wins,
    losses,
    winRate,
    arenaPoints: userEntity.arenaPoints,
    battlesCompleted: wins + losses,
    totalBattles,
  }
  this.logger.log(`User stats for dashboard: ${JSON.stringify(userStats)}`)

  const upcomingBattles = userBattles
    .filter((b) => !b.winnerUser)
    .map((b) => ({
      round: b.roundNumber,
      opponent: b.isByeBattle
        ? "N/A (Bye)"
        : b.thumbnailA.creator.id === userId
          ? b.thumbnailB?.creator.username || b.thumbnailB?.creator.name
          : b.thumbnailA.creator.username || b.thumbnailA.creator.name,
      date: b.createdAt.toDateString(),
      status: "active",
      isByeBattle: b.isByeBattle,
    }))
  this.logger.log(`Upcoming battles for user ${userId}: ${upcomingBattles.length}`)

  const computedRounds = await Promise.all(
    (tournament.rounds ?? []).map(async (round) => {
      const start = new Date(round.roundStartDate)
      const end = new Date(round.roundEndDate)
      let status: "upcoming" | "active" | "completed"
      if (now < start) {
        status = "upcoming"
      } else if (now > end) {
        status = "completed"
      } else {
        status = "active"
      }
      const battleCount = await this.battleRepo.count({
        where: {
          tournament: { id: tournament.id },
          roundNumber: round.roundNumber,
        },
      })
      this.logger.log(`🔄 Round ${round.roundNumber}: ${status} | Battles: ${battleCount}`)
      return {
        ...round,
        status,
        durationDays: differenceInDays(end, start),
        hasBattles: battleCount > 0,
      }
    }),
  )
  this.logger.log(`Computed details for ${computedRounds.length} rounds.`)

  return {
    id: tournament.id,
    title: tournament.title,
    description: tournament.description,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    format: tournament.format,
    structure: tournament.structure,
    category: tournament.category,
    subcategory: tournament.subcategory,
    accessType: tournament.accessType,
    accessCriteria: tournament.accessCriteria,
    TournamentRewards: tournament.TournamentRewards ?? [],
    imageUrl: tournament.imageUrl,
    registrationDeadline: tournament.registrationDeadline,
    maxParticipants: tournament.maxParticipants,
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
    participantCount: tournament.participants?.length ?? 0,
    community: tournament.community,
    rounds: computedRounds,
    progress: {
      totalRounds: computedRounds.length,
      completedRounds: computedRounds.filter((r) => r.status === "completed").length,
      pendingRounds: computedRounds.filter((r) => r.status === "upcoming").length,
    },
    participants: tournament.participants,
    battles: battlesWithRealtimeVotes, // Return battles with real-time vote counts
    currentBattle: currentBattleInfo,
    userStats,
    leaderboard,
    upcomingBattles,
    status: tournament.status,
    nextUpcomingBattle,
  }
}

async updateTournamentStatus(tournamentId: number, newStatus: TournamentStatus): Promise<Tournament> {
  this.logger.log(`Attempting to update tournament ${tournamentId} status to ${newStatus}.`)
  const tournament = await this.tournamentRepo.findOne({
    where: { id: tournamentId },
  })
  if (!tournament) {
    this.logger.error(`Tournament ${tournamentId} not found for status update.`)
    throw new NotFoundException(`Tournament with ID ${tournamentId} not found`)
  }
  this.logger.log(`Tournament ${tournament.id} status changing from ${tournament.status} to ${newStatus}.`)
  tournament.status = newStatus
  return this.tournamentRepo.save(tournament)
}
}
