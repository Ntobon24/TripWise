import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly baseToast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  toast(icon: SweetAlertIcon, title: string): void {
    void this.baseToast.fire({ icon, title });
  }

  async confirm(
    title: string,
    text: string,
    confirmButtonText = 'Confirmar',
    cancelButtonText = 'Cancelar',
  ): Promise<boolean> {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
      focusCancel: true,
    });
    return result.isConfirmed;
  }

  async success(title: string, text?: string): Promise<void> {
    await Swal.fire({
      title,
      text,
      icon: 'success',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#2563eb',
      timer: 2500,
      timerProgressBar: true,
    });
  }

  async error(title: string, text?: string): Promise<void> {
    await Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#2563eb',
    });
  }

  async warning(title: string, text?: string): Promise<void> {
    await Swal.fire({
      title,
      text,
      icon: 'warning',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#2563eb',
    });
  }
}
