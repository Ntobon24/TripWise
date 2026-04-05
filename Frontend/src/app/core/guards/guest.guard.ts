import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) {
    void router.navigate(['/planes']);
    return false;
  }
  return true;
};
