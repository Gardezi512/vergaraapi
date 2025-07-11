import { Exclude } from 'class-transformer';
import { Community } from 'src/modules/community/entities/community.entity';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';

export type UserRole = 'creator' | 'Admin';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  username?: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column({ nullable: true })
  password?: string;

  @Column({ type: 'enum', enum: ['creator', 'Admin'], default: 'creator' })
  role: UserRole;

  @ManyToMany(() => Community, (community) => community.members)
  joinedCommunities: Community[];

  @Column({ default: 0 })
  arenaPoints: number;

  @OneToMany(() => Thumbnail, (thumbnail) => thumbnail.creator)
  thumbnails: Thumbnail[];

  @Column({ nullable: true })
  youtubeAccessToken?: string;

  @Column({ nullable: true })
  youtubeRefreshToken?: string;

  @Column({ nullable: true })
  youtubeChannelName?: string;

  @Column({ nullable: true })
  youtubeSubscribers?: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
