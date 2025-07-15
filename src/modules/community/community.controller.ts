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
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { instanceToPlain } from 'class-transformer';
import { Community } from './entities/community.entity';

import { User } from 'src/modules/auth/entities/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('docs/communities')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    @InjectRepository(Community)
    private readonly communityRepo: Repository<Community>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateCommunityDto, @Request() req) {
    const community = await this.communityService.create(dto, req.user);
    return {
      status: true,
      data: instanceToPlain(community),
    };
  }

  @Get()
  async findAll() {
    const communities = await this.communityService.findAll();
    return { status: true, data: instanceToPlain(communities) };
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    const community =
      await this.communityService.getCommunityWithMemberStats(id);
    return { status: true, data: instanceToPlain(community) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateCommunityDto,
    @Request() req,
  ) {
    const community = await this.communityService.update(id, dto, req.user);
    return { status: true, data: instanceToPlain(community) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req) {
    await this.communityService.remove(id, req.user);
    return { status: true, message: 'Community deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinCommunity(@Param('id') id: number, @Request() req) {
    const result = await this.communityService.joinCommunity(id, req.user);
    return { status: true, ...result };
  }
  @Get('/user/:userId')
  async getByCreator(@Param('userId', ParseIntPipe) userId: number) {
    const communities = await this.communityService.findByCreator(userId);
    return { status: true, data: communities };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @Get('/admin/all')
  async getAllForAdmin(@Query('status') status: string) {
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      throw new BadRequestException(
        'Invalid status filter. Must be pending, approved, or rejected.',
      );
    }
    const communities = await this.communityService.findAllForAdmin(
      status as 'pending' | 'approved' | 'rejected',
    );
    return { status: true, data: communities };
  }
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin')
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @Request() req,
  ) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new BadRequestException(
        'Invalid status. Must be pending, approved, or rejected.',
      );
    }
    const community = await this.communityService.updateStatus(
      id,
      status as any,
      req.user,
    );
    return { status: true, data: instanceToPlain(community) };
  }
}
