import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import { TravelService } from '../../core/services/travel.service';
import type { RecommendationsPayload } from '../../core/models/api.types';

@Component({
  selector: 'app-plan-form',
  imports: [FormsModule, RouterLink, DecimalPipe],
  templateUrl: './plan-form.html',
  styleUrl: './plan-form.scss',
})
export class PlanForm {
  private readonly plansApi = inject(PlansService);
  private readonly travel = inject(TravelService);
  private readonly router = inject(Router);

  protected title = 'Mi viaje';
  budgetAmount = 1200;
  currency = 'USD';
  originCityCode = 'BOG';
  originCityName = 'Bogotá';
  destinationCityCode = 'MAD';
  destinationCityName = 'Madrid';
  departureDate = '';
  returnDate = '';

  protected busy = signal(false);
  protected preview = signal<RecommendationsPayload | null>(null);
  protected err = signal('');

  protected previewRecommendations() {
    this.err.set('');
    this.preview.set(null);
    this.travel
      .recommendations({
        budget: this.budgetAmount,
        originCityCode: this.originCityCode.trim(),
        destinationCityCode: this.destinationCityCode.trim(),
        originCityName: this.originCityName.trim() || undefined,
        destinationCityName: this.destinationCityName.trim() || undefined,
        departureDate: this.departureDate.trim() || undefined,
      })
      .subscribe({
        next: (r) => this.preview.set(r),
        error: (e) => this.err.set(e?.error?.message ?? e?.message ?? 'Error'),
      });
  }

  protected save() {
    this.busy.set(true);
    this.err.set('');
    this.plansApi
      .create({
        title: this.title.trim() || 'Mi viaje',
        budgetAmount: this.budgetAmount,
        currency: this.currency.trim(),
        originCityCode: this.originCityCode.trim(),
        originCityName: this.originCityName.trim(),
        destinationCityCode: this.destinationCityCode.trim(),
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
          const msg = Array.isArray(e?.error?.message)
            ? e.error.message.join(', ')
            : (e?.error?.message ?? e?.message);
          this.err.set(String(msg));
          this.busy.set(false);
        },
      });
  }
}
