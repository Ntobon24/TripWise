import { Controller, Get, Query } from '@nestjs/common';
import { GeoDbService } from '../travel/geodb.service';
import { mapGeodbCity, type UnifiedCity } from '../travel/mappers/city-result.mapper';

/**
 * HU-19: exploración ligera de destinos sin autenticación.
 */
@Controller('explore')
export class ExploreController {
  constructor(private readonly geodb: GeoDbService) {}

  @Get('destinations')
  async featured(@Query('q') q?: string) {
    const keyword = (q ?? 'Madrid').trim();
    const geodbRaw = this.geodb.isConfigured() ? await this.geodb.searchCities(keyword, 15) : [];
    const geodb = (geodbRaw.map(mapGeodbCity).filter(Boolean) as UnifiedCity[]) ?? [];

    return {
      keyword,
      destinations: geodb,
      geodb,
      meta: {
        geodbConfigured: this.geodb.isConfigured(),
        hint: geodb.length
          ? 'Ciudades desde GeoDB (RapidAPI).'
          : 'Configura GEODB_RAPIDAPI_KEY en .env para ver ciudades reales.',
      },
    };
  }
}
