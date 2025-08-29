import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MembershipType } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @IsEnum(MembershipType)
  membershipType: MembershipType;

  @IsOptional()
  @IsString()
  stripeSubscriptionId?: string;

  @IsOptional()
  @IsString()
  stripeCustomerId?: string;
}
