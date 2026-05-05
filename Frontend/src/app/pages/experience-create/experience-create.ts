import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PlansService } from '../../core/services/plans.service';
import { AlertService } from '../../core/services/alert.service';
import { CityTypeaheadComponent } from '../../shared/components/city-typeahead/city-typeahead';

@Component({
  selector: 'app-experience-create',
  imports: [FormsModule, RouterLink, CityTypeaheadComponent],
  templateUrl: './experience-create.html',
  styleUrl: './experience-create.scss',
})
export class ExperienceCreate {
  private readonly plansApi = inject(PlansService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);

  protected budgetAmount = 2000;
  protected originCityCode = '';
  protected originCityName = '';
  protected continent: string = 'any';
  protected tripDays: number | undefined = undefined;
  protected interests = '';
  protected pace = 'sin';
  protected travelParty = 'sin';

  protected busy = signal(false);
  protected err = signal('');

  protected readonly continents = [
    { id: 'any', label: 'Sin preferencia' },
    { id: 'europe', label: 'Europa' },
    { id: 'americas', label: 'América' },
    { id: 'asia', label: 'Asia' },
    { id: 'africa', label: 'África' },
    { id: 'oceania', label: 'Oceanía' },
  ];

  protected readonly paceOpts = [
    { id: 'sin', label: 'Sin preferencia' },
    { id: 'relax', label: 'Relax' },
    { id: 'mixto', label: 'Mixto' },
    { id: 'intenso', label: 'Intenso / muchas actividades' },
  ];

  protected readonly partyOpts = [
    { id: 'sin', label: 'Sin preferencia' },
    { id: 'solo', label: 'Solo' },
    { id: 'pareja', label: 'Pareja' },
    { id: 'familia', label: 'Familia' },
    { id: 'amigos', label: 'Amigos' },
  ];

  protected submit(form: NgForm) {
    form.control.markAllAsTouched();
    if (form.invalid) {
      const ocCtrl = form.controls['oc'];
      const budgetCtrl = form.controls['budget'];
      let hint =
        'Revisa los campos marcados: presupuesto y código de origen (2–8 letras o números).';
      if (budgetCtrl?.invalid) {
        hint = 'Indica un presupuesto válido (mínimo 1).';
      } else if (ocCtrl?.invalid) {
        hint =
          'El código de origen debe tener entre 2 y 8 caracteres (solo letras y números, sin espacios).';
      }
      this.err.set(hint);
      void this.alert.validation('Revisa el formulario', hint);
      return;
    }
    const oc = this.originCityCode.trim().toUpperCase();
    if (!oc || !/^[A-Z0-9]{2,8}$/.test(oc)) {
      const msg = 'Indica un código de ciudad de origen válido (2–8 caracteres).';
      this.err.set(msg);
      void this.alert.validation('Ciudad de origen', msg);
      return;
    }
    if (!Number.isFinite(this.budgetAmount) || this.budgetAmount < 1) {
      const msg = 'El presupuesto debe ser al menos 1.';
      this.err.set(msg);
      void this.alert.validation('Presupuesto', msg);
      return;
    }

    this.busy.set(true);
    this.err.set('');

    const body: Parameters<PlansService['createAiExperience']>[0] = {
      budget: this.budgetAmount,
      currency: 'USD',
      originCityCode: oc,
      originCityName: this.originCityName.trim() || undefined,
      continent: this.continent === 'any' ? 'any' : this.continent,
      interests: this.interests.trim() || undefined,
      pace: this.pace === 'sin' ? undefined : this.pace,
      travelParty: this.travelParty === 'sin' ? undefined : this.travelParty,
    };
    if (
      this.tripDays != null &&
      Number.isFinite(this.tripDays) &&
      this.tripDays >= 3 &&
      this.tripDays <= 14
    ) {
      body.tripDays = this.tripDays;
    }

    this.plansApi.createAiExperience(body).subscribe({
      next: (plan) => {
        this.busy.set(false);
        this.alert.toast('success', 'Tu experiencia está lista.');
        void this.router.navigate(['/planes', plan.id]);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const msg = this.extractErrorMessage(e);
        this.err.set(msg);
        void this.alert.error('No se pudo generar el plan', msg);
      },
    });
  }

  private extractErrorMessage(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const body = e.error as { message?: string | string[] } | undefined;
      if (Array.isArray(body?.message)) {
        return body.message.join('. ');
      }
      if (typeof body?.message === 'string') {
        return body.message;
      }
      if (e.status === 0) {
        return 'No hay conexión con el servidor. ¿Está arrancado el backend?';
      }
    }
    const ex = e as { message?: string };
    return typeof ex?.message === 'string' ? ex.message : 'No se pudo crear el plan.';
  }
}
