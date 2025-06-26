import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardController } from './leaderboard.controller';
import { User } from 'src/modules/auth/entities/user.entity';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, Thumbnail])],
    controllers: [LeaderboardController],
})
export class LeaderboardModule { }
