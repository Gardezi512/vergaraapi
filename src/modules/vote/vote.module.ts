import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoteService } from './vote.service';
import { VoteController } from './vote.controller';
import { Vote } from './entities/vote.entity';
import { Battle } from '../battle/entities/battle.entity';
import { Thumbnail } from '../thumbnail/entities/thumbnail.entity';
import { User } from '../auth/entities/user.entity';
import { UsersModule } from '../auth/auth.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Vote, Battle, Thumbnail, User]), // Make sure all repositories needed are listed
    UsersModule, // <--- Import the module that provides UserRepository
  ],
  controllers: [VoteController],
  providers: [VoteService],
  exports: [VoteService], // optional if needed elsewhere
})
export class VoteModule {}
