import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';
import { AuthService } from '../../core/services/auth.service';
import { TravelService } from '../../core/services/travel.service';
import type { RecommendationsPayload, UnifiedCity } from '../../core/models/api.types';

@Component({
  selector: 'app-explore',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, CityTypeaheadComponent],
  templateUrl: './explore.html',
  styleUrl: './explore.scss',
})
export class Explore implements OnInit {
  protected readonly travel = inject(TravelService);
  protected readonly auth = inject(AuthService);

  protected destinations = signal<UnifiedCity[]>([]);
  protected searchQ = 'Madrid';

  protected budget = 1400;

  protected originCode = 'BOG';
  protected destCode = 'MAD';
  protected originName = 'Bogotá';
  protected destName = 'Madrid';

  protected departureDate = '';

  protected readonly minDate = Explore.isoDateLocal(new Date());

  protected rec = signal<RecommendationsPayload | null>(null);
  protected loadingDest = signal(false);
  protected loadingRec = signal(false);
  protected err = signal('');
  protected formErr = signal('');

  protected flightPage = 0;
  private readonly flightsPerPage = 4;

  protected get pagedFlights() {
    const flights = this.rec()?.flights ?? [];
    const start = this.flightPage * this.flightsPerPage;
    return flights.slice(start, start + this.flightsPerPage);
  }

  protected get totalFlightPages() {
    return Math.ceil((this.rec()?.flights.length ?? 0) / this.flightsPerPage);
  }

  protected prevFlightPage() {
    if (this.flightPage > 0) this.flightPage--;
  }

  protected nextFlightPage() {
    if (this.flightPage < this.totalFlightPages - 1) this.flightPage++;
  }

  private static isoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  ngOnInit() {
    this.runDestinationSearch();
  }

  protected runDestinationSearch() {
    this.loadingDest.set(true);
    this.err.set('');
    this.travel.exploreDestinations(this.searchQ.trim()).subscribe({
      next: (res) => {
        this.destinations.set(res.destinations ?? []);
        this.loadingDest.set(false);
      },
      error: (e) => {
        this.err.set(this.humanMessage(e, 'No se pudieron cargar los destinos.'));
        this.loadingDest.set(false);
      },
    });
  }

  protected runRecommendations() {
    this.formErr.set('');
    const budget = Number(this.budget);
    if (!Number.isFinite(budget) || budget < 0.01) {
      this.formErr.set('Indica un presupuesto válido (mín. 0,01).');
      return;
    }
    const oc = this.originCode.trim().toUpperCase();
    const dc = this.destCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(oc) || !/^[A-Z0-9]{2,8}$/.test(dc)) {
      this.formErr.set('Indica código de origen y destino válidos (2–8 caracteres).');
      return;
    }
    if (this.departureDate && !/^\d{4}-\d{2}-\d{2}$/.test(this.departureDate)) {
      this.formErr.set('La fecha debe tener formato AAAA-MM-DD.');
      return;
    }
    this.loadingRec.set(true);
    this.err.set('');
    this.rec.set(null);
    this.flightPage = 0;
    this.travel
      .recommendations({
        budget,
        originCityCode: oc,
        destinationCityCode: dc,
        originCityName: this.originName.trim() || undefined,
        destinationCityName: this.destName.trim() || undefined,
        departureDate: this.departureDate.trim() || undefined,
      })
      .subscribe({
        next: (r) => {
          this.rec.set(r);
          this.loadingRec.set(false);
        },
        error: (e) => {
          this.err.set(this.humanMessage(e, 'No se pudieron obtener las recomendaciones.'));
          this.loadingRec.set(false);
        },
      });
  }

  protected onSearchCityPicked(c: UnifiedCity) {
    this.searchQ = c.name;
    this.runDestinationSearch();
  }

  protected pickCity(c: UnifiedCity, field: 'origin' | 'dest') {
    const code = (c.code ?? '').toUpperCase();
    if (field === 'origin') {
      this.originName = c.name;
      if (code) this.originCode = code;
    } else {
      this.destName = c.name;
      if (code) this.destCode = code;
    }
  }

  private humanMessage(e: unknown, fallback: string): string {
    const ex = e as { error?: { message?: string | string[] } | string; message?: string };
    if (typeof ex?.error === 'string') return ex.error;
    const m = (ex?.error as { message?: string | string[] })?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
    if (typeof ex?.message === 'string') return ex.message;
    return fallback;
  }
}
