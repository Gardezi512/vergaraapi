// src/modules/community/community.service.ts
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  ) {}

  async create(dto: CreateCommunityDto, user: User): Promise<Community> {
    if (!['creator', 'Admin'].includes(user.role)) {
      throw new ForbiddenException(
        'You are not allowed to create communities.',
      );
    }

    const fullUser = await this.usersRepo.findOne({ where: { id: user.id } });

    if (!fullUser) {
      throw new ForbiddenException('User not found.');
    }

    const status: 'pending' | 'approved' =
      fullUser.role === 'Admin' ? 'approved' : 'pending';

    const community = this.communityRepo.create({
      ...dto,
      admin: fullUser,
      status,
    });
    return this.communityRepo.save(community);
  }

  async findAll(): Promise<Community[]> {
    return this.communityRepo.find({
      where: { status: 'approved' },
      relations: ['admin'],
    });
  }

  async findOne(id: number): Promise<Community> {
    const community = await this.communityRepo.findOne({
      where: { id },
      relations: ['admin'],
    });
    if (!community) {
      throw new NotFoundException(`Community with ID ${id} not found`);
    }
    return community;
  }

  async findAllForAdmin(status?: 'pending' | 'approved'): Promise<Community[]> {
    const where = status ? { status } : {};
    return this.communityRepo.find({
      where,
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: number,
    dto: UpdateCommunityDto,
    user: User,
  ): Promise<Community> {
    const community = await this.findOne(id);

    const isCommunityAdmin = community.admin.id === user.id;
    const isPlatformAdmin = user.role === 'Admin';

    if (!isCommunityAdmin && !isPlatformAdmin) {
      throw new ForbiddenException(
        'Only the community creator or a platform admin can update this community.',
      );
    }

    Object.assign(community, dto);

    //  If creator is updating → reset status to pending
    if (isCommunityAdmin && !isPlatformAdmin) {
      community.status = 'pending';
    }

    return this.communityRepo.save(community);
  }

  async updateStatus(
    id: number,
    newStatus: 'pending' | 'approved' | 'rejected',
    user: User,
  ): Promise<Community> {
    if (user.role !== 'Admin') {
      throw new ForbiddenException(
        'Only Admins can change the community status.',
      );
    }

    const community = await this.findOne(id);
    community.status = newStatus;
    return this.communityRepo.save(community);
  }

  async remove(id: number, user: User): Promise<void> {
    const community = await this.findOne(id);

    const isCommunityAdmin = community.admin.id === user.id;
    const isPlatformAdmin = user.role === 'Admin';

    if (!isCommunityAdmin && !isPlatformAdmin) {
      throw new ForbiddenException(
        'Only the community creator or a platform admin can delete this community.',
      );
    }

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
      community.memberLimit != null
        ? Math.max(community.memberLimit - totalJoined, 0)
        : null;
    const plainCommunity = instanceToPlain(community);

    return {
      ...plainCommunity,
      totalJoined,
      remainingSlots,
    };
  }
  async findByCreator(userId: number): Promise<Community[]> {
    return this.communityRepo.find({
      where: { admin: { id: userId } },
      relations: ['admin'],
    });
  }
}
