import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import type { RecommendationsPayload, TravelPlanSummary } from '../../core/models/api.types';

@Component({
  selector: 'app-plan-detail',
  imports: [FormsModule, RouterLink, JsonPipe, DatePipe, DecimalPipe],
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

  protected busy = signal(false);
  protected err = signal('');
  protected ok = signal('');

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  protected load() {
    this.err.set('');
    this.plansApi.getOne(this.id).subscribe({
      next: (p) => {
        this.plan.set(p);
        this.title = p.title;
        this.budgetAmount = p.budgetAmount;
        this.originCityCode = p.originCityCode ?? '';
        this.originCityName = p.originCityName ?? '';
        this.destinationCityCode = p.destinationCityCode ?? '';
        this.destinationCityName = p.destinationCityName ?? '';
        this.departureDate = p.departureDate ?? '';
        this.returnDate = p.returnDate ?? '';
      },
      error: (e) => this.err.set(e?.error?.message ?? e?.message ?? 'No encontrado'),
    });
  }

  /** HU-6 + HU-4: cambiar ciudades o presupuesto actualiza recomendaciones en servidor */
  protected saveChanges() {
    this.busy.set(true);
    this.ok.set('');
    this.err.set('');
    this.plansApi
      .update(this.id, {
        title: this.title.trim(),
        budgetAmount: this.budgetAmount,
        originCityCode: this.originCityCode.trim(),
        originCityName: this.originCityName.trim(),
        destinationCityCode: this.destinationCityCode.trim(),
        destinationCityName: this.destinationCityName.trim(),
        departureDate: this.departureDate.trim() || undefined,
        returnDate: this.returnDate.trim() || undefined,
      })
      .subscribe({
        next: (p) => {
          this.plan.set(p);
          this.ok.set('Guardado. Recomendaciones actualizadas en servidor.');
          this.busy.set(false);
        },
        error: (e) => {
          this.err.set(e?.error?.message ?? e?.message ?? 'Error');
          this.busy.set(false);
        },
      });
  }

  protected remove() {
    if (!confirm('¿Eliminar este plan?')) return;
    this.plansApi.delete(this.id).subscribe({
      next: () => void this.router.navigate(['/planes']),
      error: (e) => this.err.set(e?.error?.message ?? e?.message ?? 'Error'),
    });
  }

  /** Recomendaciones en formato actual (resúmenes de vuelo y actividades). */
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
}
