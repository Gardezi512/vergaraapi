import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/db.module';
import { UsersModule } from './modules/auth/auth.module';
import { CommunityModule } from './modules/community/community.module';
import { TournamentModule } from './modules/tournament/tournament.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsersModule,
    CommunityModule,
    TournamentModule
  ],
  controllers: [AppController],

})
export class AppModule { }
