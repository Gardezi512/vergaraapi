import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
  Column,
} from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Battle } from 'src/modules/battle/entities/battle.entity';

@Entity('votes')
@Unique(['voter', 'battle']) // One vote per user per battle
export class Vote {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  voter: User;

  @ManyToOne(() => Battle, { nullable: false, onDelete: 'CASCADE' })
  battle: Battle;

  // "A" or "B" (corresponding to thumbnailA or thumbnailB)
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  votedFor: User;

  @CreateDateColumn()
  createdAt: Date;
}
