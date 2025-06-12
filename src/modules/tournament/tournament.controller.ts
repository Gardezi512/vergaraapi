import {
    Controller,
    Post,
    Get,
    Param,
    Patch,
    Delete,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { instanceToPlain } from 'class-transformer';

@Controller('docs/tournaments')
export class TournamentController {
    constructor(private readonly tournamentService: TournamentService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    async create(@Body() dto: CreateTournamentDto, @Request() req) {
        const tournament = await this.tournamentService.create(dto, req.user);
        return { status: true, data: instanceToPlain(tournament) };
    }

    @Get()
    async findAll() {
        const tournaments = await this.tournamentService.findAll();
        return { status: true, data: instanceToPlain(tournaments) };
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
        const tournament = await this.tournamentService.findOne(id);
        return { status: true, data: instanceToPlain(tournament) };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Patch(':id')
    async update(@Param('id') id: number, @Body() dto: UpdateTournamentDto) {
        const updated = await this.tournamentService.update(id, dto);
        return { status: true, data: instanceToPlain(updated) };
    }
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Delete(':id')
    async remove(@Param('id') id: number) {
        await this.tournamentService.remove(id);
        return { status: true };
    }
}
