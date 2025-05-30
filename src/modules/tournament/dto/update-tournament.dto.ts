// src/modules/tournament/dto/update-tournament.dto.ts
import {
    IsOptional,
    IsString,
    IsDateString,
    IsInt,
} from 'class-validator';

export class UpdateTournamentDto {
    @IsOptional()
    @IsString()
    title?: string;

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
    @IsInt()
    communityId?: number;
}
