import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
  Column,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Battle } from 'src/modules/battle/entities/battle.entity';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';

@Entity("votes")
@Unique(["voter", "battle"]) // One vote per user per battle
export class Vote {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(
    () => Battle,
    (battle) => battle.id,
    { onDelete: "CASCADE", nullable: false },
  )
  battle: Battle

  @ManyToOne(
    () => User,
    (user) => user.votes,
    { eager: true, nullable: false },
  )
  voter: User

  // "A" or "B" (corresponding to thumbnailA or thumbnailB)
  @ManyToOne(
    () => Thumbnail,
    { eager: true, nullable: false, onDelete: "CASCADE" },
  )
  votedFor: Thumbnail
  
  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
