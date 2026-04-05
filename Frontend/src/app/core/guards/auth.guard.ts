import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getStoredToken } from '../session/token.storage';

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  if (getStoredToken()) {
    return true;
  }
  void router.navigate(['/entrar'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};
