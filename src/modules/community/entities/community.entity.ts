import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from 'src/modules/auth/entities/user.entity';

@Entity()
export class Community {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ nullable: true })
    description?: string;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    admin: User;

    @CreateDateColumn()
    createdAt: Date;
}
