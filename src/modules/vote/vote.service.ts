import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Battle } from 'src/modules/battle/entities/battle.entity';
import { Vote } from './entities/vote.entity';
import { CreateVoteDto } from './dto/create-vote.dto';

@Injectable()
export class VoteService {
    constructor(
        @InjectRepository(Vote)
        private readonly voteRepo: Repository<Vote>,

        @InjectRepository(Battle)
        private readonly battleRepo: Repository<Battle>,
    ) { }

    async vote(user: User, dto: CreateVoteDto): Promise<Vote> {
        const battle = await this.battleRepo.findOne({ where: { id: dto.battleId } });
        if (!battle) throw new NotFoundException('Battle not found');

        const existing = await this.voteRepo.findOne({ where: { voter: { id: user.id }, battle: { id: dto.battleId } } });
        if (existing) {
            throw new BadRequestException('You already voted on this battle');
        }

        const vote = this.voteRepo.create({
            voter: user,
            battle,
            votedFor: dto.votedFor,
        });

        return this.voteRepo.save(vote);
    }

    async countVotes(battleId: number) {
        const votes = await this.voteRepo.find({ where: { battle: { id: battleId } } });
        const count = { A: 0, B: 0 };

        for (const vote of votes) {
            count[vote.votedFor]++;
        }

        return count;
    }
}
