import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Battle } from './entities/battle.entity';
import { CreateBattleDto } from './dto/create-battle.dto';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import { Vote } from '../vote/entities/vote.entity';

@Injectable()
export class BattleService {
    constructor(
        @InjectRepository(Battle)
        private readonly battleRepo: Repository<Battle>,

        @InjectRepository(Thumbnail)
        private readonly thumbnailRepo: Repository<Thumbnail>,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Vote)
        private readonly voteRepo: Repository<Vote>,
    ) { }

    async create(dto: CreateBattleDto, user: User): Promise<Battle> {
        const thumbnailA = await this.thumbnailRepo.findOne({ where: { id: dto.thumbnailAId }, relations: ['creator'] });
        const thumbnailB = await this.thumbnailRepo.findOne({ where: { id: dto.thumbnailBId }, relations: ['creator'] });

        if (!thumbnailA || !thumbnailB) throw new NotFoundException('One or both thumbnails not found');

        const battle = this.battleRepo.create({
            thumbnailA,
            thumbnailB,
            createdBy: user,
        });

        return this.battleRepo.save(battle);
    }

    private calculateElo(winnerElo: number, loserElo: number, winnerCount: number, loserCount: number) {
        const expectedA = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
        const expectedB = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

        const kA = winnerCount < 10 ? 40 : winnerCount < 20 ? 20 : 10;
        const kB = loserCount < 10 ? 40 : loserCount < 20 ? 20 : 10;

        const newWinnerElo = Math.round(winnerElo + kA * (1 - expectedA));
        const newLoserElo = Math.round(loserElo + kB * (0 - expectedB));

        return { newWinnerElo, newLoserElo };
    }
    async resolveWinnerFromVotes(battleId: number): Promise<Battle> {
        const battle = await this.battleRepo.findOne({
            where: { id: battleId },
            relations: ['thumbnailA', 'thumbnailB', 'thumbnailA.creator', 'thumbnailB.creator'],
        });

        if (!battle) throw new NotFoundException('Battle not found');
        if (battle.winner) throw new BadRequestException('Battle already resolved');

        const votes = await this.voteRepo.find({ where: { battle: { id: battleId } } });

        const voteCount = { A: 0, B: 0 };
        for (const vote of votes) {
            voteCount[vote.votedFor]++;
        }

        if (voteCount.A === voteCount.B) {
            throw new BadRequestException('Cannot resolve winner: it’s a tie');
        }

        const winnerKey = voteCount.A > voteCount.B ? 'A' : 'B';
        const winnerThumb = winnerKey === 'A' ? battle.thumbnailA : battle.thumbnailB;
        const loserThumb = winnerKey === 'A' ? battle.thumbnailB : battle.thumbnailA;

        // Calculate new ELOs
        const updated = this.calculateElo(
            winnerThumb.eloRating,
            loserThumb.eloRating,
            winnerThumb.battleCount,
            loserThumb.battleCount,
        );

        winnerThumb.eloRating = updated.newWinnerElo;
        loserThumb.eloRating = updated.newLoserElo;

        winnerThumb.battleCount++;
        loserThumb.battleCount++;
        winnerThumb.winCount++;
        loserThumb.lossCount++;

        // Update Arena Points
        winnerThumb.creator.arenaPoints += 10;
        loserThumb.creator.arenaPoints += 5;

        // Save everything
        await this.thumbnailRepo.save([winnerThumb, loserThumb]);
        await this.userRepo.save([winnerThumb.creator, loserThumb.creator]);

        // Update battle
        battle.winner = winnerKey;
        return this.battleRepo.save(battle);
    }

}
