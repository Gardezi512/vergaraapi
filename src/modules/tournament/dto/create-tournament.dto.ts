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

    @IsNotEmpty()
    @IsInt()
    communityId: number;
}
