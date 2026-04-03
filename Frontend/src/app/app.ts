import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);

  ngOnInit() {
    this.auth.refreshSession();
  }

  protected logout() {
    this.auth.logout().subscribe({ error: () => undefined });
  }

  protected authSvc = this.auth;
}
