import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import { TravelService } from '../../core/services/travel.service';
import type {
  ActivitySummary,
  FlightOfferSummary,
  PlanPlaceReviewItem,
  RecommendationsPayload,
  TravelPlanSummary,
} from '../../core/models/api.types';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DecimalPipe } from '@angular/common';
import { AlertService } from '../../core/services/alert.service';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker';

type SelectableActivity = { key: string; value: ActivitySummary };

@Component({
  selector: 'app-plan-detail',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, CityTypeaheadComponent, MoneyPipe, DatePickerComponent],
  templateUrl: './plan-detail.html',
  styleUrl: './plan-detail.scss',
})
export class PlanDetail implements OnInit {
  private readonly plansApi = inject(PlansService);
  private readonly travelSvc = inject(TravelService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);

  protected id = '';
  protected plan = signal<TravelPlanSummary | null>(null);

  protected title = '';
  protected budgetAmount = 0;

  protected originCityCode = '';
  protected originCityName = '';
  protected destinationCityCode = '';
  protected destinationCityName = '';

  private originalOriginCode = '';
  private originalOriginName = '';
  private originalOriginDisplay = '';
  private originalDestCode = '';
  private originalDestName = '';
  private originalDestDisplay = '';

  protected departureDate = '';
  protected returnDate = '';

  protected readonly minDate = PlanDetail.isoDateLocal(new Date());

  protected readonly DONUT_R = 38;
  protected readonly DONUT_C = 2 * Math.PI * 38;

  /** Fracción del presupuesto total (0–∞ si se excede). */
  protected readonly flightFrac = computed(() =>
    this.budgetAmount ? this.selectedFlightCost() / this.budgetAmount : 0,
  );
  protected readonly activitiesFrac = computed(() =>
    this.budgetAmount ? this.selectedActivitiesCost() / this.budgetAmount : 0,
  );
  protected readonly lodgingFrac = computed(() =>
    this.budgetAmount ? (this.plan()?.aiLodgingEstimate ?? 0) / this.budgetAmount : 0,
  );
  protected readonly foodFrac = computed(() =>
    this.budgetAmount ? (this.plan()?.aiFoodEstimate ?? 0) / this.budgetAmount : 0,
  );

  protected readonly flightPct = computed(() =>
    Math.min(100, this.flightFrac() * 100),
  );
  protected readonly activitiesPct = computed(() =>
    Math.min(100, this.activitiesFrac() * 100),
  );
  protected readonly lodgingPct = computed(() =>
    Math.min(100, this.lodgingFrac() * 100),
  );
  protected readonly foodPct = computed(() => Math.min(100, this.foodFrac() * 100));

  protected readonly usedPct = computed(() => {
    if (!this.budgetAmount) return 0;
    return Math.min(
      100,
      (this.selectedTotalCost() / this.budgetAmount) * 100,
    );
  });

  protected readonly flightArc = computed(() => this.flightFrac() * this.DONUT_C);
  protected readonly activitiesArc = computed(() => this.activitiesFrac() * this.DONUT_C);
  protected readonly lodgingArc = computed(() => this.lodgingFrac() * this.DONUT_C);
  protected readonly foodArc = computed(() => this.foodFrac() * this.DONUT_C);

  protected readonly activitiesRotateDeg = computed(
    () => -90 + this.flightFrac() * 360,
  );
  protected readonly lodgingRotateDeg = computed(
    () => -90 + (this.flightFrac() + this.activitiesFrac()) * 360,
  );
  protected readonly foodRotateDeg = computed(
    () =>
      -90 +
      (this.flightFrac() + this.activitiesFrac() + this.lodgingFrac()) * 360,
  );

  protected busy = signal(false);
  protected err = signal('');
  protected ok = signal('');
  protected formErr = signal('');

  protected flightPage = 0;
  protected readonly flightsPerPage = 4;

  protected get pagedFlights() {
    const all = this.recPayload()?.flights ?? [];
    const start = this.flightPage * this.flightsPerPage;
    return all.slice(start, start + this.flightsPerPage);
  }

  protected get totalFlightPages() {
    return Math.ceil((this.recPayload()?.flights?.length ?? 0) / this.flightsPerPage);
  }

  protected prevFlightPage() { if (this.flightPage > 0) this.flightPage--; }
  protected nextFlightPage() { if (this.flightPage < this.totalFlightPages - 1) this.flightPage++; }

  protected readonly editMode = signal(false);
  protected readonly editBusy = signal(false);
  protected readonly editErr = signal('');
  protected readonly freshRec = signal<RecommendationsPayload | null>(null);

  protected readonly detailTab = signal<
    'presupuesto' | 'actividades' | 'reviews' | 'estimacion'
  >('presupuesto');
  protected readonly reviews = signal<PlanPlaceReviewItem[]>([]);
  protected readonly reviewsLoading = signal(false);
  protected readonly reviewsErr = signal('');
  protected readonly reviewsHint = signal<string | null>(null);
  private readonly reviewsFetched = signal(false);

  protected readonly estimacionLoading = signal(false);
  protected readonly estimacionErr = signal('');
  private readonly estimacionFetched = signal(false);

  protected readonly editFlightId = signal<string | null>(null);
  protected readonly editActivityKeys = signal<Set<string>>(new Set());
  protected readonly editActivitiesMap = signal<Map<string, ActivitySummary>>(new Map());

  protected editFlightPage = 0;
  protected editActivityPage = 0;
  private readonly editFlightsPerPage = 4;
  private readonly editActivitiesPerPage = 8;

  protected get editSelectableActivities(): SelectableActivity[] {
    return (this.freshRec()?.activities ?? []).map((v, i) => ({
      key: `${v.id || 'act'}::${v.name || 'sin-nombre'}::${i}`,
      value: v,
    }));
  }

  protected get editPagedFlights(): FlightOfferSummary[] {
    const all = this.freshRec()?.flights ?? [];
    const start = this.editFlightPage * this.editFlightsPerPage;
    return all.slice(start, start + this.editFlightsPerPage);
  }

  protected get editTotalFlightPages() {
    return Math.ceil((this.freshRec()?.flights?.length ?? 0) / this.editFlightsPerPage);
  }

  protected get editPagedActivities(): SelectableActivity[] {
    const start = this.editActivityPage * this.editActivitiesPerPage;
    return this.editSelectableActivities.slice(start, start + this.editActivitiesPerPage);
  }

  protected get editTotalActivityPages() {
    return Math.ceil(this.editSelectableActivities.length / this.editActivitiesPerPage);
  }

  protected prevEditFlightPage() { if (this.editFlightPage > 0) this.editFlightPage--; }
  protected nextEditFlightPage() { if (this.editFlightPage < this.editTotalFlightPages - 1) this.editFlightPage++; }
  protected prevEditActivityPage() { if (this.editActivityPage > 0) this.editActivityPage--; }
  protected nextEditActivityPage() { if (this.editActivityPage < this.editTotalActivityPages - 1) this.editActivityPage++; }

  protected readonly editSelectedFlightCost = computed(() => {
    const id = this.editFlightId();
    if (!id) return 0;
    return this.freshRec()?.flights.find((f) => String(f.id) === id)?.totalPrice ?? 0;
  });

  protected readonly editSelectedActivitiesCost = computed(() =>
    Array.from(this.editActivitiesMap().values()).reduce((s, a) => s + (a.priceAmount ?? 0), 0),
  );

  protected readonly editRemainingBudget = computed(
    () => this.budgetAmount - this.editSelectedFlightCost() - this.editSelectedActivitiesCost(),
  );

  static normalizeCityLabel(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  private static isoDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  static addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return PlanDetail.isoDateLocal(d);
  }

  protected load() {
    this.err.set('');
    this.plansApi.getOne(this.id).subscribe({
      next: (p) => {
        this.plan.set(p);
        this.flightPage = 0;
        this.title = p.title;
        this.budgetAmount = p.budgetAmount;
        this.originCityCode = p.originCityCode ?? '';
        this.originCityName = p.originCityName ?? '';
        this.destinationCityCode = p.destinationCityCode ?? '';
        this.destinationCityName = p.destinationCityName ?? '';
        this.originalOriginCode = (p.originCityCode ?? '').trim().toUpperCase();
        this.originalOriginName = PlanDetail.normalizeCityLabel(p.originCityName ?? '');
        this.originalOriginDisplay = (p.originCityName ?? '').trim();
        this.originalDestCode = (p.destinationCityCode ?? '').trim().toUpperCase();
        this.originalDestName = PlanDetail.normalizeCityLabel(p.destinationCityName ?? '');
        this.originalDestDisplay = (p.destinationCityName ?? '').trim();
        this.departureDate = p.departureDate ?? '';
        this.returnDate = p.returnDate ?? '';
        this.editMode.set(false);
        this.freshRec.set(null);
        this.reviewsFetched.set(false);
        this.reviews.set([]);
        this.reviewsErr.set('');
        this.reviewsHint.set(null);
        this.estimacionFetched.set(false);
        this.estimacionErr.set('');
      },
      error: (e) => this.err.set(this.msg(e, 'No se encontró el plan.')),
    });
  }

  protected openEditSelections() {
    const p = this.plan();
    if (!p) return;
    this.editMode.set(true);
    this.editErr.set('');
    this.editFlightPage = 0;
    this.editActivityPage = 0;
    this.editFlightId.set(null);
    this.editActivityKeys.set(new Set());
    this.editActivitiesMap.set(new Map());
    this.freshRec.set(null);
    this.loadFreshRecommendations();
  }

  protected cancelEditSelections() {
    this.editMode.set(false);
    this.editErr.set('');
    this.freshRec.set(null);
  }

  protected setDetailTab(
    tab: 'presupuesto' | 'actividades' | 'reviews' | 'estimacion',
  ) {
    this.detailTab.set(tab);
    if (tab === 'reviews' && !this.reviewsFetched()) {
      this.loadReviews();
    }
    if (tab === 'estimacion' && !this.estimacionFetched()) {
      this.loadEstimacionIfNeeded();
    }
  }

  protected retryEstimacion() {
    this.estimacionFetched.set(false);
    this.loadEstimacionIfNeeded(true);
  }

  private loadEstimacionIfNeeded(force = false) {
    if (!this.id) {
      return;
    }
    const p = this.plan();
    if (
      !force &&
      p?.aiLodgingEstimate != null &&
      p?.aiFoodEstimate != null
    ) {
      this.estimacionFetched.set(true);
      return;
    }
    this.estimacionLoading.set(true);
    this.estimacionErr.set('');
    this.plansApi.refreshAiEstimates(this.id).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.estimacionLoading.set(false);
        this.estimacionFetched.set(true);
      },
      error: (e) => {
        this.estimacionLoading.set(false);
        this.estimacionFetched.set(true);
        this.estimacionErr.set(this.msg(e, 'No se pudo obtener la estimación.'));
      },
    });
  }

  private loadReviews() {
    if (!this.id) {
      return;
    }
    this.reviewsLoading.set(true);
    this.reviewsErr.set('');
    this.plansApi.getReviews(this.id).subscribe({
      next: (r) => {
        this.reviewsLoading.set(false);
        this.reviewsFetched.set(true);
        this.reviewsHint.set(r.hint ?? null);
        this.reviews.set(r.places ?? []);
      },
      error: (e) => {
        this.reviewsLoading.set(false);
        this.reviewsFetched.set(true);
        this.reviewsErr.set(this.msg(e, 'No se pudieron cargar las reseñas.'));
      },
    });
  }

  protected loadFreshRecommendations() {
    const p = this.plan();
    if (!p) return;
    const oc = (p.originCityCode ?? '').trim().toUpperCase();
    const dc = (p.destinationCityCode ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(oc) || !/^[A-Z0-9]{2,8}$/.test(dc)) {
      this.editErr.set('Se necesitan códigos de ciudad válidos para buscar recomendaciones.');
      return;
    }
    this.editBusy.set(true);
    this.editErr.set('');
    this.freshRec.set(null);
    this.travelSvc
      .recommendations({
        budget: p.budgetAmount,
        originCityCode: oc,
        destinationCityCode: dc,
        originCityName: p.originCityName ?? undefined,
        destinationCityName: p.destinationCityName ?? undefined,
        departureDate: p.departureDate ?? undefined,
      })
      .subscribe({
        next: (r) => {
          this.freshRec.set(r);
          this.editFlightPage = 0;
          this.editActivityPage = 0;
          this.editFlightId.set(null);
          this.editActivityKeys.set(new Set());
          this.editActivitiesMap.set(new Map());
          this.editBusy.set(false);
        },
        error: (e) => {
          this.editErr.set(this.msg(e, 'No se pudieron cargar recomendaciones.'));
          this.editBusy.set(false);
        },
      });
  }

  protected toggleEditFlight(f: FlightOfferSummary) {
    const fid = String(f.id);
    this.editFlightId.update((cur) => (cur === fid ? null : fid));
  }

  protected isEditFlightSelected(f: FlightOfferSummary): boolean {
    return this.editFlightId() === String(f.id);
  }

  protected toggleEditActivity(item: SelectableActivity) {
    const keys = new Set(this.editActivityKeys());
    const map = new Map(this.editActivitiesMap());
    if (keys.has(item.key)) {
      keys.delete(item.key);
      map.delete(item.key);
    } else {
      keys.add(item.key);
      map.set(item.key, {
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
    this.editActivityKeys.set(keys);
    this.editActivitiesMap.set(map);
  }

  protected isEditActivitySelected(key: string): boolean {
    return this.editActivityKeys().has(key);
  }

  protected getEditSelectedFlight(): FlightOfferSummary | null {
    const id = this.editFlightId();
    if (!id) return null;
    return this.freshRec()?.flights.find((f) => String(f.id) === id) ?? null;
  }

  protected saveSelections() {
    const flight = this.getEditSelectedFlight();
    const activities = Array.from(this.editActivitiesMap().values());
    this.busy.set(true);
    this.ok.set('');
    this.err.set('');
    this.plansApi
      .update(this.id, {
        selectedFlight: flight
          ? {
              id: String(flight.id),
              totalPrice: Number(flight.totalPrice),
              currency: String(flight.currency ?? 'USD'),
              withinBudget: Boolean(flight.withinBudget),
              carrierCodes: Array.isArray(flight.carrierCodes) ? flight.carrierCodes.map(String) : [],
              summary: flight.summary ?? '',
              departureAt: flight.departureAt ?? null,
              arrivalAt: flight.arrivalAt ?? null,
              originAirport: flight.originAirport ?? null,
              destinationAirport: flight.destinationAirport ?? null,
              stops: Number(flight.stops ?? 0),
            }
          : null,
        selectedActivities: activities.map((a) => ({
          id: String(a.id),
          name: a.name ?? null,
          shortDescription: a.shortDescription ?? null,
          category: a.category ?? null,
          popularity: a.popularity ?? null,
          priceAmount: a.priceAmount ?? null,
          priceCurrency: a.priceCurrency ?? null,
          estimatedPrice: Boolean(a.estimatedPrice),
          withinBudget: a.withinBudget ?? null,
        })),
        lockSelections: true,
      })
      .subscribe({
        next: (p) => {
          this.plan.set(p);
          this.editMode.set(false);
          this.freshRec.set(null);
          this.ok.set('Selecciones guardadas.');
          this.busy.set(false);
          this.alert.toast('success', 'Selecciones guardadas correctamente');
        },
        error: (e) => {
          const msg = this.msg(e, 'No se pudieron guardar las selecciones.');
          this.err.set(msg);
          this.busy.set(false);
          void this.alert.error('Error al guardar selecciones', msg);
        },
      });
  }

  private isValidDateFormat(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    const [y, m, day] = date.split('-').map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
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
      const on = PlanDetail.normalizeCityLabel(this.originCityName || '');
      const dn = PlanDetail.normalizeCityLabel(this.destinationCityName || '');
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

  private hasStoredSelections(): boolean {
    const p = this.plan();
    if (!p) return false;
    const f = p.selectedFlight;
    const hasFlight = !!(f && typeof f === 'object' && (f as { id?: unknown }).id);
    const acts = Array.isArray(p.selectedActivities) ? p.selectedActivities : [];
    return hasFlight || acts.length > 0;
  }

  protected saveChanges() {
    this.formErr.set('');
    if (!Number.isFinite(this.budgetAmount) || this.budgetAmount < 1) {
      this.formErr.set('El presupuesto debe ser al menos 1.');
      return;
    }
    if (this.budgetAmount > 10_000_000) {
      this.formErr.set('El presupuesto no puede superar 10.000.000.');
      return;
    }
    const oc = this.originCityCode.trim().toUpperCase();
    const dc = this.destinationCityCode.trim().toUpperCase();
    if (!oc) {
      this.formErr.set('Indica la ciudad de origen.');
      return;
    }
    if (!/^[A-Z0-9]{2,8}$/.test(oc)) {
      this.formErr.set('El código de origen solo puede tener letras y números (2–8 caracteres).');
      return;
    }
    if (!dc) {
      this.formErr.set('Indica la ciudad de destino.');
      return;
    }
    if (!/^[A-Z0-9]{2,8}$/.test(dc)) {
      this.formErr.set('El código de destino solo puede tener letras y números (2–8 caracteres).');
      return;
    }
    if (oc === dc) {
      const on = PlanDetail.normalizeCityLabel(this.originCityName);
      const dn = PlanDetail.normalizeCityLabel(this.destinationCityName);
      if (on === dn && on.length >= 2) {
        this.formErr.set('El origen y el destino no pueden ser la misma ciudad.');
        void this.alert.warning(
          'Ciudad duplicada',
          `Origen y destino coinciden (${this.originCityName || oc}).`,
        );
        return;
      }
      void this.alert.warning(
        'Mismo código de país o región',
        `Origen y destino comparten el código ${oc}, pero las ciudades son distintas (${this.originCityName || '?'} → ${this.destinationCityName || '?'}). ` +
          'Para buscar vuelos fiables, indica el código IATA de cada aeropuerto (ej. BCN y MAD).',
      );
    }
    if (this.departureDate) {
      if (!this.isValidDateFormat(this.departureDate)) {
        this.formErr.set('La fecha de ida no es válida. Usa el formato AAAA-MM-DD.');
        return;
      }
      if (this.departureDate < this.minDate) {
        this.formErr.set('La fecha de ida no puede ser anterior a hoy.');
        return;
      }
    }
    if (this.returnDate) {
      if (!this.isValidDateFormat(this.returnDate)) {
        this.formErr.set('La fecha de vuelta no es válida. Usa el formato AAAA-MM-DD.');
        return;
      }
      if (this.returnDate < this.minDate) {
        this.formErr.set('La fecha de vuelta no puede ser anterior a hoy.');
        return;
      }
      if (this.departureDate && this.returnDate < this.departureDate) {
        this.formErr.set('La fecha de vuelta no puede ser anterior a la de ida.');
        return;
      }
      if (this.departureDate) {
        const maxReturn = PlanDetail.addDays(this.departureDate, 365);
        if (this.returnDate > maxReturn) {
          this.formErr.set('El viaje no puede durar más de un año.');
          return;
        }
      }
    }
    const title = this.title.trim();
    if (title.length === 0) {
      this.formErr.set('El nombre del plan es obligatorio.');
      return;
    }
    if (title.length < 2) {
      this.formErr.set('El nombre del plan debe tener al menos 2 caracteres.');
      return;
    }
    if (title.length > 200) {
      this.formErr.set('El nombre del plan no puede superar 200 caracteres.');
      return;
    }

    const normOrig = PlanDetail.normalizeCityLabel(this.originCityName);
    const normDest = PlanDetail.normalizeCityLabel(this.destinationCityName);

    const routeChanged =
      this.originalOriginCode !== oc ||
      this.originalDestCode !== dc ||
      this.originalOriginName !== normOrig ||
      this.originalDestName !== normDest;

    const proceed = () => this.persistChanges(title, oc, dc, routeChanged);

    if (routeChanged) {
      const hasSelections = this.hasStoredSelections();
      const parts: string[] = [];
      if (this.originalOriginCode !== oc || this.originalOriginName !== normOrig) {
        parts.push(
          `Origen: "${this.originalOriginDisplay || '(sin nombre)'}" → "${this.originCityName.trim() || '(sin nombre)'}" (código ${this.originalOriginCode || '—'} → ${oc})`,
        );
      }
      if (this.originalDestCode !== dc || this.originalDestName !== normDest) {
        parts.push(
          `Destino: "${this.originalDestDisplay || '(sin nombre)'}" → "${this.destinationCityName.trim() || '(sin nombre)'}" (código ${this.originalDestCode || '—'} → ${dc})`,
        );
      }
      const detail = parts.join('. ');
      const message = hasSelections
        ? `${detail}. Se eliminarán el vuelo y las actividades guardadas porque ya no aplican a la nueva ruta.`
        : `${detail}. Las recomendaciones de vuelos y actividades del viaje anterior se eliminarán.`;

      void this.alert
        .confirm(
          '¿Cambiar la ruta del plan?',
          message,
          'Sí, actualizar ruta',
          'Cancelar',
        )
        .then((ok) => {
          if (ok) proceed();
        });
      return;
    }

    proceed();
  }

  private persistChanges(title: string, oc: string, dc: string, routeChanged: boolean): void {
    this.busy.set(true);
    this.ok.set('');
    this.err.set('');
    const updatePayload: Record<string, unknown> = {
      title,
      budgetAmount: this.budgetAmount,
      originCityCode: oc,
      originCityName: this.originCityName.trim(),
      destinationCityCode: dc,
      destinationCityName: this.destinationCityName.trim(),
      departureDate: this.departureDate.trim() || undefined,
      returnDate: this.returnDate.trim() || undefined,
    };
    if (routeChanged) {
      updatePayload['selectedFlight'] = null;
      updatePayload['selectedActivities'] = [];
      updatePayload['lockSelections'] = false;
    }
    this.plansApi
      .update(this.id, updatePayload as Parameters<typeof this.plansApi.update>[1])
      .subscribe({
        next: (p) => {
          this.plan.set(p);
          this.originalOriginCode = (p.originCityCode ?? '').trim().toUpperCase();
          this.originalOriginName = PlanDetail.normalizeCityLabel(p.originCityName ?? '');
          this.originalOriginDisplay = (p.originCityName ?? '').trim();
          this.originalDestCode = (p.destinationCityCode ?? '').trim().toUpperCase();
          this.originalDestName = PlanDetail.normalizeCityLabel(p.destinationCityName ?? '');
          this.originalDestDisplay = (p.destinationCityName ?? '').trim();
          this.flightPage = 0;
          this.ok.set('Cambios guardados.');
          this.busy.set(false);
          this.alert.toast(
            'success',
            routeChanged ? 'Ruta actualizada. Selecciones eliminadas.' : 'Cambios guardados correctamente',
          );
        },
        error: (e) => {
          const msg = this.msg(e, 'No se pudieron guardar los cambios.');
          this.err.set(msg);
          this.busy.set(false);
          void this.alert.error('Error al guardar', msg);
        },
      });
  }

  protected remove() {
    void this.alert
      .confirm(
        '¿Eliminar este plan?',
        'Esta acción no se puede deshacer. Perderás todos los datos del plan.',
        'Eliminar',
        'Cancelar',
      )
      .then((confirmed) => {
        if (!confirmed) return;
        this.plansApi.delete(this.id).subscribe({
          next: () => {
            this.alert.toast('success', 'Plan eliminado');
            void this.router.navigate(['/planes']);
          },
          error: (e) => {
            const msg = this.msg(e, 'No se pudo eliminar el plan.');
            this.err.set(msg);
            void this.alert.error('Error al eliminar', msg);
          },
        });
      });
  }

  protected recPayload(): RecommendationsPayload | null {
    const r = this.plan()?.recommendations;
    if (!r || typeof r !== 'object') return null;
    const flights = (r as RecommendationsPayload).flights;
    if (!Array.isArray(flights)) return null;
    return r as RecommendationsPayload;
  }

  protected selectedFlight(): FlightOfferSummary | null {
    const fromPlan = this.plan()?.selectedFlight;
    if (fromPlan && typeof fromPlan === 'object' && !Array.isArray(fromPlan)) {
      const id = (fromPlan as { id?: unknown }).id;
      if (id !== undefined && id !== null && String(id).length > 0) {
        return fromPlan as FlightOfferSummary;
      }
    }
    return this.recPayload()?.flights?.[0] ?? null;
  }

  protected selectedActivities(): ActivitySummary[] {
    const fromPlan = this.plan()?.selectedActivities;
    if (Array.isArray(fromPlan)) {
      return fromPlan as ActivitySummary[];
    }
    return this.recPayload()?.activities ?? [];
  }

  protected trackActivity(index: number, a: ActivitySummary): string {
    return `${a.id ?? 'act'}-${index}`;
  }

  protected selectedFlightCost(): number {
    return this.selectedFlight()?.totalPrice ?? 0;
  }

  protected selectedActivitiesCost(): number {
    return this.selectedActivities().reduce((sum, a) => sum + (a.priceAmount ?? 0), 0);
  }

  protected aiLodgingCost(): number {
    return this.plan()?.aiLodgingEstimate ?? 0;
  }

  protected aiFoodCost(): number {
    return this.plan()?.aiFoodEstimate ?? 0;
  }

  protected selectedTotalCost(): number {
    return (
      this.selectedFlightCost() +
      this.selectedActivitiesCost() +
      this.aiLodgingCost() +
      this.aiFoodCost()
    );
  }

  protected remainingBudget(): number {
    return this.budgetAmount - this.selectedTotalCost();
  }

  private msg(e: unknown, fallback: string): string {
    const ex = e as { error?: { message?: string | string[] }; message?: string };
    const m = ex?.error?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
    if (typeof ex?.message === 'string') return ex.message;
    return fallback;
  }
}
