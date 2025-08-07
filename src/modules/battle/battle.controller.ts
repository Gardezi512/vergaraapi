import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
  Get,
  UseInterceptors,
  Req,
  Query,
} from '@nestjs/common';
import { BattleService } from './battle.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateBattleDto } from './dto/create-battle.dto';
import { instanceToPlain } from 'class-transformer';
import { User } from '../auth/entities/user.entity';

@Controller('docs/battles')
export class BattleController {
  constructor(private readonly battleService: BattleService) {}
  @UseGuards(JwtAuthGuard) 
  @Post()
  async create(@Body() dto: CreateBattleDto, @Request() req) {
    const battle = await this.battleService.create(dto, req.user);
    return { status: true, data: instanceToPlain(battle) };
  }
  @UseGuards(JwtAuthGuard) 
  @Post(':id/resolve')
  async resolve(@Param('id') id: number) {
    const result = await this.battleService.resolveWinnerFromVotes(+id);
    return { status: true, data: result };
  }
  @UseGuards(JwtAuthGuard) 
  @Post('generate/:tournamentId/round/:roundNumber')
  async generateRandomBattles(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('roundNumber', ParseIntPipe) roundNumber: number,
    @Request() req: { user: User },
  ) {
    return this.battleService.generateRandomBattlesForRound(
      tournamentId,
      roundNumber,
      req.user,
    );
  }
  @UseGuards(JwtAuthGuard) 
  @Post('generate-next/:tournamentId/round/:currentRound')
  async generateNextRound(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('currentRound', ParseIntPipe) currentRound: number,
    @Request() req: { user: User },
  ) {
    const battles = await this.battleService.generateNextRoundBattles(
      tournamentId,
      currentRound,
      req.user,
    );
    return { status: true, data: instanceToPlain(battles) };
  }

  // ✅ PUBLIC: Get all battles of all tournaments
  @Get()
async getAllBattles(@Query('userId') userId?: number) {
  const battles = await this.battleService.getAllBattles(userId);
  return { status: true, data: instanceToPlain(battles) };
}
}