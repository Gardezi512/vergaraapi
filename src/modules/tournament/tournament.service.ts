// src/modules/tournament/tournament.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import { Community } from 'src/modules/community/entities/community.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Injectable()
export class TournamentService {
    constructor(
        @InjectRepository(Tournament)
        private readonly tournamentRepo: Repository<Tournament>,

        @InjectRepository(Community)
        private readonly communityRepo: Repository<Community>,
    ) { }

    async create(dto: CreateTournamentDto): Promise<Tournament> {
        const community = await this.communityRepo.findOne({ where: { id: dto.communityId } });
        if (!community) throw new NotFoundException('Community not found');

        const tournament = this.tournamentRepo.create({
            title: dto.title,
            description: dto.description,
            startDate: dto.startDate,
            endDate: dto.endDate,
            community,
        });

        return this.tournamentRepo.save(tournament);
    }

    async findAll(): Promise<Tournament[]> {
        return this.tournamentRepo.find({ relations: ['community'] });
    }

    async findOne(id: number): Promise<Tournament> {
        const tournament = await this.tournamentRepo.findOne({ where: { id }, relations: ['community'] });
        if (!tournament) throw new NotFoundException('Tournament not found');
        return tournament;
    }

    async update(id: number, dto: UpdateTournamentDto): Promise<Tournament> {
        const tournament = await this.findOne(id);
        Object.assign(tournament, dto);
        return this.tournamentRepo.save(tournament);
    }

    async remove(id: number): Promise<void> {
        const tournament = await this.findOne(id);
        await this.tournamentRepo.remove(tournament);
    }
}
