import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UseCreditsDto {
  @IsNumber()
  creditsToUse: number;

  @IsOptional()
  @IsString()
  feature?: string;
}

export class CheckCreditBalanceDto {
  @IsNumber()
  userId: number;
}
