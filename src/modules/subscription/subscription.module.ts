import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { WebhookService } from './webhook.service';
import { CreditGuard } from './guards/token.guard';
import { Subscription } from './entities/subscription.entity';
import { CreditUsage } from './entities/token-usage.entity';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, CreditUsage, User])],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, WebhookService, CreditGuard],
  exports: [SubscriptionService, CreditGuard],
})
export class SubscriptionModule {}
