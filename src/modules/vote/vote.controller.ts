import { Controller, Post, Body, UseGuards, Request, Get, Param, ParseIntPipe, Query, Logger } from '@nestjs/common';
import { VoteService } from './vote.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { instanceToPlain } from 'class-transformer';
import { CreateVoteDto } from './dto/create-vote.dto';

@Controller('docs/battles/votes')
@UseGuards(JwtAuthGuard)
export class VoteController {
    private readonly logger  = new Logger(VoteController.name)
    constructor(private readonly voteService: VoteService) { }

    @Post()
    async createVote(@Body() createVoteDto: CreateVoteDto, @Request() req) {
      this.logger.log(`Received request to create vote: ${JSON.stringify(createVoteDto)} by user ${req.user.id}`)
      const vote = await this.voteService.vote(req.user, createVoteDto)
      return { status: true, data: instanceToPlain(vote) }
    }
  
    @Get(":battleId/counts")
    async getBattleVoteCounts(@Param('battleId', ParseIntPipe) battleId: number) {
      this.logger.log(`Received request for battle vote counts for battle ${battleId}`)
      const counts = await this.voteService.countVotes(battleId)
      return { status: true, data: counts }
    }
  
    @Get(":battleId/stats")
    async getBattleStats(
      @Param('battleId', ParseIntPipe) battleId: number,
      @Query('userIdA', ParseIntPipe) userIdA: number,
      @Query('userIdB', ParseIntPipe) userIdB: number,
    ) {
      this.logger.log(`Received request for battle stats for battle ${battleId}`)
      const stats = await this.voteService.getBattleVoteStats(battleId, userIdA, userIdB)
      return { status: true, data: stats }
    }
  
    @Get("user/:userId/stats")
    async getFullUserStats(@Param('userId', ParseIntPipe) userId: number) {
      this.logger.log(`Received request for full user stats for user ${userId}`)
      const stats = await this.voteService.getFullUserStats(userId)
      return { status: true, data: stats }
    }
  
    @Get("creator/:userId/stats")
    async getCreatorStats(@Param('userId', ParseIntPipe) userId: number) {
      this.logger.log(`Received request for creator stats for user ${userId}`)
      const stats = await this.voteService.getCreatorStats(userId)
      return { status: true, data: stats }
    }
  }
  