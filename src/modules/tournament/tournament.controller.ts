// src/modules/tournament/tournament.controller.ts
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

@Controller('tournaments')
export class TournamentController {
    constructor(private readonly tournamentService: TournamentService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Post()
    create(@Body() dto: CreateTournamentDto, @Request() req) {
        return this.tournamentService.create(dto);
    }

    @Get()
    findAll() {
        return this.tournamentService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: number) {
        return this.tournamentService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Patch(':id')
    update(@Param('id') id: number, @Body() dto: UpdateTournamentDto) {
        return this.tournamentService.update(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('Admin')
    @Delete(':id')
    remove(@Param('id') id: number) {
        return this.tournamentService.remove(id);
    }
}
