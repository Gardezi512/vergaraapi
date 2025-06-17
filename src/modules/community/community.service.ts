// src/modules/community/community.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Community } from './entities/community.entity';
import { CreateCommunityDto } from './dto/create-community.dto';
import { User } from 'src/modules/auth/entities/user.entity';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { instanceToPlain } from 'class-transformer';

@Injectable()
export class CommunityService {
    constructor(
        @InjectRepository(Community)
        @InjectRepository(Community)
        private readonly communityRepo: Repository<Community>,

        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
    ) { }

    async create(dto: CreateCommunityDto, user: User): Promise<Community> {
        console.log('User Role:', user.role);
        if (user.role !== 'Admin') {
            throw new ForbiddenException('Only admins can create communities.');
        }
        console.log(user.email, user.id);
        const fullUser = await this.usersRepo.findOne({ where: { id: user.id } });
        console.log('Full User:', fullUser);
        if (!fullUser || fullUser.role !== 'Admin') {
            throw new ForbiddenException('Only admins can create communities.');
        }

        const community = this.communityRepo.create({ ...dto, admin: fullUser });
        return this.communityRepo.save(community);
    }
    async findAll(): Promise<Community[]> {
        return this.communityRepo.find({ relations: ['admin'] });
    }

    async findOne(id: number): Promise<Community> {
        const community = await this.communityRepo.findOne({ where: { id }, relations: ['admin'] });
        if (!community) {
            throw new NotFoundException(`Community with ID ${id} not found`);
        }
        return community;
    }

    async update(id: number, dto: UpdateCommunityDto): Promise<Community> {
        const community = await this.findOne(id);
        Object.assign(community, dto);
        return this.communityRepo.save(community);
    }

    async remove(id: number): Promise<void> {
        const community = await this.findOne(id);
        await this.communityRepo.remove(community);
    }
    async getCommunityWithMemberStats(id: number): Promise<any> {
        const community = await this.communityRepo.findOne({
            where: { id },
            relations: ['admin', 'members'],
        });

        if (!community) {
            throw new NotFoundException(`Community with ID ${id} not found`);
        }

        const totalJoined = community.members?.length || 0;
        const remainingSlots =
            community.memberLimit != null ? Math.max(community.memberLimit - totalJoined, 0) : null;
        const plainCommunity = instanceToPlain(community);

        return {
            ...plainCommunity,
            totalJoined,
            remainingSlots,
        };
    }

}
