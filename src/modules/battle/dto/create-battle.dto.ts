import { IsEnum, IsInt } from 'class-validator';

export class CreateBattleDto {
    @IsInt()
    thumbnailAId: number;

    @IsInt()
    thumbnailBId: number;
}
