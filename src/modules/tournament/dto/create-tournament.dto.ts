// src/modules/tournament/dto/create-tournament.dto.ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  IsEnum,
  IsObject,
  IsArray,
  IsBoolean,
  ValidateNested,
  ValidateIf,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class AccessCriteriaDto {
  @IsOptional()
  @IsInt()
  minSubscribers?: number;

  @IsOptional()
  @IsInt()
  minArenaPoints?: number;

  @IsOptional()
  @IsInt()
  minElo?: number;
}
export class BattleRoundDto {
  roundNumber: number;
  battleName: string;
  description?: string;
  theme?: string;
  focus?: string;
  rewards?: {
    arenaPoints?: number;
    possibleBadges?: string[];
    specialRewards?: string[];
  };
  @ValidateIf((o) => o.roundEndDate)
  @IsDateString()
  roundStartDate: Date;

  @IsDateString()
  roundEndDate: Date;

  requirements?: string;
  numParticipants?: number;
}

class RewardsDto {
  @IsOptional()
  @IsInt()
  arenaPoints?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  possibleBadges?: string[];

  @IsOptional()
  @IsBoolean()
  highlightUI?: boolean;
}

export class CreateTournamentDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: Date;

  @IsNotEmpty()
  @IsDateString()
  endDate: Date;

  @IsOptional()
  @IsEnum(['1v1', '2v2', 'custom'])
  format?: '1v1' | '2v2' | 'custom';

  @IsOptional()
  @IsEnum(['single-elimination', 'bracket', 'leaderboard'])
  structure?: 'single-elimination' | 'bracket' | 'leaderboard';

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: Date;

  @IsOptional()
  @IsInt()
  maxParticipants?: number;

  @IsOptional()
  @IsEnum(['public', 'invite-only', 'restricted'])
  accessType?: 'public' | 'invite-only' | 'restricted';

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessCriteriaDto)
  accessCriteria?: AccessCriteriaDto;

  @IsOptional()
  @IsArray()
  TournamentRewards?: (string | number)[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  rounds?: BattleRoundDto[];

  @IsNotEmpty()
  @IsInt()
  communityId: number;
}
