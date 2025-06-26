import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Thumbnail } from './entities/thumbnail.entity';
import { CreateThumbnailDto } from './dto/create-thumbnail.dto';
import { User } from 'src/modules/auth/entities/user.entity';
import { Tournament } from '../tournament/entities/tournament.entity';

@Injectable()
export class ThumbnailService {
    constructor(
        @InjectRepository(Thumbnail)
        private readonly thumbnailRepo: Repository<Thumbnail>,
        @InjectRepository(Tournament)
        private readonly tournamentRepo: Repository<Tournament>,

    ) { }

    async create(dto: CreateThumbnailDto, user: User): Promise<Thumbnail> {
        const tournament = await this.tournamentRepo.findOne({ where: { id: dto.tournamentId } });

        if (!tournament) throw new NotFoundException('Tournament not found');

        const thumbnail = this.thumbnailRepo.create({
            imageUrl: dto.imageUrl,
            title: dto.title,
            creator: user,
            tournament,
        });

        return this.thumbnailRepo.save(thumbnail);
    }

    async update(id: number, dto: Partial<Thumbnail>, user: User): Promise<Thumbnail> {
        const thumb = await this.thumbnailRepo.findOne({ where: { id }, relations: ['creator'] });

        if (!thumb) throw new NotFoundException('Thumbnail not found');
        if (thumb.creator.id !== user.id) throw new ForbiddenException('You do not own this thumbnail');

        Object.assign(thumb, dto);
        return this.thumbnailRepo.save(thumb);
    }

    async findAll(tournamentId?: number, creatorId?: number): Promise<Thumbnail[]> {
        const where: any = {};
        if (tournamentId) where.tournament = { id: tournamentId };
        if (creatorId) where.creator = { id: creatorId };

        return this.thumbnailRepo.find({
            where,
            relations: ['creator', 'tournament'],
            order: { createdAt: 'DESC' },
        });
    }


    async findOne(id: number): Promise<Thumbnail> {
        const thumbnail = await this.thumbnailRepo.findOne({ where: { id }, relations: ['creator'] });
        if (!thumbnail) throw new NotFoundException('Thumbnail not found');
        return thumbnail;
    }

    async delete(id: number): Promise<void> {
        const thumbnail = await this.findOne(id);
        await this.thumbnailRepo.remove(thumbnail);
    }
}
