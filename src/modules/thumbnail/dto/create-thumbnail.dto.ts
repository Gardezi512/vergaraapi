import { IsNotEmpty, IsString, IsUrl, IsOptional, IsInt } from 'class-validator';

export class CreateThumbnailDto {
    @IsNotEmpty()
    @IsUrl()
    imageUrl: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsInt()
    @IsNotEmpty()
    tournamentId: number;

}
