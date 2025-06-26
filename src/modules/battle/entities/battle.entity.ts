import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from 'typeorm';
import { Thumbnail } from 'src/modules/thumbnail/entities/thumbnail.entity';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity('battles')
export class Battle {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Thumbnail, { eager: true })
    thumbnailA: Thumbnail;

    @ManyToOne(() => Thumbnail, { eager: true })
    thumbnailB: Thumbnail;

    @Column({ type: 'enum', enum: ['A', 'B'], nullable: true })
    winner?: 'A' | 'B';

    @ManyToOne(() => User, { nullable: true }) // Optional: to track who initiated the battle
    createdBy?: User;

    @CreateDateColumn()
    createdAt: Date;
}
