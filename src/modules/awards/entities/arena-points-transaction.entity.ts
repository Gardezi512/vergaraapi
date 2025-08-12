import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
  } from 'typeorm';
  import { User } from '../../auth/entities/user.entity';
  
  export enum APTransactionType {
    THUMBNAIL_SUBMISSION = 'thumbnail_submission',
    BATTLE_WIN = 'battle_win',
    ROUND_COMPLETION = 'round_completion',
    TOURNAMENT_WIN = 'tournament_win',
    TOURNAMENT_PLACEMENT = 'tournament_placement',
  }
  
  @Entity('arena_points_transactions')
  export class ArenaPointsTransaction {
    @PrimaryGeneratedColumn()
    id: number;
  
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;
  
    @Column()
    points: number; // Can be positive or negative
  
    @Column({
      type: 'enum',
      enum: APTransactionType,
    })
    type: APTransactionType;
  
    @Column({ nullable: true })
    description?: string;
  
    @Column({ nullable: true })
    tournamentId?: number;
  
    @Column({ nullable: true })
    battleId?: number;
  
    @Column({ nullable: true })
    roundNumber?: number;
  
    @CreateDateColumn()
    createdAt: Date;
  }