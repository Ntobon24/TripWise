import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TravelService } from '../../core/services/travel.service';
import { AuthService } from '../../core/services/auth.service';
import type {
  ExploreDestinationsResponse,
  RecommendationsPayload,
  TravelIntegrationsStatus,
  UnifiedCity,
} from '../../core/models/api.types';

@Component({
  selector: 'app-explore',
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './explore.html',
  styleUrl: './explore.scss',
})
export class Explore implements OnInit {
  protected readonly travel = inject(TravelService);
  protected readonly auth = inject(AuthService);

  protected status = signal<TravelIntegrationsStatus | null>(null);
  protected destinations = signal<UnifiedCity[]>([]);
  protected destMeta = signal<ExploreDestinationsResponse['meta'] | null>(null);
  protected searchQ = 'Madrid';

  protected budget = 1400;
  protected originCode = 'BOG';
  protected destCode = 'MAD';
  protected originName = 'Bogotá';
  protected destName = 'Madrid';
  protected departureDate = '';

  protected rec = signal<RecommendationsPayload | null>(null);
  protected loadingDest = signal(false);
  protected loadingRec = signal(false);
  protected err = signal('');

  ngOnInit() {
    this.travel.getIntegrationsStatus().subscribe({
      next: (s) => this.status.set(s),
      error: () => this.status.set(null),
    });
    this.runDestinationSearch();
  }

  protected runDestinationSearch() {
    this.loadingDest.set(true);
    this.err.set('');
    this.travel.exploreDestinations(this.searchQ.trim()).subscribe({
      next: (res) => {
        this.destinations.set(res.destinations ?? []);
        this.destMeta.set(res.meta);
        this.loadingDest.set(false);
      },
      error: (e) => {
        this.err.set(e?.error?.message ?? e?.message ?? 'No se pudieron cargar destinos.');
        this.loadingDest.set(false);
      },
    });
  }

  protected runRecommendations() {
    if (this.budget < 0.01) {
      this.err.set('Indica un presupuesto válido.');
      return;
    }
    this.loadingRec.set(true);
    this.err.set('');
    this.rec.set(null);
    this.travel
      .recommendations({
        budget: this.budget,
        originCityCode: this.originCode.trim(),
        destinationCityCode: this.destCode.trim(),
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
          const msg =
            typeof e?.error === 'string'
              ? e.error
              : (e?.error?.message ?? JSON.stringify(e?.error) ?? e?.message);
          this.err.set(String(msg));
          this.loadingRec.set(false);
        },
      });
  }

  protected pickCity(c: UnifiedCity, field: 'origin' | 'dest') {
    if (c.code) {
      if (field === 'origin') this.originCode = c.code;
      else this.destCode = c.code;
    }
    if (field === 'origin') this.originName = c.name;
    else this.destName = c.name;
  }
}
