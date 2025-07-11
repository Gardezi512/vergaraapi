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
  constructor(private readonly tournamentService: TournamentService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('creator', 'Admin')
  async create(@Body() dto: CreateTournamentDto, @Request() req) {
    const tournament = await this.tournamentService.create(dto, req.user);
    return { status: true, data: tournament };
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'creator')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateTournamentDto,
    @Request() req,
  ) {
    const updated = await this.tournamentService.update(id, dto, req.user);
    return { status: true, data: updated };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'creator')
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req) {
    await this.tournamentService.remove(id, req.user);
    return { status: true };
  }
  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinTournament(
    @Param('id') id: number,
    @Request() req,
    @Body('youtubeAccessToken') youtubeAccessToken: string,
  ) {
    const message = await this.tournamentService.joinTournament(
      id,
      req.user,
      youtubeAccessToken,
    );
    return { status: true, message };
  }
}
