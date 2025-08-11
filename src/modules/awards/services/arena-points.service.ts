import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { APTransactionType, ArenaPointsTransaction } from '../entities/arena-points-transaction.entity';


@Injectable()
export class ArenaPointsService {
  private readonly logger = new Logger(ArenaPointsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ArenaPointsTransaction)
    private readonly apTransactionRepo: Repository<ArenaPointsTransaction>,
  ) {}

  async awardArenaPoints(
    userId: number,
    points: number,
    type: APTransactionType,
    description?: string,
    tournamentId?: number,
    battleId?: number,
    roundNumber?: number,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.error(`User ${userId} not found for arena points award`);
      return;
    }

    // Update user's arena points
    user.arenaPoints += points;
    await this.userRepo.save(user);

    // Create transaction record
    const transaction = this.apTransactionRepo.create({
      user,
      points,
      type,
      description,
      tournamentId,
      battleId,
      roundNumber,
    });

    await this.apTransactionRepo.save(transaction);

    this.logger.log(
      `Awarded ${points} AP to user ${user.username || user.name} for ${type}. New total: ${user.arenaPoints}`
    );
  }

  async getArenaPointsConfig() {
    return {
      thumbnailSubmission: 5,
      battleWin: 10,
      roundCompletion: 25,
      tournamentWin: 100,
      tournamentSecondPlace: 50,
      tournamentThirdPlace: 25,
    };
  }

  async getUserArenaPointsHistory(userId: number): Promise<ArenaPointsTransaction[]> {
    return this.apTransactionRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 50, // Last 50 transactions
    });
  }
}