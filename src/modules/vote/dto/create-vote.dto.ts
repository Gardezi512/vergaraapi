import { IsEnum, IsInt } from 'class-validator';

export class CreateVoteDto {
    @IsInt()
    battleId: number;

    @IsEnum(['A', 'B'])
    votedFor: 'A' | 'B';
}
