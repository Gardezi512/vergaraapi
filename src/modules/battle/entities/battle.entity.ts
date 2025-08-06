import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import { Tournament } from 'src/modules/tournament/entities/tournament.entity';
import { Vote } from 'src/modules/vote/entities/vote.entity';

export enum BattleStatus {
  PENDING = "pending",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}


@Entity('battles')
export class Battle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Thumbnail, { eager: true })
  thumbnailA: Thumbnail;


  @ManyToOne(() => Thumbnail, { eager: true, nullable: true }) // Made nullable for bye battles
  thumbnailB: Thumbnail | null // Allow null for bye battles

  @ManyToOne(() => User, { nullable: true, eager: true })
   winnerUser: User | null

  @Column({ default: false }) // New column to mark bye battles
  isByeBattle: boolean

  @Column({
    type: "enum",
    enum: BattleStatus,
    default: BattleStatus.PENDING,
  })
  status: BattleStatus


  @ManyToOne(() => Tournament, { nullable: false, onDelete: 'CASCADE' })
  tournament: Tournament;

  @Column({ type: 'int', default: 1 })
  roundNumber: number;

  @ManyToOne(() => User, { nullable: true })
  createdBy?: User;

  @CreateDateColumn()
  createdAt: Date;
  @OneToMany(() => Vote, (vote) => vote.battle)
  votes: Vote[];
  

}
