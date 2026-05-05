import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import { TravelService } from '../../core/services/travel.service';
import type { ActivitySummary, FlightOfferSummary, RecommendationsPayload } from '../../core/models/api.types';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';
import { CurrencyService } from '../../core/services/currency.service';
import { CurrencySelectorComponent } from '../../shared/components/currency-selector/currency-selector';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AlertService } from '../../core/services/alert.service';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker';

type SelectableActivity = { key: string; value: ActivitySummary };

@Component({
  selector: 'app-plan-form',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    CityTypeaheadComponent,
    CurrencySelectorComponent,
    MoneyPipe,
    DatePickerComponent,
  ],
  templateUrl: './plan-form.html',
  styleUrl: './plan-form.scss',
})
export class PlanForm {
  private readonly plansApi = inject(PlansService);
  private readonly travel = inject(TravelService);
  private readonly router = inject(Router);
  private readonly currencySvc = inject(CurrencyService);
  private readonly alert = inject(AlertService);

  protected readonly STORAGE_CURRENCY = 'USD';
  protected readonly displayCurrency = this.currencySvc.displayCurrency;
  protected readonly currencyMeta = computed(
    () => this.currencySvc.currencyMeta(this.displayCurrency()),
  );

  protected title = 'Mi viaje';
  protected budgetAmount = 1200;

  protected originCityCode = 'BOG';
  protected originCityName = 'Bogotá';
  protected destinationCityCode = 'MAD';
  protected destinationCityName = 'Madrid';

  protected departureDate = '';
  protected returnDate = '';
  protected decideForMe = false;

  protected readonly minDate = PlanForm.isoDateLocal(new Date());

  protected readonly DONUT_R = 38;
  protected readonly DONUT_C = 2 * Math.PI * 38;

  protected readonly flightPct = computed(() => {
    const budget = this.budgetInBaseCurrency();
    if (!budget) return 0;
    return Math.min(100, (this.selectedFlightCost() / budget) * 100);
  });

  protected readonly activitiesPct = computed(() => {
    const budget = this.budgetInBaseCurrency();
    if (!budget) return 0;
    const flightP = this.flightPct();
    const actP = (this.selectedActivitiesCost() / budget) * 100;
    return Math.max(0, Math.min(actP, 100 - flightP));
  });

  protected readonly usedPct = computed(() => {
    const budget = this.budgetInBaseCurrency();
    if (!budget) return 0;
    return Math.min(100, (this.selectedTotalCost() / budget) * 100);
  });

  protected readonly flightArc = computed(() => (this.flightPct() / 100) * this.DONUT_C);
  protected readonly activitiesArc = computed(() => (this.activitiesPct() / 100) * this.DONUT_C);
  protected readonly activitiesRotateDeg = computed(() => -90 + (this.flightPct() / 100) * 360);

  protected busy = signal(false);
  protected previewBusy = signal(false);
  protected preview = signal<RecommendationsPayload | null>(null);
  protected err = signal('');
  protected formErr = signal('');
  protected saveTried = signal(false);

  protected selectedFlightId = signal<string | null>(null);
  protected selectedActivityKeys = signal<Set<string>>(new Set());
  protected selectedActivitiesMap = signal<Map<string, ActivitySummary>>(new Map());

  protected flightPage = 0;
  private readonly flightsPerPage = 4;
  protected activityPage = 0;
  private readonly activitiesPerPage = 8;
  protected activityCategoryFilter = 'Todos';

  protected get pagedFlights(): FlightOfferSummary[] {
    const flights = this.preview()?.flights ?? [];
    const start = this.flightPage * this.flightsPerPage;
    return flights.slice(start, start + this.flightsPerPage);
  }

  protected get totalFlightPages(): number {
    return Math.ceil((this.preview()?.flights.length ?? 0) / this.flightsPerPage);
  }

  protected get activityCategories(): string[] {
    const set = new Set<string>(['Todos']);
    for (const a of this.selectableActivities) {
      set.add(a.value.category?.trim() || 'Turismo');
    }
    return Array.from(set);
  }

  protected get selectableActivities(): SelectableActivity[] {
    return (this.preview()?.activities ?? []).map((value, index) => ({
      key: `${value.id || 'act'}::${value.name || 'sin-nombre'}::${index}`,
      value,
    }));
  }

  protected get filteredActivities(): SelectableActivity[] {
    const selected = this.activityCategoryFilter;
    const all = this.selectableActivities;
    if (selected === 'Todos') return all;
    return all.filter((a) => (a.value.category?.trim() || 'Turismo') === selected);
  }

  protected get pagedActivities(): SelectableActivity[] {
    const start = this.activityPage * this.activitiesPerPage;
    return this.filteredActivities.slice(start, start + this.activitiesPerPage);
  }

  protected get totalActivityPages(): number {
    return Math.ceil(this.filteredActivities.length / this.activitiesPerPage);
  }

  protected prevFlightPage(): void {
    if (this.flightPage > 0) this.flightPage--;
  }

  protected nextFlightPage(): void {
    if (this.flightPage < this.totalFlightPages - 1) this.flightPage++;
  }

  protected prevActivityPage(): void {
    if (this.activityPage > 0) this.activityPage--;
  }

  protected nextActivityPage(): void {
    if (this.activityPage < this.totalActivityPages - 1) this.activityPage++;
  }

  protected onActivityCategoryChange(category: string): void {
    this.activityCategoryFilter = category;
    this.activityPage = 0;
  }

  protected onDecideForMeToggle(value: boolean): void {
    this.decideForMe = value;
    if (value) {
      this.preview.set(null);
      this.selectedFlightId.set(null);
      this.selectedActivityKeys.set(new Set());
      this.selectedActivitiesMap.set(new Map());
    }
  }

  private static isoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  protected addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return PlanForm.isoDateLocal(d);
  }

  protected onDepartureDateChange(value: string): void {
    this.departureDate = value;
    if (!value) return;
    if (this.returnDate && value > this.returnDate) {
      this.alert.toast('info', 'La fecha de vuelta se ha limpiado porque quedó antes de la ida.');
      this.returnDate = '';
    }
  }

  protected onReturnDateChange(value: string): void {
    this.returnDate = value;
    if (!value || !this.departureDate) return;
    if (value === this.departureDate) {
      this.alert.toast('info', 'La ida y la vuelta son el mismo día. Considera ajustar el período.');
    }
  }

  protected onBudgetInput(): void {
    if (this.budgetAmount < 0) {
      this.budgetAmount = 0;
    }
    if (this.budgetAmount > 10_000_000) {
      this.budgetAmount = 10_000_000;
      this.alert.toast('warning', 'El presupuesto máximo es 10.000.000.');
    }
  }

  protected isValidCode(code: string): boolean {
    return /^[A-Z0-9]{2,8}$/.test(code.trim().toUpperCase());
  }

  protected onOriginPicked(): void {
    this.checkSameCityConflict('origen');
  }

  protected onDestinationPicked(): void {
    this.checkSameCityConflict('destino');
  }

  private checkSameCityConflict(picked: 'origen' | 'destino'): void {
    setTimeout(() => {
      const oc = (this.originCityCode || '').trim().toUpperCase();
      const dc = (this.destinationCityCode || '').trim().toUpperCase();
      if (!oc || !dc || oc !== dc) return;
      const on = PlanForm.normalizeCityLabel(this.originCityName || '');
      const dn = PlanForm.normalizeCityLabel(this.destinationCityName || '');
      if (on && dn && on !== dn) return;

      this.alert.toast('warning', `Origen y destino tienen el mismo código (${oc}). Ajústalo manualmente si son ciudades distintas.`);
      void this.alert.warning(
        'Códigos en conflicto',
        `El código IATA de ${picked} (${oc}) coincide con el de la otra ciudad. ` +
          'Esto suele ocurrir cuando ambas ciudades comparten país y aún no se ha detectado el código de aeropuerto. ' +
          'Ajusta manualmente el código IATA del aeropuerto correspondiente (ej. BOG para Bogotá, MDE para Medellín).',
      );
    }, 50);
  }

  private static normalizeCityLabel(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private isValidDateFormat(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const [y, m, day] = date.split('-').map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
  }

  private validateCore(): boolean {
    this.formErr.set('');
    const budget = this.budgetAmount;
    if (!Number.isFinite(budget) || budget < 1) {
      this.formErr.set('El presupuesto debe ser al menos 1.');
      return false;
    }
    if (budget > 10_000_000) {
      this.formErr.set('El presupuesto no puede superar 10.000.000.');
      return false;
    }
    const oc = this.originCityCode.trim().toUpperCase();
    const dc = this.destinationCityCode.trim().toUpperCase();
    if (!oc) {
      this.formErr.set('Indica la ciudad de origen.');
      return false;
    }
    if (!/^[A-Z0-9]{2,8}$/.test(oc)) {
      this.formErr.set('El código de origen solo puede tener letras y números (2–8 caracteres).');
      return false;
    }
    if (!this.decideForMe) {
      if (!dc) {
        this.formErr.set('Indica la ciudad de destino.');
        return false;
      }
      if (!/^[A-Z0-9]{2,8}$/.test(dc)) {
        this.formErr.set('El código de destino solo puede tener letras y números (2–8 caracteres).');
        return false;
      }
      if (oc === dc) {
        const on = PlanForm.normalizeCityLabel(this.originCityName);
        const dn = PlanForm.normalizeCityLabel(this.destinationCityName);
        if (on === dn && on.length >= 2) {
          this.formErr.set(
            `Origen y destino no pueden ser la misma ciudad (${this.originCityName || oc}).`,
          );
          return false;
        }
        void this.alert.warning(
          'Mismo código de país o región',
          `Origen y destino comparten el código ${oc}, pero las ciudades son distintas (${this.originCityName || '?'} → ${this.destinationCityName || '?'}). ` +
            'Para vuelos fiables indica el código IATA de cada aeropuerto (ej. BCN y MAD).',
        );
      }
    }
    if (this.departureDate) {
      if (!this.isValidDateFormat(this.departureDate)) {
        this.formErr.set('La fecha de ida no es válida. Usa el formato AAAA-MM-DD.');
        return false;
      }
      if (this.departureDate < this.minDate) {
        this.formErr.set('La fecha de ida no puede ser anterior a hoy.');
        return false;
      }
    }
    if (this.returnDate) {
      if (!this.isValidDateFormat(this.returnDate)) {
        this.formErr.set('La fecha de vuelta no es válida. Usa el formato AAAA-MM-DD.');
        return false;
      }
      if (this.returnDate < this.minDate) {
        this.formErr.set('La fecha de vuelta no puede ser anterior a hoy.');
        return false;
      }
      if (this.departureDate && this.returnDate < this.departureDate) {
        this.formErr.set('La fecha de vuelta no puede ser anterior a la de ida.');
        return false;
      }
      if (this.departureDate) {
        const maxReturn = this.addDays(this.departureDate, 365);
        if (this.returnDate > maxReturn) {
          this.formErr.set('El viaje no puede durar más de un año.');
          return false;
        }
      }
    }
    const title = this.title.trim();
    if (!this.decideForMe && title.length === 0) {
      this.formErr.set('Indica un nombre para el plan.');
      return false;
    }
    if (title.length > 0 && title.length < 2) {
      this.formErr.set('El nombre del plan debe tener al menos 2 caracteres.');
      return false;
    }
    if (title.length > 200) {
      this.formErr.set('El nombre del plan no puede superar 200 caracteres.');
      return false;
    }
    return true;
  }

  protected previewRecommendations() {
    this.saveTried.set(true);
    if (!this.validateCore()) {
      const msg = this.formErr();
      if (msg) void this.alert.validation('Revisa el formulario', msg);
      return;
    }
    this.err.set('');
    this.previewBusy.set(true);
    this.preview.set(null);
    this.selectedFlightId.set(null);
    this.selectedActivityKeys.set(new Set());
    this.selectedActivitiesMap.set(new Map());
    this.flightPage = 0;
    this.activityPage = 0;
    this.activityCategoryFilter = 'Todos';
    const budget = this.toStoredBudget(this.budgetAmount);
    const originCityCode = this.originCityCode.trim().toUpperCase();
    const originCityName = this.originCityName.trim() || undefined;
    const destinationCityCode = this.destinationCityCode.trim().toUpperCase();
    const destinationCityName = this.destinationCityName.trim() || undefined;
    const departureDate = this.departureDate.trim() || undefined;
    const rec$ = this.decideForMe
      ? this.travel.autoPlan({
          budget,
          originCityCode,
          originCityName,
        })
      : this.travel.recommendations({
          budget,
          originCityCode,
          destinationCityCode,
          originCityName,
          destinationCityName,
          departureDate,
        });
    rec$.subscribe({
        next: (r) => {
          this.preview.set(r);
          if (this.decideForMe) {
            this.destinationCityCode = r.destination.code;
            this.destinationCityName = r.destination.name ?? this.destinationCityName;
            this.departureDate = r.departureDate || this.departureDate;
            this.title = this.buildAutoTitle(r.destination.name ?? r.destination.code, r.departureDate);
            const firstFlight = r.flights[0];
            if (firstFlight) {
              this.selectedFlightId.set(String(firstFlight.id));
            }
            const autoActs = new Map<string, ActivitySummary>();
            this.selectableActivities.slice(0, 4).forEach((a) => {
              autoActs.set(a.key, a.value);
            });
            this.selectedActivitiesMap.set(autoActs);
            this.selectedActivityKeys.set(new Set(autoActs.keys()));
          }
          this.previewBusy.set(false);
        },
        error: (e) => {
          const errMsg = this.msg(e);
          this.err.set(errMsg);
          this.previewBusy.set(false);
          void this.alert.error('No se pudieron cargar recomendaciones', errMsg);
        },
      });
  }

  protected toggleFlight(f: FlightOfferSummary) {
    const fid = String(f.id);
    if (this.selectedFlightId() === fid) {
      this.selectedFlightId.set(null);
    } else {
      this.selectedFlightId.set(fid);
      if (f.departureAt) {
        const d = new Date(f.departureAt);
        if (!isNaN(d.getTime())) {
          this.departureDate = PlanForm.isoDateLocal(d);
        }
      }
    }
  }

  protected activityTrackKey(item: SelectableActivity): string {
    return item.key;
  }

  protected isActivitySelected(key: string): boolean {
    return this.selectedActivityKeys().has(key);
  }

  protected toggleActivity(item: SelectableActivity) {
    const key = item.key;
    const keys = new Set(this.selectedActivityKeys());
    const map = new Map(this.selectedActivitiesMap());
    if (keys.has(key)) {
      keys.delete(key);
      map.delete(key);
    } else {
      keys.add(key);
      map.set(key, {
        id: item.value.id,
        name: item.value.name ?? null,
        shortDescription: item.value.shortDescription ?? null,
        category: item.value.category ?? null,
        popularity: item.value.popularity ?? null,
        priceAmount: item.value.priceAmount ?? null,
        priceCurrency: item.value.priceCurrency ?? null,
        estimatedPrice: Boolean(item.value.estimatedPrice),
        withinBudget: item.value.withinBudget ?? null,
      });
    }
    this.selectedActivityKeys.set(keys);
    this.selectedActivitiesMap.set(map);
  }

  protected selectedFlight(): FlightOfferSummary | null {
    const id = this.selectedFlightId();
    if (!id) return null;
    return this.preview()?.flights.find((f) => String(f.id) === id) ?? null;
  }

  protected selectedActivities(): ActivitySummary[] {
    return Array.from(this.selectedActivitiesMap().values());
  }

  protected selectedActivitiesCost(): number {
    return this.selectedActivities().reduce((acc, item) => acc + (item.priceAmount ?? 0), 0);
  }

  protected selectedFlightCost(): number {
    return this.selectedFlight()?.totalPrice ?? 0;
  }

  protected selectedTotalCost(): number {
    return this.selectedFlightCost() + this.selectedActivitiesCost();
  }

  protected remainingBudget(): number {
    return this.budgetInBaseCurrency() - this.selectedTotalCost();
  }

  protected save() {
    this.saveTried.set(true);
    if (!this.validateCore()) {
      const msg = this.formErr();
      if (msg) void this.alert.validation('Revisa el formulario', msg);
      return;
    }
    this.busy.set(true);
    this.err.set('');
    if (this.decideForMe) {
      this.saveWithAutoPlan();
      return;
    }
    this.createPlan({
      title: this.title.trim() || 'Mi viaje',
      budgetAmount: this.toStoredBudget(this.budgetAmount),
      currency: this.STORAGE_CURRENCY,
      originCityCode: this.originCityCode.trim().toUpperCase(),
      originCityName: this.originCityName.trim(),
      destinationCityCode: this.destinationCityCode.trim().toUpperCase(),
      destinationCityName: this.destinationCityName.trim(),
      departureDate: this.departureDate.trim() || undefined,
      returnDate: this.returnDate.trim() || undefined,
      selectedFlight: this.selectedFlight(),
      selectedActivities: this.selectedActivities(),
      lockSelections: true,
    });
  }

  private toStoredBudget(amount: number): number {
    const converted = this.currencySvc.convert(
      amount,
      this.displayCurrency(),
      this.STORAGE_CURRENCY,
    );
    if (converted === null || !Number.isFinite(converted)) {
      return amount;
    }
    return Math.round(converted * 100) / 100;
  }

  protected budgetInBaseCurrency(): number {
    return this.toStoredBudget(this.budgetAmount);
  }

  private saveWithAutoPlan() {
    const budgetUsd = this.toStoredBudget(this.budgetAmount);
    this.travel
      .autoPlan({
        budget: budgetUsd,
        originCityCode: this.originCityCode.trim().toUpperCase(),
        originCityName: this.originCityName.trim() || undefined,
      })
      .subscribe({
        next: (rec) => {
          const selectedFlight = this.pickFlightForAuto(rec);
          if (!selectedFlight) {
            const msg =
              'No se encontró un vuelo válido para tu presupuesto. Ajusta el monto e inténtalo de nuevo.';
            this.err.set(msg);
            this.busy.set(false);
            void this.alert.warning('Sin vuelos disponibles', msg);
            return;
          }

          const flightCost = selectedFlight.totalPrice ?? 0;
          const remaining = Math.max(0, budgetUsd - flightCost);
          const selectedActivities = this.pickActivitiesForAuto(rec.activities ?? [], remaining);

          this.destinationCityCode = rec.destination.code;
          this.destinationCityName = rec.destination.name ?? this.destinationCityName;
          this.departureDate = rec.departureDate || this.departureDate;
          this.title = this.buildAutoTitle(rec.destination.name ?? rec.destination.code, rec.departureDate);

          this.createPlan({
            title: this.title,
            budgetAmount: budgetUsd,
            currency: this.STORAGE_CURRENCY,
            originCityCode: this.originCityCode.trim().toUpperCase(),
            originCityName: this.originCityName.trim(),
            destinationCityCode: rec.destination.code,
            destinationCityName: rec.destination.name ?? this.destinationCityName,
            departureDate: rec.departureDate || undefined,
            returnDate: this.returnDate.trim() || undefined,
            selectedFlight,
            selectedActivities,
            lockSelections: true,
          });
        },
        error: (e) => {
          this.err.set(this.msg(e));
          this.busy.set(false);
        },
      });
  }

  private pickFlightForAuto(rec: RecommendationsPayload): FlightOfferSummary | null {
    const flights = rec.flights ?? [];
    if (!flights.length) return null;
    const withinBudget = flights.filter((f) => f.withinBudget);
    if (withinBudget.length) {
      return withinBudget.sort((a, b) => a.totalPrice - b.totalPrice)[0];
    }
    return flights.sort((a, b) => a.totalPrice - b.totalPrice)[0] ?? null;
  }

  private pickActivitiesForAuto(all: ActivitySummary[], remainingBudget: number): ActivitySummary[] {
    if (remainingBudget <= 0 || !all.length) return [];
    const sorted = [...all].sort((a, b) => {
      const pa = a.popularity ?? 0;
      const pb = b.popularity ?? 0;
      return pb - pa;
    });
    const picked: ActivitySummary[] = [];
    let remaining = remainingBudget;
    for (const activity of sorted) {
      const price = activity.priceAmount ?? 0;
      if (price <= remaining) {
        picked.push(activity);
        remaining -= price;
      }
      if (picked.length >= 6) break;
    }
    return picked;
  }

  private createPlan(payload: {
    title: string;
    budgetAmount: number;
    currency: string;
    originCityCode: string;
    originCityName: string;
    destinationCityCode: string;
    destinationCityName: string;
    departureDate?: string;
    returnDate?: string;
    selectedFlight: FlightOfferSummary | null;
    selectedActivities: ActivitySummary[];
    lockSelections: boolean;
  }) {
    this.plansApi
      .create({
        ...payload,
        selectedFlight: this.flightForPayload(payload.selectedFlight),
        selectedActivities: this.activitiesForPayload(payload.selectedActivities),
      })
      .subscribe({
        next: (p) => {
          this.busy.set(false);
          this.alert.toast('success', 'Plan creado correctamente');
          void this.router.navigate(['/planes', p.id]);
        },
        error: (e) => {
          const msg = this.msg(e);
          this.err.set(msg);
          this.busy.set(false);
          void this.alert.error('No se pudo guardar el plan', msg);
        },
      });
  }

  private flightForPayload(f: FlightOfferSummary | null): FlightOfferSummary | null {
    if (!f) return null;
    return {
      id: String(f.id),
      totalPrice: Number(f.totalPrice),
      currency: String(f.currency ?? 'USD'),
      withinBudget: Boolean(f.withinBudget),
      carrierCodes: Array.isArray(f.carrierCodes) ? f.carrierCodes.map(String) : [],
      summary: f.summary ?? '',
      departureAt: f.departureAt ?? null,
      arrivalAt: f.arrivalAt ?? null,
      originAirport: f.originAirport ?? null,
      destinationAirport: f.destinationAirport ?? null,
      stops: Number(f.stops ?? 0),
    };
  }

  private activitiesForPayload(list: ActivitySummary[]): ActivitySummary[] {
    return list.map((a) => ({
      id: String(a.id),
      name: a.name ?? null,
      shortDescription: a.shortDescription ?? null,
      category: a.category ?? null,
      popularity: a.popularity ?? null,
      priceAmount: a.priceAmount ?? null,
      priceCurrency: a.priceCurrency ?? null,
      estimatedPrice: Boolean(a.estimatedPrice),
      withinBudget: a.withinBudget ?? null,
    }));
  }

  private buildAutoTitle(destination: string, departureDate?: string | null): string {
    const destinationLabel = (destination || 'Destino sorpresa').trim();
    if (!departureDate) {
      return `Escapada a ${destinationLabel}`;
    }
    const d = new Date(departureDate);
    if (Number.isNaN(d.getTime())) {
      return `Escapada a ${destinationLabel}`;
    }
    const month = d.toLocaleDateString('es-ES', { month: 'long' });
    return `Escapada a ${destinationLabel} - ${month}`;
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
