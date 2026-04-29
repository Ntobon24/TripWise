import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';
import { AuthService } from '../../core/services/auth.service';
import { TravelService } from '../../core/services/travel.service';
import type { RecommendationsPayload, UnifiedCity } from '../../core/models/api.types';
import { CurrencyService } from '../../core/services/currency.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AlertService } from '../../core/services/alert.service';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker';

@Component({
  selector: 'app-explore',
  imports: [FormsModule, RouterLink, DatePipe, CityTypeaheadComponent, MoneyPipe, DatePickerComponent],
  templateUrl: './explore.html',
  styleUrl: './explore.scss',
})
export class Explore implements OnInit {
  protected readonly travel = inject(TravelService);
  protected readonly auth = inject(AuthService);
  private readonly currencySvc = inject(CurrencyService);
  private readonly alert = inject(AlertService);

  protected readonly displayCurrency = this.currencySvc.displayCurrency;
  protected readonly displayMeta = computed(
    () => this.currencySvc.currencyMeta(this.displayCurrency()),
  );

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

  private static normalizeCityLabel(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
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

  protected onDepartureDateChange(value: string): void {
    this.departureDate = value;
  }

  protected onBudgetInput(): void {
    if (this.budget < 0) this.budget = 0;
    if (this.budget > 10_000_000) {
      this.budget = 10_000_000;
      this.alert.toast('warning', 'El presupuesto máximo es 10.000.000.');
    }
  }

  protected runRecommendations() {
    this.formErr.set('');
    const budget = Number(this.budget);
    if (!Number.isFinite(budget) || budget < 1) {
      this.formErr.set('El presupuesto debe ser al menos 1.');
      return;
    }
    if (budget > 10_000_000) {
      this.formErr.set('El presupuesto no puede superar 10.000.000.');
      return;
    }
    const oc = this.originCode.trim().toUpperCase();
    const dc = this.destCode.trim().toUpperCase();
    if (!oc) {
      this.formErr.set('Indica una ciudad de origen.');
      return;
    }
    if (!/^[A-Z0-9]{2,8}$/.test(oc)) {
      this.formErr.set('El código de origen solo puede tener letras y números (2–8 caracteres).');
      return;
    }
    if (!dc) {
      this.formErr.set('Indica una ciudad de destino.');
      return;
    }
    if (!/^[A-Z0-9]{2,8}$/.test(dc)) {
      this.formErr.set('El código de destino solo puede tener letras y números (2–8 caracteres).');
      return;
    }
    if (oc === dc) {
      const on = Explore.normalizeCityLabel(this.originName);
      const dn = Explore.normalizeCityLabel(this.destName);
      if (on === dn && on.length >= 2) {
        this.formErr.set('El origen y el destino no pueden ser la misma ciudad.');
        void this.alert.warning('Ciudad duplicada', `Origen y destino coinciden (${this.originName || oc}).`);
        return;
      }
      void this.alert.warning(
        'Mismo código de país o región',
        `Origen y destino comparten el código ${oc}, pero las ciudades son distintas (${this.originName || '?'} → ${this.destName || '?'}). ` +
          'Para resultados fiables indica el código IATA de cada aeropuerto (ej. BCN y MAD).',
      );
    }
    if (this.departureDate && this.departureDate < this.minDate) {
      this.formErr.set('La fecha de salida no puede ser anterior a hoy.');
      return;
    }
    this.loadingRec.set(true);
    this.err.set('');
    this.rec.set(null);
    this.flightPage = 0;
    const budgetUsd =
      this.currencySvc.convert(budget, this.displayCurrency(), 'USD') ?? budget;
    this.travel
      .recommendations({
        budget: Math.round(budgetUsd * 100) / 100,
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
          const msg = this.humanMessage(e, 'No se pudieron obtener las recomendaciones.');
          this.err.set(msg);
          this.loadingRec.set(false);
          void this.alert.error('Error al buscar recomendaciones', msg);
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
