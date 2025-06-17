import { Exclude } from 'class-transformer';
import { Community } from 'src/modules/community/entities/community.entity';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToMany,
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

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
