import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';

interface CalendarDay {
  iso: string;
  day: number;
  currentMonth: boolean;
  selected: boolean;
  today: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.scss',
})
export class DatePickerComponent implements OnChanges {
  @Input() value = '';
  @Input() min = '';
  @Input() placeholder = 'Seleccionar fecha';
  @Input() label = '';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string>();

  private readonly host = inject(ElementRef);

  protected open = false;
  protected viewYear = 0;
  protected viewMonth = 0;

  protected readonly MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  protected readonly WEEK = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

  private readonly todayISO = this.toISO(new Date());

  constructor() {
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();
  }

  ngOnChanges(): void {
    if (this.value && !this.open) {
      const d = new Date(this.value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        this.viewYear = d.getFullYear();
        this.viewMonth = d.getMonth();
      }
    }
  }

  protected get formattedValue(): string {
    if (!this.value) return '';
    const d = new Date(this.value + 'T00:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  protected get calendarDays(): CalendarDay[] {
    const firstDay = new Date(this.viewYear, this.viewMonth, 1);
    const lastDay = new Date(this.viewYear, this.viewMonth + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days: CalendarDay[] = [];

    for (let i = startOffset; i > 0; i--) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - i);
      days.push(this.makeDay(d, false));
    }

    for (let n = 1; n <= lastDay.getDate(); n++) {
      days.push(this.makeDay(new Date(this.viewYear, this.viewMonth, n), true));
    }

    const rem = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
    for (let i = 1; i <= rem; i++) {
      days.push(this.makeDay(new Date(this.viewYear, this.viewMonth + 1, i), false));
    }

    return days;
  }

  protected get canGoPrev(): boolean {
    if (!this.min) return true;
    const [y, m] = this.min.split('-').map(Number);
    return this.viewYear > y || (this.viewYear === y && this.viewMonth > m - 1);
  }

  protected get canSelectToday(): boolean {
    return !this.min || this.todayISO >= this.min;
  }

  protected toggleCalendar(): void {
    if (this.disabled) return;
    if (this.open) {
      this.open = false;
    } else {
      this.syncViewToValue();
      this.open = true;
    }
  }

  protected selectDay(day: CalendarDay): void {
    if (day.disabled) return;
    this.valueChange.emit(day.iso);
    this.open = false;
  }

  protected clearDate(event: MouseEvent): void {
    event.stopPropagation();
    this.valueChange.emit('');
  }

  protected prevMonth(): void {
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
  }

  protected nextMonth(): void {
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
  }

  protected goToToday(): void {
    if (!this.canSelectToday) return;
    this.valueChange.emit(this.todayISO);
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }

  private syncViewToValue(): void {
    if (this.value) {
      const d = new Date(this.value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        this.viewYear = d.getFullYear();
        this.viewMonth = d.getMonth();
        return;
      }
    }
    if (this.min) {
      const d = new Date(this.min + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        this.viewYear = d.getFullYear();
        this.viewMonth = d.getMonth();
        return;
      }
    }
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();
  }

  private makeDay(d: Date, currentMonth: boolean): CalendarDay {
    const iso = this.toISO(d);
    return {
      iso,
      day: d.getDate(),
      currentMonth,
      selected: iso === this.value,
      today: iso === this.todayISO,
      disabled: !!(this.min && iso < this.min),
    };
  }

  private toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
