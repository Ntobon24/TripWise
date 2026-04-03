import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { Home } from './pages/home/home';
import { Explore } from './pages/explore/explore';
import { Register } from './pages/register/register';
import { Login } from './pages/login/login';
import { PlansList } from './pages/plans-list/plans-list';
import { PlanForm } from './pages/plan-form/plan-form';
import { PlanDetail } from './pages/plan-detail/plan-detail';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: 'inicio', component: Home },
  { path: 'explorar', component: Explore },
  { path: 'registro', component: Register },
  { path: 'entrar', component: Login },
  {
    path: 'planes',
    canActivate: [authGuard],
    children: [
      { path: '', component: PlansList },
      { path: 'nuevo', component: PlanForm },
      { path: ':id', component: PlanDetail },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];
