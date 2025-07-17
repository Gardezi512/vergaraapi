import { Exclude } from "class-transformer";
import { User } from "src/modules/auth/entities/user.entity";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class YouTubeProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, (user) => user.youtubeProfile, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ nullable: true })
  channelName?: string;

  @Column({ nullable: true })
  thumbnail?: string;

  @Column({ nullable: true })
  subscribers?: number;

  @Column({ nullable: true, type: 'bigint' })
  totalViews?: number;

  @Exclude()
  @Column({ nullable: true })
  accessToken?: string;

  @Exclude()
  @Column({ nullable: true })
  refreshToken?: string;

  @Column({ nullable: true, type: 'timestamp' })
  tokenExpiry?: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
