import { IsNotEmpty, IsNumber, IsString, IsIn } from "class-validator"

export class CreateVoteDto {
  @IsNotEmpty()
  @IsNumber()
  battleId: number

  @IsNotEmpty()
  @IsString()
  @IsIn(["A", "B"])
  votedFor: "A" | "B" // Changed to 'A' or 'B' as per the provided VoteService snippet
}
