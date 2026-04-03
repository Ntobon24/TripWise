import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';

  protected busy = signal(false);
  protected err = signal('');

  protected submit() {
    this.busy.set(true);
    this.err.set('');
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.busy.set(false);
        const next = this.route.snapshot.queryParamMap.get('returnUrl') || '/planes';
        void this.router.navigateByUrl(next);
      },
      error: (e) => {
        const msg = e?.error?.message ?? e?.message ?? 'Credenciales incorrectas';
        this.err.set(String(msg));
        this.busy.set(false);
      },
    });
  }
}
