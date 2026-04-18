import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { buildTypeOrmOptions } from './config/database.config';
import { SchemaBootstrapService } from './config/schema-bootstrap.service';
import { AuthModule } from './auth/auth.module';
import { PlansModule } from './plans/plans.module';
import { TravelModule } from './travel/travel.module';
import { ExploreModule } from './explore/explore.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: parseInt(config.get<string>('JWT_EXPIRES_SEC') ?? '28800', 10),
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
      inject: [ConfigService],
    }),
    SupabaseModule,
    TravelModule,
    ExploreModule,
    AuthModule,
    PlansModule,
  ],
  controllers: [AppController],
  providers: [AppService, SchemaBootstrapService],
})
export class AppModule {}
