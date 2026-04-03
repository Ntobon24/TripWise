import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected name = '';
  protected email = '';
  protected password = '';

  protected busy = signal(false);
  protected ok = signal('');
  protected err = signal('');

  protected submit() {
    this.busy.set(true);
    this.err.set('');
    this.ok.set('');
    this.auth.register({ name: this.name, email: this.email, password: this.password }).subscribe({
      next: (r: unknown) => {
        this.ok.set(JSON.stringify(r));
        this.busy.set(false);
        void this.router.navigate(['/entrar']);
      },
      error: (e) => {
        const msg = Array.isArray(e?.error?.message)
          ? e.error.message.join(', ')
          : (e?.error?.message ?? e?.message ?? 'Error');
        this.err.set(String(msg));
        this.busy.set(false);
      },
    });
  }
}
