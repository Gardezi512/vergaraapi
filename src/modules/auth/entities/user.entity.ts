import { Exclude } from 'class-transformer';
import { Community } from 'src/modules/community/entities/community.entity';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { YouTubeProfile } from 'src/modules/youtubeprofile/entities/youtube.profile.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  OneToMany,
  OneToOne,
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
  
  @Column({ nullable: true }) // ✅ Add this line
  avatar?: string;

  @ManyToMany(() => Community, (community) => community.members)
  joinedCommunities: Community[];

  @Column({ default: 0 })
  arenaPoints: number;

  @Column({ default: 1000 })
  elo: number;

  @OneToMany(() => Thumbnail, (thumbnail) => thumbnail.creator)
  thumbnails: Thumbnail[];

  @OneToOne(() => YouTubeProfile, (profile) => profile.user)
  youtubeProfile?: YouTubeProfile;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
