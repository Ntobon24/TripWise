import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import type { RecommendationsPayload, TravelPlanSummary } from '../../core/models/api.types';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';

@Component({
  selector: 'app-plan-detail',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, CityTypeaheadComponent],
  templateUrl: './plan-detail.html',
  styleUrl: './plan-detail.scss',
})
export class PlanDetail implements OnInit {
  private readonly plansApi = inject(PlansService);
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
      },
      error: (e) => this.err.set(this.msg(e, 'No se encontró el plan.')),
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
          this.ok.set('Cambios guardados. Las recomendaciones se han actualizado.');
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
    if (
      flights.length > 0 &&
      typeof (flights[0] as { summary?: string }).summary !== 'string'
    ) {
      return null;
    }
    return r as RecommendationsPayload;
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
