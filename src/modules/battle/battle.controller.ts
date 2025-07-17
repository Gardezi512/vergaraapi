import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { BattleService } from './battle.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateBattleDto } from './dto/create-battle.dto';
import { instanceToPlain } from 'class-transformer';
import { User } from '../auth/entities/user.entity';

@Controller('docs/battles')
@UseGuards(JwtAuthGuard)
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Post()
  async create(@Body() dto: CreateBattleDto, @Request() req) {
    const battle = await this.battleService.create(dto, req.user);
    return { status: true, data: instanceToPlain(battle) };
  }
  @Post(':id/resolve')
  @UseGuards(JwtAuthGuard)
  async resolve(@Param('id') id: number) {
    const result = await this.battleService.resolveWinnerFromVotes(+id);
    return { status: true, data: result };
  }
  @Post('generate/:tournamentId/round/:roundNumber')
  @UseGuards(JwtAuthGuard)
  generateRandomBattles(
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
}
