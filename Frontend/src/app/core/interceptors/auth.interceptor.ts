import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  clearStoredToken,
  getStoredToken,
  notifySessionEnded,
} from '../session/token.storage';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const token = getStoredToken();
  const isAuthPublic =
    req.url.includes('/auth/register') || req.url.includes('/auth/login');

  let outgoing = req;
  if (token && !isAuthPublic) {
    outgoing = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  const router = inject(Router);
  const zone = inject(NgZone);

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        token &&
        !isAuthPublic
      ) {
        clearStoredToken();
        notifySessionEnded();
        zone.run(() => {
          void router.navigate(['/entrar'], {
            queryParams: { returnUrl: router.url, sesion: 'expirada' },
          });
        });
      }
      return throwError(() => err);
    }),
  );
};
