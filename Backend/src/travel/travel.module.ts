import { Module } from '@nestjs/common';
import { GeoDbService } from './geodb.service';
import { FlightApiService } from './flightapi.service';
import { OpenTripMapService } from './opentripmap.service';
import { TripAdvisorService } from './tripadvisor.service';
import { ViatorService } from './viator.service';
import { RecommendationsService } from './recommendations.service';
import { TravelController } from './travel.controller';
import { GroqModule } from '../groq/groq.module';

@Module({
  imports: [GroqModule],
  controllers: [TravelController],
  providers: [
    GeoDbService,
    FlightApiService,
    OpenTripMapService,
    TripAdvisorService,
    ViatorService,
    RecommendationsService,
  ],
  exports: [
    GeoDbService,
    FlightApiService,
    OpenTripMapService,
    TripAdvisorService,
    ViatorService,
    RecommendationsService,
  ],
})
export class TravelModule {}
