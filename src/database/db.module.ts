import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({

                type: 'postgres',
                host: configService.get('PG_HOST'),
                port: configService.get('PG_PORT'),
                username: configService.get('PG_USER'),
                password: configService.get('PG_PASSWORD'),
                database: configService.get('PG_DB'),

                entities: [__dirname + '/../**/*.entity.{js,ts}'],
                retryAttempts: 1,
                autoLoadEntities: true,
                synchronize: true,
                // ssl: true,
                // logging: true,
                ssl: {
                    rejectUnauthorized: false,
                },
                cache: true,
            }),
        }),
    ],
})
export class DatabaseModule { }
