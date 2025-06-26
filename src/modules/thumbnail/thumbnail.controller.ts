import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    Body,
    UseGuards,
    Request,
    Patch,
    ParseIntPipe,
    Query,
} from '@nestjs/common';
import { ThumbnailService } from './thumbnail.service';
import { CreateThumbnailDto } from './dto/create-thumbnail.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { instanceToPlain } from 'class-transformer';

@Controller('docs/thumbnails')
export class ThumbnailController {
    constructor(private readonly thumbnailService: ThumbnailService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(@Body() dto: CreateThumbnailDto, @Request() req) {
        const thumbnail = await this.thumbnailService.create(dto, req.user);
        return { status: true, data: instanceToPlain(thumbnail) };
    }
    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { title?: string; imageUrl?: string },
        @Request() req,
    ) {
        const updated = await this.thumbnailService.update(id, body, req.user);
        return { status: true, data: instanceToPlain(updated) };
    }


    @Get()
    async findAll(@Query('tournamentId') tournamentId?: number, @Query('creatorId') creatorId?: number) {
        const thumbnails = await this.thumbnailService.findAll(tournamentId, creatorId);
        return { status: true, data: instanceToPlain(thumbnails) };
    }


    @Get(':id')
    async findOne(@Param('id') id: number) {
        const thumbnail = await this.thumbnailService.findOne(id);
        return { status: true, data: instanceToPlain(thumbnail) };
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async delete(@Param('id') id: number) {
        await this.thumbnailService.delete(id);
        return { status: true, message: 'Thumbnail deleted successfully' };
    }
}
