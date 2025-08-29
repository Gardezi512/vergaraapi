import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
  } from 'typeorm';
  import { User } from '../../auth/entities/user.entity';
  
  export enum RewardType {
    TOURNAMENT_REWARD = 'tournament_reward',
    ROUND_REWARD = 'round_reward',
    COMPLETION_BADGE = 'completion_badge',
  }
  
  @Entity('user_rewards')
  export class UserReward {
    [x: string]: any;
    @PrimaryGeneratedColumn()
    id: number;
  
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;
  
    @Column({
      type: 'enum',
      enum: RewardType,
    })
    rewardType: RewardType;
  
    @Column()
    rewardName: string;
  
    @Column('jsonb', { nullable: true })
    rewardData?: any; // Store reward details
  
    @Column()
    tournamentId: number;
  
    @Column({ nullable: true })
    roundNumber?: number;
  
    @CreateDateColumn()
    awardedAt: Date;
  }