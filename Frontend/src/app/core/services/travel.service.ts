import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type {
  CitiesSearchResponse,
  ExploreDestinationsResponse,
  RecommendationsPayload,
  TravelIntegrationsStatus,
} from '../models/api.types';

@Injectable({ providedIn: 'root' })
export class TravelService {
  private readonly http = inject(HttpClient);

  private url(path: string) {
    return `${environment.apiBaseUrl}${path}`;
  }

  getIntegrationsStatus() {
    return this.http.get<TravelIntegrationsStatus>(this.url('/travel/status'));
  }

  exploreDestinations(q: string) {
    return this.http.get<ExploreDestinationsResponse>(this.url('/explore/destinations'), {
      params: { q: q || 'Madrid' },
    });
  }

  searchCities(q: string, provider: 'geodb' | 'all' = 'all') {
    return this.http.get<CitiesSearchResponse>(this.url('/travel/cities/search'), {
      params: { q, provider },
    });
  }

  recommendations(params: {
    budget: number;
    originCityCode: string;
    destinationCityCode: string;
    originCityName?: string;
    destinationCityName?: string;
    departureDate?: string;
  }) {
    const p: Record<string, string> = {
      budget: String(params.budget),
      originCityCode: params.originCityCode,
      destinationCityCode: params.destinationCityCode,
    };
    if (params.originCityName) p['originCityName'] = params.originCityName;
    if (params.destinationCityName) p['destinationCityName'] = params.destinationCityName;
    if (params.departureDate) p['departureDate'] = params.departureDate;
    return this.http.get<RecommendationsPayload>(this.url('/travel/recommendations'), {
      params: p,
    });
  }

  autoPlan(params: { budget: number; originCityCode: string; originCityName?: string }) {
    const p: Record<string, string> = {
      budget: String(params.budget),
      originCityCode: params.originCityCode,
    };
    if (params.originCityName) p['originCityName'] = params.originCityName;
    return this.http.get<RecommendationsPayload>(this.url('/travel/auto-plan'), { params: p });
  }
}
