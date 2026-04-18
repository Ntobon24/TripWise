import { BadRequestException, Injectable } from '@nestjs/common';
import { GeoDbService } from './geodb.service';
import { FlightApiService } from './flightapi.service';
import { OpenTripMapService } from './opentripmap.service';
import type { FlightOfferSummary } from './mappers/flight-offer.mapper';
import { mapFlightApiResponseToSummaries } from './mappers/flightapi-response.mapper';
import { mapOtmFeatureToSummary } from './mappers/otm-place.mapper';
import type { ActivitySummary } from './mappers/activity.mapper';

export type BudgetRecommendationInput = {
  budget: number;
  currency?: string;
  originCityCode: string;
  originCityName?: string;
  destinationCityCode: string;
  destinationCityName?: string;
  departureDate?: string;
};

type DestinationOption = {
  cityCode: string;
  cityName: string;
  minBudget: number;
  maxBudget: number;
};

const MIN_BUDGET = 0.01;
const MAX_BUDGET = 10_000_000;
const DESTINATION_POOL: DestinationOption[] = [
  { cityCode: 'NYC', cityName: 'New York', minBudget: 1100, maxBudget: 6000 },
  { cityCode: 'LON', cityName: 'Londres', minBudget: 1050, maxBudget: 5600 },
  { cityCode: 'BER', cityName: 'Berlin', minBudget: 850, maxBudget: 4300 },
  { cityCode: 'ROM', cityName: 'Roma', minBudget: 900, maxBudget: 4500 },
  { cityCode: 'AMS', cityName: 'Amsterdam', minBudget: 950, maxBudget: 4700 },
  { cityCode: 'IST', cityName: 'Estambul', minBudget: 700, maxBudget: 3800 },
  { cityCode: 'DXB', cityName: 'Dubai', minBudget: 1200, maxBudget: 7000 },
  { cityCode: 'BKK', cityName: 'Bangkok', minBudget: 900, maxBudget: 5000 },
  { cityCode: 'TYO', cityName: 'Tokyo', minBudget: 1300, maxBudget: 7800 },
  { cityCode: 'SEL', cityName: 'Seul', minBudget: 1200, maxBudget: 7200 },
  { cityCode: 'SIN', cityName: 'Singapur', minBudget: 1350, maxBudget: 7600 },
  { cityCode: 'SYD', cityName: 'Sidney', minBudget: 1600, maxBudget: 9000 },
  { cityCode: 'CPT', cityName: 'Ciudad del Cabo', minBudget: 1200, maxBudget: 6800 },
  { cityCode: 'CAI', cityName: 'El Cairo', minBudget: 700, maxBudget: 3600 },
  { cityCode: 'MRA', cityName: 'Marrakech', minBudget: 780, maxBudget: 3900 },
  { cityCode: 'MEX', cityName: 'Ciudad de Mexico', minBudget: 350, maxBudget: 2200 },
  { cityCode: 'LIM', cityName: 'Lima', minBudget: 320, maxBudget: 2100 },
  { cityCode: 'SCL', cityName: 'Santiago de Chile', minBudget: 380, maxBudget: 2600 },
  { cityCode: 'MAD', cityName: 'Madrid', minBudget: 700, maxBudget: 4000 },
  { cityCode: 'BCN', cityName: 'Barcelona', minBudget: 760, maxBudget: 4200 },
  { cityCode: 'MIA', cityName: 'Miami', minBudget: 650, maxBudget: 3500 },
  { cityCode: 'CUN', cityName: 'Cancun', minBudget: 450, maxBudget: 2800 },
  { cityCode: 'BUE', cityName: 'Buenos Aires', minBudget: 450, maxBudget: 2600 },
  { cityCode: 'RIO', cityName: 'Rio de Janeiro', minBudget: 550, maxBudget: 3200 },
  { cityCode: 'PAR', cityName: 'Paris', minBudget: 900, maxBudget: 5200 },
  { cityCode: 'ZRH', cityName: 'Zurich', minBudget: 1200, maxBudget: 7000 },
  { cityCode: 'PRG', cityName: 'Praga', minBudget: 780, maxBudget: 3900 },
  { cityCode: 'VIE', cityName: 'Viena', minBudget: 820, maxBudget: 4100 },
  { cityCode: 'BUD', cityName: 'Budapest', minBudget: 700, maxBudget: 3600 },
  { cityCode: 'ATH', cityName: 'Atenas', minBudget: 760, maxBudget: 3900 },
  { cityCode: 'MNL', cityName: 'Manila', minBudget: 900, maxBudget: 5000 },
  { cityCode: 'DEL', cityName: 'Nueva Delhi', minBudget: 900, maxBudget: 5200 },
  { cityCode: 'JNB', cityName: 'Johannesburgo', minBudget: 1050, maxBudget: 6000 },
  { cityCode: 'HNL', cityName: 'Honolulu', minBudget: 1500, maxBudget: 8200 },
];

function defaultDepartureDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 10);
}


function normalizeLocationCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly geodb: GeoDbService,
    private readonly flightApi: FlightApiService,
    private readonly otm: OpenTripMapService,
  ) {}

  assertValidBudget(budget: number) {
    if (Number.isNaN(budget) || budget < MIN_BUDGET || budget > MAX_BUDGET) {
      throw new BadRequestException(
        'El presupuesto no es válido. Indica un valor positivo dentro de un rango razonable.',
      );
    }
  }

  private async getDestinationCoords(
    destCode: string,
    destLabel: string | null | undefined,
  ): Promise<{ lat: number; lng: number; label: string | null } | null> {
    const keyword = (destLabel ?? destCode).slice(0, 80);
    if (!this.geodb.isConfigured()) {
      return null;
    }
    const c = await this.geodb.getFirstCityCoords(keyword);
    if (!c) {
      return null;
    }
    return { lat: c.latitude, lng: c.longitude, label: destLabel ?? null };
  }

  async buildRecommendations(input: BudgetRecommendationInput) {
    this.assertValidBudget(input.budget);

    const origin = normalizeLocationCode(input.originCityCode.trim());
    const dest = normalizeLocationCode(input.destinationCityCode.trim());
    let originLabel = input.originCityName?.trim() || null;
    let destLabel = input.destinationCityName?.trim() || null;
    const departureDate = input.departureDate?.trim() || defaultDepartureDate();
    const currency = (input.currency ?? 'USD').trim().toUpperCase();

    if (origin.length < 2 || dest.length < 2) {
      throw new BadRequestException(
        'Indica al menos 2 letras para origen y destino (p. ej. MX, MEX, BOG, MAD).',
      );
    }

    if (!this.flightApi.isConfigured()) {
      return {
        budget: input.budget,
        currency,
        origin: { code: origin, name: originLabel },
        destination: { code: dest, name: destLabel },
        departureDate,
        flights: [] as FlightOfferSummary[],
        activities: [] as ActivitySummary[],
        meta: {
          source: 'tripwise',
          flightProvider: null as string | null,
          flightApiConfigured: false,
          geodbConfigured: this.geodb.isConfigured(),
          openTripMapConfigured: this.otm.isConfigured(),
          message:
            'Sin vuelos: añade FLIGHTAPI_API_KEY en Backend/.env (https://www.flightapi.io/). Para puntos de interés: OPENTRIPMAP_API_KEY y GEODB_RAPIDAPI_KEY.',
        },
      };
    }

    const raw = await this.flightApi.searchOneway({
      departureAirport: origin,
      arrivalAirport: dest,
      departureDate,
      currency,
    });

    const flightRows: FlightOfferSummary[] = raw
      ? mapFlightApiResponseToSummaries(raw, input.budget, currency)
      : [];

    const within = flightRows.filter((f) => f.withinBudget);
    const flightsPick = within.length ? within : flightRows.slice(0, 12);

    let activities: ActivitySummary[] = [];
    const coords = await this.getDestinationCoords(dest, destLabel);
    if (coords && !destLabel && coords.label) {
      destLabel = coords.label;
    }

    if (coords && this.otm.isConfigured()) {
      const feats = await this.otm.searchPlacesAroundRadius({
        lat: coords.lat,
        lng: coords.lng,
        radiusMeters: 8000,
        limit: 40,
      });
      activities = feats
        .map((f) => mapOtmFeatureToSummary(f as Record<string, unknown>))
        .map((a) => ({
          ...a,
          withinBudget:
            typeof a.priceAmount === 'number' && !Number.isNaN(a.priceAmount)
              ? a.priceAmount <= input.budget
              : null,
        }))
        .filter((a) => (a.popularity ?? 0) >= 3)
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 15);
    }

    const actsInBudget = activities.filter((a) => a.withinBudget === true);

    const note =
      within.length === 0 && flightRows.length > 0
        ? 'Ningún vuelo de las primeras opciones entra en tu presupuesto; mostramos los más económicos.'
        : flightRows.length === 0
          ? 'No hay itinerarios para esta ruta/fecha. Prueba otras fechas o otros códigos IATA de aeropuerto.'
          : undefined;

    return {
      budget: input.budget,
      currency,
      origin: { code: origin, name: originLabel },
      destination: { code: dest, name: destLabel },
      departureDate,
      flights: flightsPick,
      activities: actsInBudget.length ? actsInBudget.slice(0, 15) : activities.slice(0, 12),
      meta: {
        source: 'flightapi',
        flightProvider: 'flightapi',
        flightApiConfigured: true,
        geodbConfigured: this.geodb.isConfigured(),
        openTripMapConfigured: this.otm.isConfigured(),
        flightsFound: flightRows.length,
        note,
      },
    };
  }

  async buildAutoPlan(input: {
    budget: number;
    originCityCode: string;
    originCityName?: string;
  }) {
    this.assertValidBudget(input.budget);
    const origin = normalizeLocationCode(input.originCityCode.trim());
    const options = DESTINATION_POOL.filter(
      (d) =>
        d.cityCode !== origin &&
        input.budget >= d.minBudget * 0.75 &&
        input.budget <= d.maxBudget * 1.2,
    );
    const pool = options.length ? options : DESTINATION_POOL.filter((d) => d.cityCode !== origin);
    const index = Math.floor(Math.random() * Math.max(pool.length, 1));
    const picked = pool[index] ?? DESTINATION_POOL[0];

    const rec = await this.buildRecommendations({
      budget: input.budget,
      originCityCode: origin,
      originCityName: input.originCityName,
      destinationCityCode: picked.cityCode,
      destinationCityName: picked.cityName,
    });

    return {
      ...rec,
      meta: {
        ...rec.meta,
        source: 'auto-plan',
        note: 'Plan sugerido automaticamente segun tu presupuesto.',
      },
    };
  }
}
