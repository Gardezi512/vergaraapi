// <CHANGE> In your leaderboard.module.ts, ensure all entities are imported
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { User } from '../auth/entities/user.entity';
import { Tournament } from '../tournament/entities/tournament.entity';
import { Battle } from '../battle/entities/battle.entity';
import { Thumbnail } from '../thumbnail/entities/thumbnail.entity';
import { ArenaPointsTransaction } from '../awards/entities/arena-points-transaction.entity';
import { LeaderboardService } from './leaderboard.service';


@Module({
    imports: [
      TypeOrmModule.forFeature([
        User,
        Tournament,
        Battle,
        Thumbnail,
        ArenaPointsTransaction
      ])
    ],
    controllers: [LeaderboardController],
    providers: [LeaderboardService],
  })
  export class LeaderboardModule {}