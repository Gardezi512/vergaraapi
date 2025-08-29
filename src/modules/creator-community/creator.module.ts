import {  Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CreatorController } from "./creator.controller"
import { CreatorService } from "./creator.service"
import { User } from "../auth/entities/user.entity"
import { Tournament } from "../tournament/entities/tournament.entity"
import { LeaderboardModule } from "../leaderboard/leaderboard.module"

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Tournament]), // register repos
         LeaderboardModule
      ],
  controllers: [CreatorController],
  providers: [CreatorService],
 
})
export class CreatorModule {}
