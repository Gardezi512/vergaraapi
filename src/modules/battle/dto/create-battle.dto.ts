import { IsInt } from 'class-validator';

export class CreateBattleDto {
  @IsInt()
  thumbnailAId: number;

  @IsInt()
  thumbnailBId: number;

  @IsInt()
  tournamentId: number;

  @IsInt()
  roundNumber: number;
}
