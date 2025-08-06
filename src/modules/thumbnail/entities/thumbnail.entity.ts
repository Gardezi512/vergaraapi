import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';
import { Tournament } from 'src/modules/tournament/entities/tournament.entity';

@Entity('thumbnails')
export class Thumbnail {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, (user) => user.thumbnails, { nullable: false, onDelete: 'CASCADE' })
    creator: User;

    @Column()
    imageUrl: string;

    @Column({ default: 1200 })
    eloRating: number;

    @Column({ default: 0 })
    battleCount: number;

    @Column({ default: 0 })
    winCount: number;

    @Column({ default: 0 })
    lossCount: number;

    @Column({ nullable: true })
    title?: string;

    @ManyToOne(
        () => Tournament,
        (tournament) => tournament.thumbnails, // FIX: Corrected inverse side mapping
        { onDelete: "CASCADE" },
      )
      tournament: Tournament

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
