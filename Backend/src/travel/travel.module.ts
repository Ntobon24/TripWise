import { Module } from '@nestjs/common';
import { GeoDbService } from './geodb.service';
import { FlightApiService } from './flightapi.service';
import { OpenTripMapService } from './opentripmap.service';
import { GooglePlacesService } from './google-places.service';
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
    GooglePlacesService,
    TripAdvisorService,
    ViatorService,
    RecommendationsService,
  ],
  exports: [
    GeoDbService,
    FlightApiService,
    OpenTripMapService,
    GooglePlacesService,
    TripAdvisorService,
    ViatorService,
    RecommendationsService,
  ],
})
export class TravelModule {}
