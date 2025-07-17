import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { User } from './entities/user.entity';
import { UsersService } from './auth.service';
import { UsersController } from './auth.controller';
import { JwtStrategy } from 'src/auth.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { YouTubeProfile } from '../youtubeprofile/entities/youtube.profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, YouTubeProfile]),
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'fallback_secret'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy],
  exports: [UsersService],
})
export class UsersModule {}
