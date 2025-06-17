import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    Request,
    UseGuards,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { instanceToPlain } from 'class-transformer';
import { Community } from './entities/community.entity';

import { User } from 'src/modules/auth/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Controller('docs/communities')
export class CommunityController {
    constructor(
        private readonly communityService: CommunityService,
        @InjectRepository(Community) private readonly communityRepo: Repository<Community>,
        @InjectRepository(User) private readonly usersRepo: Repository<User>,
    ) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Post()
    async create(@Body() dto: CreateCommunityDto, @Request() req) {
        const community = await this.communityService.create(dto, req.user);
        return {
            status: true, data: instanceToPlain(community),
        };
    }

    @Get()
    async findAll() {
        const communities = await this.communityService.findAll();
        return { status: true, data: instanceToPlain(communities) };
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
        const community = await this.communityService.getCommunityWithMemberStats(id);
        return { status: true, data: instanceToPlain(community) };
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/join')
    async joinCommunity(@Param('id') id: number, @Request() req) {
        const user = req.user;
        const community = await this.communityRepo.findOne({
            where: { id },
            relations: ['members'],
        });

        if (!community) throw new NotFoundException('Community not found');

        const totalJoined = community.members.length;
        if (community.memberLimit && totalJoined >= community.memberLimit) {
            throw new BadRequestException('Community has reached its member limit');
        }

        const fullUser = await this.usersRepo.findOne({
            where: { id: user.id },
            relations: ['joinedCommunities'],
        });

        if (!fullUser) throw new NotFoundException('User not found');

        const alreadyJoined = fullUser.joinedCommunities.some(c => c.id === community.id);
        if (!alreadyJoined) {
            fullUser.joinedCommunities.push(community);
            await this.usersRepo.save(fullUser);
        }

        return { status: true, message: 'Joined community successfully' };
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Patch(':id')
    async update(@Param('id') id: number, @Body() dto: UpdateCommunityDto) {
        const community = await this.communityService.update(id, dto);
        return { status: true, data: instanceToPlain(community) };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Delete(':id')
    async remove(@Param('id') id: number) {
        await this.communityService.remove(id);
        return { status: true, message: 'Community deleted successfully' };
    }
}