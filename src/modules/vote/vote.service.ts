import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
  ) {}

  async vote(user: User, dto: CreateVoteDto): Promise<Vote> {
    const battle = await this.battleRepo.findOne({
      where: { id: dto.battleId },
      relations: [
        'thumbnailA',
        'thumbnailB',
        'thumbnailA.creator',
        'thumbnailB.creator',
      ],
    });

    if (!battle) throw new NotFoundException('Battle not found');

    const existing = await this.voteRepo.findOne({
      where: { voter: { id: user.id }, battle: { id: dto.battleId } },
    });
    if (existing)
      throw new BadRequestException('You already voted on this battle');

    let votedForUser: User;

    if (dto.votedFor === 'A') {
      votedForUser = battle.thumbnailA.creator;
    } else if (dto.votedFor === 'B') {
      votedForUser = battle.thumbnailB.creator;
    } else {
      throw new BadRequestException('Invalid votedFor option');
    }

    const vote = this.voteRepo.create({
      voter: user,
      battle,
      votedFor: votedForUser,
    });

    return this.voteRepo.save(vote);
  }

  async countVotes(battleId: number) {
    const votes = await this.voteRepo.find({
      where: { battle: { id: battleId } },
      relations: ['votedFor'],
    });

    const count: Record<number, number> = {};

    for (const vote of votes) {
      const userId = vote.votedFor.id;
      count[userId] = (count[userId] || 0) + 1;
    }

    return count;
  }
}
