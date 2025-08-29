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
import { ScheduleModule } from '@nestjs/schedule'; // Import ScheduleModule
import { AwardsModule } from './modules/awards/awards.module';
import { HomeController } from './modules/home/home.controller';
import { HomeService } from './modules/home/home.service';
import { Tournament } from './modules/tournament/entities/tournament.entity';
import { User } from './modules/auth/entities/user.entity';
import { Vote } from './modules/vote/entities/vote.entity';
import { CreatorModule } from "./modules/creator-community/creator.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(), // Add this line to enable scheduling
    DatabaseModule,
    UsersModule,
    CommunityModule,
    TournamentModule,
    AwardsModule,
    ThumbnailModule, BattleModule, LeaderboardModule,CreatorModule,
    TypeOrmModule.forFeature([Tournament, User, Vote]),
  ],
  
  controllers: [AppController,HomeController],
  providers:[HomeService]

})
export class AppModule { }
