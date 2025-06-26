import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Battle } from './entities/battle.entity';
import { BattleService } from './battle.service';
import { BattleController } from './battle.controller';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import { Vote } from '../vote/entities/vote.entity';
import { VoteService } from '../vote/vote.service';
import { VoteController } from '../vote/vote.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Battle, Thumbnail, User, Vote])],
    providers: [BattleService, VoteService],
    controllers: [BattleController, VoteController],
})
export class BattleModule { }
