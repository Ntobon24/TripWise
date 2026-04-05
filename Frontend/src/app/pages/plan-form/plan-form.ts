import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import { TravelService } from '../../core/services/travel.service';
import type { ActivitySummary, FlightOfferSummary, RecommendationsPayload } from '../../core/models/api.types';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';

@Component({
  selector: 'app-plan-form',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, CityTypeaheadComponent],
  templateUrl: './plan-form.html',
  styleUrl: './plan-form.scss',
})
export class PlanForm {
  private readonly plansApi = inject(PlansService);
  private readonly travel = inject(TravelService);
  private readonly router = inject(Router);

  protected title = 'Mi viaje';
  protected budgetAmount = 1200;
  protected currency = 'USD';

  protected originCityCode = 'BOG';
  protected originCityName = 'Bogotá';
  protected destinationCityCode = 'MAD';
  protected destinationCityName = 'Madrid';

  protected departureDate = '';
  protected returnDate = '';

  protected readonly minDate = PlanForm.isoDateLocal(new Date());

  protected busy = signal(false);
  protected previewBusy = signal(false);
  protected preview = signal<RecommendationsPayload | null>(null);
  protected err = signal('');
  protected formErr = signal('');

  protected selectedFlightId = signal<string | null>(null);
  protected selectedActivityIds = signal<Set<string>>(new Set());

  protected flightPage = 0;
  private readonly flightsPerPage = 4;

  protected get pagedFlights(): FlightOfferSummary[] {
    const flights = this.preview()?.flights ?? [];
    const start = this.flightPage * this.flightsPerPage;
    return flights.slice(start, start + this.flightsPerPage);
  }

  protected get totalFlightPages(): number {
    return Math.ceil((this.preview()?.flights.length ?? 0) / this.flightsPerPage);
  }

  protected prevFlightPage(): void {
    if (this.flightPage > 0) this.flightPage--;
  }

  protected nextFlightPage(): void {
    if (this.flightPage < this.totalFlightPages - 1) this.flightPage++;
  }

  private static isoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private validateCore(): boolean {
    this.formErr.set('');
    if (!Number.isFinite(this.budgetAmount) || this.budgetAmount < 0.01) {
      this.formErr.set('El presupuesto debe ser al menos 0,01.');
      return false;
    }
    const oc = this.originCityCode.trim().toUpperCase();
    const dc = this.destinationCityCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(oc) || !/^[A-Z0-9]{2,8}$/.test(dc)) {
      this.formErr.set('Indica códigos de origen y destino válidos (2–8 caracteres).');
      return false;
    }
    if (this.departureDate && !/^\d{4}-\d{2}-\d{2}$/.test(this.departureDate)) {
      this.formErr.set('La fecha de ida no es válida.');
      return false;
    }
    if (this.returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(this.returnDate)) {
      this.formErr.set('La fecha de vuelta no es válida.');
      return false;
    }
    if (this.departureDate && this.returnDate && this.returnDate < this.departureDate) {
      this.formErr.set('La vuelta no puede ser anterior a la ida.');
      return false;
    }
    if (this.title.trim().length > 200) {
      this.formErr.set('El nombre del plan es demasiado largo.');
      return false;
    }
    return true;
  }

  protected previewRecommendations() {
    if (!this.validateCore()) return;
    this.err.set('');
    this.previewBusy.set(true);
    this.preview.set(null);
    this.selectedFlightId.set(null);
    this.selectedActivityIds.set(new Set());
    this.flightPage = 0;
    this.travel
      .recommendations({
        budget: this.budgetAmount,
        originCityCode: this.originCityCode.trim().toUpperCase(),
        destinationCityCode: this.destinationCityCode.trim().toUpperCase(),
        originCityName: this.originCityName.trim() || undefined,
        destinationCityName: this.destinationCityName.trim() || undefined,
        departureDate: this.departureDate.trim() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.preview.set(r);
          this.previewBusy.set(false);
        },
        error: (e) => {
          this.err.set(this.msg(e));
          this.previewBusy.set(false);
        },
      });
  }

  protected toggleFlight(f: FlightOfferSummary) {
    if (this.selectedFlightId() === f.id) {
      this.selectedFlightId.set(null);
    } else {
      this.selectedFlightId.set(f.id);
      if (f.departureAt) {
        const d = new Date(f.departureAt);
        if (!isNaN(d.getTime())) {
          this.departureDate = PlanForm.isoDateLocal(d);
        }
      }
    }
  }

  protected toggleActivity(a: ActivitySummary) {
    const ids = new Set(this.selectedActivityIds());
    if (ids.has(a.id)) {
      ids.delete(a.id);
    } else {
      ids.add(a.id);
    }
    this.selectedActivityIds.set(ids);
  }

  protected save() {
    if (!this.validateCore()) return;
    this.busy.set(true);
    this.err.set('');
    this.plansApi
      .create({
        title: this.title.trim() || 'Mi viaje',
        budgetAmount: this.budgetAmount,
        currency: this.currency.trim().toUpperCase() || 'USD',
        originCityCode: this.originCityCode.trim().toUpperCase(),
        originCityName: this.originCityName.trim(),
        destinationCityCode: this.destinationCityCode.trim().toUpperCase(),
        destinationCityName: this.destinationCityName.trim(),
        departureDate: this.departureDate.trim() || undefined,
        returnDate: this.returnDate.trim() || undefined,
      })
      .subscribe({
        next: (p) => {
          this.busy.set(false);
          void this.router.navigate(['/planes', p.id]);
        },
        error: (e) => {
          this.err.set(this.msg(e));
          this.busy.set(false);
        },
      });
  }

  private msg(e: unknown): string {
    const ex = e as { error?: { message?: string | string[] }; message?: string };
    const m = ex?.error?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
    if (typeof ex?.message === 'string') return ex.message;
    return 'No se pudo completar la operación.';
  }
}
