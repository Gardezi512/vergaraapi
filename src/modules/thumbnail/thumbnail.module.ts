import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Thumbnail } from './entities/thumbnail.entity';
import { ThumbnailService } from './thumbnail.service';
import { ThumbnailController } from './thumbnail.controller';
import { TournamentModule } from '../tournament/tournament.module';
import { Tournament } from '../tournament/entities/tournament.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Thumbnail, Tournament])],
    providers: [ThumbnailService],
    controllers: [ThumbnailController],
    exports: [ThumbnailService],
})
export class ThumbnailModule { }
