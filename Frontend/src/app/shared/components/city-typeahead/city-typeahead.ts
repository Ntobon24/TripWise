import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import type { UnifiedCity } from '../../../core/models/api.types';
import { TravelService } from '../../../core/services/travel.service';

@Component({
  selector: 'app-city-typeahead',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './city-typeahead.html',
  styleUrl: './city-typeahead.scss',
})
export class CityTypeaheadComponent implements OnChanges {
  private static nextId = 0;

  private readonly travel = inject(TravelService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query$ = new Subject<string>();

  readonly fieldId = `tw-city-${++CityTypeaheadComponent.nextId}`;
  readonly listboxId = `${this.fieldId}-listbox`;

  @Input() label = '';
  @Input() hint = '';
  @Input() placeholder = 'Escribe el nombre de la ciudad…';
  @Input() disabled = false;

  @Input() cityName = '';
  @Input() cityCode = '';

  @Output() readonly cityNameChange = new EventEmitter<string>();
  @Output() readonly cityCodeChange = new EventEmitter<string>();
  @Output() readonly cityPicked = new EventEmitter<UnifiedCity>();

  protected displayValue = '';
  protected isEditing = false;
  protected open = false;
  protected loading = false;
  protected results: UnifiedCity[] = [];
  protected fieldError = '';

  constructor() {
    this.query$
      .pipe(
        debounceTime(260),
        distinctUntilChanged(),
        switchMap((raw) => {
          const q = raw.trim();
          this.fieldError = '';
          if (q.length < 2) {
            this.loading = false;
            this.results = [];
            return of([] as UnifiedCity[]);
          }
          this.loading = true;
          return this.travel.searchCities(q).pipe(
            switchMap((res) => {
              this.loading = false;
              return of(res.cities ?? []);
            }),
            catchError(() => {
              this.loading = false;
              this.fieldError = 'No se pudo completar la búsqueda.';
              return of([] as UnifiedCity[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((cities) => {
        this.results = cities.slice(0, 10);
        this.open = this.isEditing && (this.results.length > 0 || !!this.fieldError);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['cityName'] || changes['cityCode']) && !this.isEditing) {
      this.displayValue = this.buildDisplay();
    }
  }

  protected onFocus(): void {
    if (this.disabled) return;
    this.isEditing = true;
    this.displayValue = this.cityName;
    if (this.displayValue.trim().length >= 2) {
      this.query$.next(this.displayValue);
    }
  }

  protected onSearch(val: string): void {
    if (this.disabled) return;
    this.open = true;
    this.query$.next(val);
  }

  protected onBlur(): void {
    setTimeout(() => {
      this.isEditing = false;
      this.open = false;
      this.results = [];
      this.displayValue = this.buildDisplay();
    }, 200);
  }

  protected pick(c: UnifiedCity): void {
    if (this.disabled) return;
    const code = (c.code ?? '').toUpperCase();

    this.cityName = c.name;
    this.cityCode = code;
    this.displayValue = this.buildDisplay();
    this.isEditing = false;
    this.open = false;
    this.results = [];
    this.fieldError = '';

    this.cityNameChange.emit(c.name);
    this.cityCodeChange.emit(code);
    this.cityPicked.emit(c);
  }

  protected subtitle(c: UnifiedCity): string {
    const parts: string[] = [];
    if (c.code) parts.push(c.code);
    if (c.countryCode && c.countryCode !== c.code) parts.push(c.countryCode);
    return parts.filter(Boolean).join(' · ');
  }

  private buildDisplay(): string {
    const n = this.cityName.trim();
    const c = this.cityCode.trim();
    if (n && c) return `${n} · ${c}`;
    return n || c || '';
  }
}
