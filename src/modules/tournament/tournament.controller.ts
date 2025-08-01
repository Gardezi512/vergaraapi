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
  Req,
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
    console.log('📥 Creating tournament with DTO:', dto); // 🔍 Log create input
    const tournament = await this.tournamentService.create(dto, req.user);
    console.log('✅ Tournament created:', tournament?.id); // 🔍 Log created tournament ID
    return { status: true, data: tournament };
  }

  @Get('joined')
  @UseGuards(JwtAuthGuard)
  async getJoined(@Req() req) {
    const userId = req.user.id;
    console.log('👤 Fetching joined tournaments for user:', userId); // 🔍 Log user ID
    const tournaments =
      await this.tournamentService.getJoinedTournaments(userId);
    console.log('✅ Joined tournaments:', tournaments?.length); // 🔍 Log count
    return { status: true, data: tournaments };
  }

  @Get()
  async findAll() {
    console.log('🌍 Fetching all tournaments'); // 🔍
    const tournaments = await this.tournamentService.findAll();
    return { status: true, data: instanceToPlain(tournaments) };
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    console.log('🔍 Finding tournament by ID:', id); // 🔍
    const tournament = await this.tournamentService.findOne(id);
    return { status: true, data: instanceToPlain(tournament) };
  }

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard)
  async getUserTournamentDashboard(@Param('id') id: number, @Req() req) {
    console.log('📊 Fetching dashboard for tournament ID:', id); // 🔍
    console.log('👤 For user ID:', req.user.id); // 🔍
    const data = await this.tournamentService.getUserDashboard(id, req.user.id);
    console.log('📦 Dashboard Data:', JSON.stringify(data, null, 2)); // 🔍 Full dump
    return {
      status: true,
      data,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'creator')
  async update(
    @Param('id') id: number,
    @Body() dto: UpdateTournamentDto,
    @Request() req,
  ) {
    console.log('✏️ Updating tournament ID:', id); // 🔍
    console.log('📝 Update payload:', dto); // 🔍
    const updated = await this.tournamentService.update(id, dto, req.user);
    return { status: true, data: updated };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'creator')
  @Delete(':id')
  async remove(@Param('id') id: number, @Request() req) {
    console.log('🗑️ Deleting tournament ID:', id); // 🔍
    await this.tournamentService.remove(id, req.user);
    return { status: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async joinTournament(
    @Param('id') id: number,
    @Request() req,
    @Body('youtubeAccessToken') youtubeAccessToken: string,
    @Body('thumbnailUrl') thumbnailUrl: string,
  ) {
    console.log('🚪 User joining tournament:', id); // 🔍
    console.log('👤 User ID:', req.user.id); // 🔍
    console.log('🖼️ Thumbnail:', thumbnailUrl); // 🔍
    console.log('🎥 YouTube token:', youtubeAccessToken); // 🔍
    const result = await this.tournamentService.joinTournament(
      id,
      req.user,
      youtubeAccessToken,
      thumbnailUrl,
    );
    console.log('✅ Join result:', result); // 🔍
    return {
      status: true,
      message: result.message,
      thumbnail: result.thumbnail,
    };
  }
}
