// src/modules/tournament/tournament.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './entities/tournament.entity';
import { Community } from '../community/entities/community.entity';
import { TournamentService } from './tournament.service';
import { TournamentController } from './tournament.controller';
import { User } from '../auth/entities/user.entity';
import { UsersModule } from '../auth/auth.module';
import { BattleModule } from '../battle/battle.module';
import { Battle } from '../battle/entities/battle.entity';
import { YouTubeProfile } from '../youtubeprofile/entities/youtube.profile.entity';
import { Thumbnail } from '../thumbnail/entities/thumbnail.entity';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';
import { TournamentSchedulerService } from './tournament-scheduler.service'; // Import the new scheduler service
import { VoteModule } from '../vote/vote.module';
import { Vote } from '../vote/entities/vote.entity';
import { AwardsModule } from '../awards/awards.module';

@Module({
  imports: [
    
    TypeOrmModule.forFeature([Tournament, Community, User, Battle, YouTubeProfile, Thumbnail,Vote]),
    UsersModule,
    ThumbnailModule,
    VoteModule,
    forwardRef(() => BattleModule),
    AwardsModule,
  ],
  providers: [TournamentService,TournamentSchedulerService],
  controllers: [TournamentController],
   // ✅ Export any services you want to use outside this module
   exports: [TournamentService, TournamentSchedulerService],
})
export class TournamentModule {}
