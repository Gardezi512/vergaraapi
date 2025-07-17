// src/modules/tournament/dto/create-tournament.dto.ts
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  IsEnum,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BattleRoundDto } from './create-tournament.dto';

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

class RewardsDto {
  @IsOptional()
  @IsInt()
  arenaPoints?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badges?: string[];

  @IsOptional()
  @IsBoolean()
  highlightUI?: boolean;
}

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: Date;

  @IsOptional()
  @IsInt()
  maxParticipants?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @IsEnum(['1v1', '2v2', 'custom'])
  format?: '1v1' | '2v2' | 'custom';

  @IsOptional()
  @IsEnum(['single-elimination', 'bracket', 'leaderboard'])
  structure?: 'single-elimination' | 'bracket' | 'leaderboard';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsEnum(['public', 'invite-only', 'restricted'])
  accessType?: 'public' | 'invite-only' | 'restricted';

  @IsOptional()
  @ValidateNested()
  @Type(() => AccessCriteriaDto)
  accessCriteria?: AccessCriteriaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RewardsDto)
  rewards?: RewardsDto;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  rounds?: BattleRoundDto[];

  @IsOptional()
  @IsInt()
  communityId?: number;
}
