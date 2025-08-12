import { IsInt, IsNotEmpty, IsOptional } from "class-validator"

export class CreateBattleDto {
  @IsInt()
  @IsNotEmpty()
  thumbnailAId: number

 
  @IsInt()
  @IsOptional() // Made optional for bye battles
  thumbnailBId?: number // Optional for bye battles

  @IsInt()
  @IsNotEmpty()
  tournamentId: number

  @IsInt()
  @IsNotEmpty()
  roundNumber: number
}
