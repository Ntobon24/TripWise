import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { finalize, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { AuthUser, LoginResponse } from '../models/api.types';

export const TOKEN_KEY = 'tw_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly user = signal<AuthUser | null>(null);

  private url(path: string) {
    return `${environment.apiBaseUrl}${path}`;
  }

  /** HU-3: restaurar sesión al cargar la app */
  refreshSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      this.user.set(null);
      return;
    }
    this.http.get<{ user: AuthUser }>(this.url('/auth/me')).subscribe({
      next: (r) => this.user.set(r.user),
      error: () => {
        localStorage.removeItem(TOKEN_KEY);
        this.user.set(null);
      },
    });
  }

  /** HU-1 */
  register(body: { name: string; email: string; password: string }) {
    return this.http.post(this.url('/auth/register'), body);
  }

  /** HU-3 */
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

  /** HU-3 */
  logout() {
    return this.http.post(this.url('/auth/logout'), {}).pipe(
      finalize(() => {
        localStorage.removeItem(TOKEN_KEY);
        this.user.set(null);
      }),
    );
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }
}
