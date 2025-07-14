import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Community } from 'src/modules/community/entities/community.entity';
import { User } from 'src/modules/auth/entities/user.entity';

export interface BattleRound {
  roundNumber: number;
  battleName: string;
  description?: string;
  theme?: string;
  focus?: string;
  rewards?: {
    arenaPoints?: number;
    badges?: string[];
    highlightUI?: boolean;
  };
  roundStartDate: Date;
  roundEndDate: Date;
  requirements?: string;
  numParticipants?: number;
  possibleBadges?: string[];
}

@Entity()
export class Tournament {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({ default: '1v1' })
  format: '1v1' | '2v2' | 'custom';

  @Column({ default: 'single-elimination' })
  structure: 'single-elimination' | 'bracket' | 'leaderboard';

  @Column()
  category: string;

  @Column({ nullable: true })
  subcategory?: string;

  @Column({ default: 'public' })
  accessType: 'public' | 'invite-only' | 'restricted';

  @Column('jsonb', { nullable: true })
  accessCriteria?: {
    minSubscribers?: number;
    minArenaPoints?: number;
    minElo?: number;
  };

  @Column('jsonb', { nullable: true })
  rewards?: {
    arenaPoints?: number;
    badges?: string[];
    highlightUI?: boolean;
  };

  @Column({ nullable: true })
  imageUrl?: string;

  @ManyToOne(() => Community, (community) => community.tournaments, {
    onDelete: 'CASCADE',
  })
  community: Community;

  @Column('jsonb', { nullable: true })
  rounds?: BattleRound[];

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
