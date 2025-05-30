// src/modules/tournament/dto/create-tournament.dto.ts
import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsDateString,
    IsInt,
} from 'class-validator';

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

    @IsNotEmpty()
    @IsInt()
    communityId: number;
}
