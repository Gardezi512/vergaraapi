import { Expose } from 'class-transformer';
import { IsEmail, IsOptional, IsString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateUserDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    username?: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    @Expose()
    password?: string;

    @IsOptional()
    @IsIn(['creator', 'Admin'])
    role?: 'creator' | 'Admin';



}
