import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/db.module';
import { UsersModule } from './modules/auth/auth.module';
import { CommunityModule } from './modules/community/community.module';
import { TournamentModule } from './modules/tournament/tournament.module';
import { ThumbnailModule } from './modules/thumbnail/thumbnail.module';
import { BattleModule } from './modules/battle/battle.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    CommunityModule,
    TournamentModule,
    ThumbnailModule, BattleModule, LeaderboardModule,
  ],
  controllers: [AppController],

})
export class AppModule { }
