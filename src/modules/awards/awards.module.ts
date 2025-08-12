import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { ArenaPointsTransaction } from './entities/arena-points-transaction.entity';
import { UserReward } from './entities/user-reward.entity';
import { ArenaPointsService } from './services/arena-points.service';
import { RewardService } from './services/reward.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ArenaPointsTransaction,
      UserReward,
      User, // Import User entity for relationships
    ]),
  ],
  providers: [
    ArenaPointsService,
    RewardService,
  ],
  exports: [
    ArenaPointsService,
    RewardService,
  ],
})
export class AwardsModule {}