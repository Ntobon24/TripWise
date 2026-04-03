import { Module } from '@nestjs/common';
import { TravelModule } from '../travel/travel.module';
import { ExploreController } from './explore.controller';

@Module({
  imports: [TravelModule],
  controllers: [ExploreController],
})
export class ExploreModule {}
