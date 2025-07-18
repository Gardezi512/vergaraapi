import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';
import { Tournament } from 'src/modules/tournament/entities/tournament.entity';

@Entity('battles')
export class Battle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Thumbnail, { eager: true })
  thumbnailA: Thumbnail;

  @ManyToOne(() => Thumbnail, { eager: true })
  thumbnailB: Thumbnail;

  @ManyToOne(() => User, { nullable: true, eager: true })
  winnerUser?: User;

  @ManyToOne(() => Tournament, { nullable: false, onDelete: 'CASCADE' })
  tournament: Tournament;

  @Column({ type: 'int', default: 1 })
  roundNumber: number;

  @ManyToOne(() => User, { nullable: true })
  createdBy?: User;

  @CreateDateColumn()
  createdAt: Date;
}
