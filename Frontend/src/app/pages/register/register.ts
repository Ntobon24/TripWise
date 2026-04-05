import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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

  protected readonly pwdPattern = REGISTER_PASSWORD_PATTERN.source;

  protected name = '';
  protected email = '';
  protected password = '';

  protected busy = signal(false);
  protected err = signal('');

  protected submit(form: NgForm) {
    form.control.markAllAsTouched();
    if (form.invalid) {
      return;
    }
    this.busy.set(true);
    this.err.set('');
    this.auth.register({ name: this.name.trim(), email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/entrar'], { queryParams: { registrado: '1' } });
      },
      error: (e) => {
        const msg = Array.isArray(e?.error?.message)
          ? e.error.message.join(', ')
          : (e?.error?.message ?? e?.message ?? 'No se pudo completar el registro.');
        this.err.set(String(msg));
        this.busy.set(false);
      },
    });
  }
}
