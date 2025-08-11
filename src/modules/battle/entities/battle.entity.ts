import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import { Tournament } from 'src/modules/tournament/entities/tournament.entity';
import { Vote } from 'src/modules/vote/entities/vote.entity';

export enum BattleStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('battles')
export class Battle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Thumbnail, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thumbnailAId' })
  thumbnailA: Thumbnail;

  @ManyToOne(() => Thumbnail, { nullable: true, onDelete: 'SET NULL' }) // 👈 bye-safe
  @JoinColumn({ name: 'thumbnailBId' })
  thumbnailB?: Thumbnail | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'winnerUserId' })
  winnerUser?: User;

  @Column({ default: false }) // New column to mark bye battles
  isByeBattle: boolean;

  @Column({
    type: 'enum',
    enum: BattleStatus,
    default: BattleStatus.PENDING,
  })
  status: BattleStatus;

  @ManyToOne(() => Tournament, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @Column({ type: 'int', default: 1 })
  roundNumber: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;
  @OneToMany(() => Vote, (vote) => vote.battle)
  votes: Vote[];
}
