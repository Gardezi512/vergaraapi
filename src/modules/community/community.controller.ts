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
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { instanceToPlain } from 'class-transformer';

@Controller('docs/communities')
export class CommunityController {
    constructor(private readonly communityService: CommunityService) { }

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
        const community = await this.communityService.findOne(id);
        return { status: true, data: instanceToPlain(community) };
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
