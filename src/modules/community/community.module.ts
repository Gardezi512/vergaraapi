import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Community } from './entities/community.entity';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { UsersModule } from '../auth/auth.module';
import { User } from '../auth/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Community, User]), UsersModule],
    providers: [CommunityService],
    controllers: [CommunityController],
})
export class CommunityModule { }
