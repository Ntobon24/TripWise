import { Controller, Get, Query } from '@nestjs/common';
import { GeoDbService } from './geodb.service';
import { FlightApiService } from './flightapi.service';
import { OpenTripMapService } from './opentripmap.service';
import { TripAdvisorService } from './tripadvisor.service';
import { ViatorService } from './viator.service';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsQueryDto } from './dto/recommendations-query.dto';
import { CitiesSearchQueryDto } from './dto/cities-search-query.dto';
import { AutoPlanQueryDto } from './dto/auto-plan-query.dto';
import { mapGeodbCity, type UnifiedCity } from './mappers/city-result.mapper';
import { GroqService } from '../groq/groq.service';


@Controller('travel')
export class TravelController {
  constructor(
    private readonly geodb: GeoDbService,
    private readonly flightApi: FlightApiService,
    private readonly otm: OpenTripMapService,
    private readonly tripadvisor: TripAdvisorService,
    private readonly viator: ViatorService,
    private readonly recommendationsService: RecommendationsService,
    private readonly groq: GroqService,
  ) {}

  @Get('status')
  status() {
    return {
      flightApi: {
        configured: this.flightApi.isConfigured(),
        hint: this.flightApi.isConfigured()
          ? null
          : 'Añade FLIGHTAPI_API_KEY en .env (https://www.flightapi.io/).',
      },
      geodb: {
        configured: this.geodb.isConfigured(),
        hint: this.geodb.isConfigured()
          ? null
          : 'GEODB_RAPIDAPI_KEY en .env (RapidAPI GeoDB Cities) para búsqueda de ciudades.',
      },
      openTripMap: {
        configured: this.otm.isConfigured(),
        hint: this.otm.isConfigured()
          ? null
          : 'OPENTRIPMAP_API_KEY (opentripmap.io) para puntos de interés.',
      },
      tripadvisor: {
        configured: this.tripadvisor.isConfigured(),
        hint: this.tripadvisor.isConfigured()
          ? null
          : 'TRIPADVISOR_API_KEY reservada; la API oficial suele requerir acuerdo partner.',
      },
      viator: {
        configured: this.viator.isConfigured(),
        hint: this.viator.isConfigured()
          ? null
          : 'VIATOR_API_KEY reservada; el programa partner requiere alta en Viator.',
      },
      groq: {
        configured: this.groq.isConfigured(),
        hint: this.groq.isConfigured()
          ? null
          : 'GROQ_API_KEY en .env (https://console.groq.com/) para estimaciones y plan «Crea tu experiencia».',
      },
    };
  }

  @Get('cities/search')
  async searchCities(@Query() query: CitiesSearchQueryDto) {
    const geodbRaw = await this.geodb.searchCities(query.q, 12);

    const geodb = (geodbRaw.map(mapGeodbCity).filter(Boolean) as UnifiedCity[]) ?? [];

    return {
      query: query.q,
      cities: geodb,
      geodb,
      meta: {
        geodbConfigured: this.geodb.isConfigured(),
      },
    };
  }

  @Get('recommendations')
  async getRecommendations(@Query() query: RecommendationsQueryDto) {
    return this.recommendationsService.buildRecommendations({
      budget: query.budget,
      originCityCode: query.originCityCode,
      destinationCityCode: query.destinationCityCode,
      originCityName: query.originCityName,
      destinationCityName: query.destinationCityName,
      departureDate: query.departureDate,
    });
  }

  @Get('auto-plan')
  async getAutoPlan(@Query() query: AutoPlanQueryDto) {
    return this.recommendationsService.buildAutoPlan({
      budget: query.budget,
      originCityCode: query.originCityCode,
      originCityName: query.originCityName,
    });
  }
}
