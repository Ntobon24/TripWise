import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import { TravelService } from '../../core/services/travel.service';
import type {
  ActivitySummary,
  FlightOfferSummary,
  RecommendationsPayload,
  TravelPlanSummary,
} from '../../core/models/api.types';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DecimalPipe } from '@angular/common';

type SelectableActivity = { key: string; value: ActivitySummary };

@Component({
  selector: 'app-plan-detail',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, CityTypeaheadComponent, MoneyPipe],
  templateUrl: './plan-detail.html',
  styleUrl: './plan-detail.scss',
})
export class PlanDetail implements OnInit {
  private readonly plansApi = inject(PlansService);
  private readonly travelSvc = inject(TravelService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected id = '';
  protected plan = signal<TravelPlanSummary | null>(null);

  protected title = '';
  protected budgetAmount = 0;

  protected originCityCode = '';
  protected originCityName = '';
  protected destinationCityCode = '';
  protected destinationCityName = '';

  protected departureDate = '';
  protected returnDate = '';

  protected readonly minDate = PlanDetail.isoDateLocal(new Date());

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
        this.departureDate = p.departureDate ?? '';
        this.returnDate = p.returnDate ?? '';
        this.editMode.set(false);
        this.freshRec.set(null);
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
        },
        error: (e) => {
          this.err.set(this.msg(e, 'No se pudieron guardar las selecciones.'));
          this.busy.set(false);
        },
      });
  }

  protected saveChanges() {
    this.formErr.set('');
    if (!Number.isFinite(this.budgetAmount) || this.budgetAmount < 0.01) {
      this.formErr.set('El presupuesto debe ser al menos 0,01.');
      return;
    }
    const oc = this.originCityCode.trim().toUpperCase();
    const dc = this.destinationCityCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(oc) || !/^[A-Z0-9]{2,8}$/.test(dc)) {
      this.formErr.set('Indica códigos de origen y destino válidos (2–8 caracteres).');
      return;
    }
    if (this.departureDate && !/^\d{4}-\d{2}-\d{2}$/.test(this.departureDate)) {
      this.formErr.set('La fecha de ida no es válida.');
      return;
    }
    if (this.departureDate && this.departureDate < this.minDate) {
      this.formErr.set('La fecha de ida no puede ser anterior a hoy.');
      return;
    }
    if (this.returnDate && !/^\d{4}-\d{2}-\d{2}$/.test(this.returnDate)) {
      this.formErr.set('La fecha de vuelta no es válida.');
      return;
    }
    if (this.departureDate && this.returnDate && this.returnDate < this.departureDate) {
      this.formErr.set('La vuelta no puede ser anterior a la ida.');
      return;
    }
    if (this.title.trim().length > 200) {
      this.formErr.set('El título es demasiado largo.');
      return;
    }

    this.busy.set(true);
    this.ok.set('');
    this.err.set('');
    this.plansApi
      .update(this.id, {
        title: this.title.trim(),
        budgetAmount: this.budgetAmount,
        originCityCode: oc,
        originCityName: this.originCityName.trim(),
        destinationCityCode: dc,
        destinationCityName: this.destinationCityName.trim(),
        departureDate: this.departureDate.trim() || undefined,
        returnDate: this.returnDate.trim() || undefined,
      })
      .subscribe({
        next: (p) => {
          this.plan.set(p);
          this.flightPage = 0;
          this.ok.set('Cambios guardados.');
          this.busy.set(false);
        },
        error: (e) => {
          this.err.set(this.msg(e, 'No se pudieron guardar los cambios.'));
          this.busy.set(false);
        },
      });
  }

  protected remove() {
    if (!globalThis.confirm('¿Eliminar este plan? Esta acción no se puede deshacer.')) return;
    this.plansApi.delete(this.id).subscribe({
      next: () => void this.router.navigate(['/planes']),
      error: (e) => this.err.set(this.msg(e, 'No se pudo eliminar el plan.')),
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

  protected selectedTotalCost(): number {
    return this.selectedFlightCost() + this.selectedActivitiesCost();
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
