import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import type { TravelPlanSummary } from '../../core/models/api.types';

@Component({
  selector: 'app-plans-list',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './plans-list.html',
  styleUrl: './plans-list.scss',
})
export class PlansList implements OnInit {
  private readonly plansApi = inject(PlansService);

  protected plans = signal<TravelPlanSummary[]>([]);
  protected emptyMessage = signal<string>('');
  protected err = signal('');
  protected loading = signal(true);

  ngOnInit() {
    this.reload();
  }

  protected reload() {
    this.loading.set(true);
    this.err.set('');
    this.plansApi.list().subscribe({
      next: (res) => {
        this.plans.set(res.plans ?? []);
        this.emptyMessage.set(res.plans?.length ? '' : (res.message ?? 'No hay planes.'));
        this.loading.set(false);
      },
      error: (e) => {
        this.err.set(e?.error?.message ?? e?.message ?? 'Error');
        this.loading.set(false);
      },
    });
  }
}
