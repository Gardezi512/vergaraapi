import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity()
export class CreditUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  creditsUsed: number;

  @Column({ nullable: true })
  feature: string; // e.g., 'thumbnail_feedback', 'ai_analysis'

  @CreateDateColumn()
  createdAt: Date;
}
