import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommunityDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;
}
