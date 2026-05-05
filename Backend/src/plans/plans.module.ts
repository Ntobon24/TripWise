import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelPlan } from './entities/travel-plan.entity';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { TravelModule } from '../travel/travel.module';
import { AuthModule } from '../auth/auth.module';
import { GroqModule } from '../groq/groq.module';

@Module({
  imports: [TypeOrmModule.forFeature([TravelPlan]), TravelModule, AuthModule, GroqModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
