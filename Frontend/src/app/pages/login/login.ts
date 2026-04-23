import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alert = inject(AlertService);

  protected email = '';
  protected password = '';

  protected busy = signal(false);
  protected err = signal('');
  protected sessionHint = signal('');

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('sesion') === 'expirada') {
      this.sessionHint.set('Tu sesión ha caducado. Vuelve a entrar para continuar.');
    } else if (qp.get('registrado') === '1') {
      this.sessionHint.set('Cuenta creada. Entra con tu correo y contraseña.');
    }
  }

  protected submit(form: NgForm) {
    form.control.markAllAsTouched();
    if (form.invalid) {
      return;
    }
    this.busy.set(true);
    this.err.set('');
    this.auth.login({ email: this.email.trim(), password: this.password }).subscribe({
      next: () => {
        this.busy.set(false);
        const next = this.route.snapshot.queryParamMap.get('returnUrl') || '/planes';
        void this.router.navigateByUrl(next);
      },
      error: (e) => {
        const msg = String(e?.error?.message ?? e?.message ?? 'Credenciales incorrectas.');
        this.err.set(msg);
        this.busy.set(false);
        void this.alert.error('No se pudo iniciar sesión', msg);
      },
    });
  }
}
