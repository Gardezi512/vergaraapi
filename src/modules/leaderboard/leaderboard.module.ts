// <CHANGE> In your leaderboard.module.ts, ensure all entities are imported
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { User } from '../auth/entities/user.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { Battle } from '../battle/entities/battle.entity';
import { Thumbnail } from '../thumbnail/entities/thumbnail.entity';
import { ArenaPointsTransaction } from '../awards/entities/arena-points-transaction.entity';
import { Vote } from '../vote/entities/vote.entity';
import { UserReward } from '../awards/entities/user-reward.entity';
import { LeaderboardService } from './leaderboard.service';




@Module({
    imports: [
      TypeOrmModule.forFeature([
        User,
        Tournament,
        Battle,
        Thumbnail,
        ArenaPointsTransaction,
        Vote,
        UserReward,
      
      ]),
      
    ],
    controllers: [LeaderboardController],
    providers: [LeaderboardService],
    exports: [LeaderboardService], 
  })
  export class LeaderboardModule {}