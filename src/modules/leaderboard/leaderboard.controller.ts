import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';

@Controller('docs/leaderboard')
export class LeaderboardController {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(Thumbnail)
        private readonly thumbnailRepo: Repository<Thumbnail>,
    ) { }

    @Get()
    async getLeaderboard(
        @Query('type') type?: 'elo' | 'arena',
        @Query('tournamentId') tournamentId?: number,
    ) {
        const results: any = {};

        // Arena Points Leaderboard
        if (!type || type === 'arena') {
            results.arena = await this.userRepo.find({
                order: { arenaPoints: 'DESC' },
                take: 20,
            });
        }

        // ELO Leaderboard (optionally by tournament)
        if (!type || type === 'elo') {
            const where = tournamentId ? { tournament: { id: tournamentId } } : {};
            results.elo = await this.thumbnailRepo.find({
                where,
                order: { eloRating: 'DESC' },
                take: 20,
                relations: ['creator', 'tournament'],
            });
        }

        return { status: true, data: results };
    }
}
