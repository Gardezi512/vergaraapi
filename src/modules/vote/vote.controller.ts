import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { VoteService } from './vote.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { instanceToPlain } from 'class-transformer';
import { CreateVoteDto } from './dto/create-vote.dto';

@Controller('docs/battles/votes')
@UseGuards(JwtAuthGuard)
export class VoteController {
    constructor(private readonly voteService: VoteService) { }

    @Post()
    async vote(@Body() dto: CreateVoteDto, @Request() req) {
        const vote = await this.voteService.vote(req.user, dto);
        return { status: true, data: instanceToPlain(vote) };
    }

    @Get(':battleId/count')
    async count(@Param('battleId') battleId: number) {
        const counts = await this.voteService.countVotes(Number(battleId));
        return { status: true, data: counts };
    }
}
