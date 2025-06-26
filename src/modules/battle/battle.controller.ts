import { Controller, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { BattleService } from './battle.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateBattleDto } from './dto/create-battle.dto';
import { instanceToPlain } from 'class-transformer';

@Controller('docs/battles')
@UseGuards(JwtAuthGuard)
export class BattleController {
    constructor(private readonly battleService: BattleService) { }

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

}
