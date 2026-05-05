import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

export const REGISTER_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertService);

  protected readonly pwdPattern = REGISTER_PASSWORD_PATTERN.source;

  protected name = '';
  protected email = '';
  protected password = '';

  protected busy = signal(false);
  protected err = signal('');

  protected submit(form: NgForm) {
    form.control.markAllAsTouched();
    if (form.invalid) {
      void this.alert.validation(
        'Formulario incompleto',
        'Revisa nombre, correo y contraseña (debe incluir al menos una letra y un número).',
      );
      return;
    }
    this.busy.set(true);
    this.err.set('');
    this.auth.register({ name: this.name.trim(), email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.busy.set(false);
        this.alert.toast('success', 'Cuenta creada. Ahora puedes iniciar sesión.');
        void this.router.navigate(['/entrar'], { queryParams: { registrado: '1' } });
      },
      error: (e) => {
        const msg = Array.isArray(e?.error?.message)
          ? e.error.message.join(', ')
          : String(e?.error?.message ?? e?.message ?? 'No se pudo completar el registro.');
        this.err.set(msg);
        this.busy.set(false);
        void this.alert.error('Error en el registro', msg);
      },
    });
  }
}
