import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const TOKEN_KEY = 'tw_token';

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  if (localStorage.getItem(TOKEN_KEY)) {
    return true;
  }
  router.navigate(['/entrar'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};
