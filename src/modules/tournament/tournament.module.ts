// src/modules/tournament/tournament.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tournament } from './entities/tournament.entity';
import { Community } from '../community/entities/community.entity';
import { TournamentService } from './tournament.service';
import { TournamentController } from './tournament.controller';
import { User } from '../auth/entities/user.entity';
import { UsersModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, Community, User]),
    UsersModule,
  ],
  providers: [TournamentService],
  controllers: [TournamentController],
})
export class TournamentModule {}
