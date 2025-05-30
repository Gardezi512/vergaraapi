// src/modules/tournament/entities/tournament.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Community } from 'src/modules/community/entities/community.entity';

@Entity()
export class Tournament {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ nullable: true })
    description?: string;

    @Column()
    startDate: Date;

    @Column()
    endDate: Date;

    @ManyToOne(() => Community, community => community.tournaments, { onDelete: 'CASCADE' })
    community: Community;

    @CreateDateColumn()
    createdAt: Date;
}
