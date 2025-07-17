import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Tournament } from 'src/modules/tournament/entities/tournament.entity';

@Entity('communities')
export class Community {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column()
  category: string;

  @Column({ nullable: true })
  profilePic: string;

  @Column('text', { array: true, default: () => 'ARRAY[]::text[]' })
  adminSpecialties: string[];

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  admin: User;

  @OneToMany(() => Tournament, (tournament) => tournament.community)
  tournaments: Tournament[];

  
  @ManyToMany(() => User, (user) => user.joinedCommunities, { cascade: true })
  @JoinTable() // this creates the join table 'community_users_user'
  members: User[];

  @Column({ type: 'int', nullable: true })
  memberLimit?: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected';

  @CreateDateColumn()
  createdAt: Date;
}
