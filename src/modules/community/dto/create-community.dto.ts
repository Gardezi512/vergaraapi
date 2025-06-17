import { IsNotEmpty, IsOptional, IsString, IsArray, IsNumber } from 'class-validator';

export class CreateCommunityDto {
    @IsNotEmpty()
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsString()
    category: string;

    @IsOptional()
    @IsString()
    profilePic?: string;

    @IsOptional()
    @IsNumber()
    memberLimit?: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    adminSpecialties: string[];
}
