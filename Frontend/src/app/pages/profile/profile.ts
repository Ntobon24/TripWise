import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { REGISTER_PASSWORD_PATTERN } from '../register/register';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly alert = inject(AlertService);

  protected readonly pwdPattern = REGISTER_PASSWORD_PATTERN.source;

  protected name = '';
  protected email = '';
  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';

  protected busy = signal(false);
  protected err = signal('');

  ngOnInit() {
    const u = this.auth.user();
    if (u) {
      this.name = u.name;
      this.email = u.email;
    }
  }

  protected async submit(form: NgForm) {
    form.control.markAllAsTouched();
    if (form.invalid) {
      void this.alert.validation(
        'Formulario incompleto',
        'Revisa nombre y correo; si cambias contraseña, completa todos los campos.',
      );
      return;
    }

    const anyPwd =
      Boolean(this.currentPassword) || Boolean(this.newPassword) || Boolean(this.confirmPassword);
    if (anyPwd) {
      if (!this.currentPassword) {
        const msg = 'Indica tu contraseña actual para cambiar la contraseña.';
        this.err.set(msg);
        void this.alert.validation('Contraseña actual', msg);
        return;
      }
      if (!this.newPassword) {
        const msg = 'Indica la nueva contraseña.';
        this.err.set(msg);
        void this.alert.validation('Nueva contraseña', msg);
        return;
      }
      if (this.newPassword !== this.confirmPassword) {
        await this.alert.error('Las contraseñas no coinciden', 'Revisa la confirmación de la nueva contraseña.');
        return;
      }
    }

    this.busy.set(true);
    this.err.set('');
    this.auth
      .updateProfile({
        email: this.email.trim(),
        currentPassword: this.currentPassword || undefined,
        newPassword: this.newPassword || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.alert.toast('success', 'Cambios guardados.');
        },
        error: async (e: { status?: number; error?: { message?: string | string[] }; message?: string }) => {
          this.busy.set(false);
          const status = e?.status;
          const msg = Array.isArray(e?.error?.message)
            ? e.error.message.join(', ')
            : String(e?.error?.message ?? e?.message ?? 'No se pudo actualizar el perfil.');
          if (status === 403) {
            await this.alert.error('Credenciales no válidas', msg);
          } else {
            this.err.set(msg);
            await this.alert.error('Error', msg);
          }
        },
      });
  }
}
