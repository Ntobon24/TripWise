import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { finalize, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { clearStoredToken, getStoredToken, TOKEN_KEY } from '../session/token.storage';
import type { AuthUser, LoginResponse } from '../models/api.types';

export { TOKEN_KEY } from '../session/token.storage';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly user = signal<AuthUser | null>(null);

  private url(path: string) {
    return `${environment.apiBaseUrl}${path}`;
  }

  refreshSession() {
    const token = getStoredToken();
    if (!token) {
      this.user.set(null);
      return;
    }
    this.http.get<{ user: AuthUser }>(this.url('/auth/me')).subscribe({
      next: (r) => this.user.set(r.user),
      error: () => {
        clearStoredToken();
        this.user.set(null);
      },
    });
  }

  clearClientSession() {
    clearStoredToken();
    this.user.set(null);
  }

  register(body: { name: string; email: string; password: string }) {
    return this.http.post(this.url('/auth/register'), body);
  }

  login(body: { email: string; password: string }) {
    return this.http.post<LoginResponse>(this.url('/auth/login'), body).pipe(
      tap((res) => {
        if (res.token) {
          localStorage.setItem(TOKEN_KEY, res.token);
        }
        if (res.user) {
          this.user.set({
            sub: res.user.id,
            email: res.user.email,
            name: res.user.name,
          });
        }
      }),
    );
  }

  logout() {
    return this.http.post(this.url('/auth/logout'), {}).pipe(
      finalize(() => {
        clearStoredToken();
        this.user.set(null);
      }),
    );
  }

  isLoggedIn(): boolean {
    return !!getStoredToken();
  }
}
