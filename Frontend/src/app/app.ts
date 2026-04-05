import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { fromEvent } from 'rxjs';
import { SESSION_ENDED_EVENT } from './core/session/token.storage';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected readonly year = new Date().getFullYear();
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.auth.refreshSession();
    if (typeof window !== 'undefined') {
      fromEvent(window, SESSION_ENDED_EVENT)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.auth.clearClientSession());
    }
  }

  protected logout() {
    this.auth.logout().subscribe({ error: () => undefined });
  }

  protected authSvc = this.auth;
}
