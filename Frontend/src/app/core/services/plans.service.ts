import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type {
  ActivitySummary,
  FlightOfferSummary,
  PlanReviewsResponse,
  PlansListResponse,
  TravelPlanSummary,
} from '../models/api.types';

export type PlanPayload = {
  title?: string;
  budgetAmount: number;
  currency?: string;
  originCityCode?: string;
  originCityName?: string;
  destinationCityCode?: string;
  destinationCityName?: string;
  departureDate?: string;
  returnDate?: string;
  lockSelections?: boolean;
  selectedFlight?: FlightOfferSummary | null;
  selectedActivities?: ActivitySummary[];
};

@Injectable({ providedIn: 'root' })
export class PlansService {
  private readonly http = inject(HttpClient);

  private url(path: string) {
    return `${environment.apiBaseUrl}${path}`;
  }

  /** HU-2 */
  list() {
    return this.http.get<PlansListResponse>(this.url('/plans'));
  }

  getOne(id: string) {
    return this.http.get<TravelPlanSummary>(this.url(`/plans/${id}`));
  }

  /** OpenTripMap: descripciones / valoraciones por actividad del plan. */
  getReviews(planId: string) {
    return this.http.get<PlanReviewsResponse>(this.url(`/plans/${planId}/reviews`));
  }

  create(body: PlanPayload) {
    return this.http.post<TravelPlanSummary>(this.url('/plans'), body);
  }

  /** HU-2 + HU-6 + HU-4 (recomendaciones al guardar) */
  update(id: string, body: Partial<PlanPayload>) {
    return this.http.patch<TravelPlanSummary>(this.url(`/plans/${id}`), body);
  }

  delete(id: string) {
    return this.http.delete<{ success: boolean; message: string }>(
      this.url(`/plans/${id}`),
    );
  }

  refreshAiEstimates(planId: string) {
    return this.http.post<TravelPlanSummary>(this.url(`/plans/${planId}/ai-estimates`), {});
  }

  createAiExperience(body: {
    budget: number;
    currency?: string;
    originCityCode: string;
    originCityName?: string;
    continent?: string;
    tripDays?: number;
    interests?: string;
    pace?: string;
    travelParty?: string;
  }) {
    return this.http.post<TravelPlanSummary>(this.url('/plans/ai-experience'), body);
  }
}
