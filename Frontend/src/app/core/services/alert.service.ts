import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

/** TripWise palette (aligned with styles.scss --tw-* tokens) */
const C = {
  primary: '#2563eb',
  primaryAlt: '#3b82f6',
  danger: '#dc2626',
  warn: '#d97706',
  success: '#15803d',
  muted: '#64748b',
} as const;

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly toastMixin = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3800,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
    customClass: {
      container: 'tw-swal-toast-container',
      popup: 'tw-swal-toast-popup',
      title: 'tw-swal-toast-title',
    },
  });

  /** Modal dialogs: enter/leave motion + TripWise chrome */
  private readonly modalMotion: Pick<
    SweetAlertOptions,
    'showClass' | 'hideClass' | 'customClass'
  > = {
    showClass: {
      backdrop: 'tw-swal-backdrop-show',
      popup: 'tw-swal-popup-show',
      icon: 'tw-swal-icon-show',
    },
    hideClass: {
      popup: 'tw-swal-popup-hide',
      backdrop: 'tw-swal-backdrop-hide',
    },
    customClass: {
      popup: 'tw-swal-modal',
      title: 'tw-swal-modal-title',
      htmlContainer: 'tw-swal-modal-html',
      confirmButton: 'tw-swal-btn tw-swal-btn--primary',
      cancelButton: 'tw-swal-btn tw-swal-btn--muted',
      denyButton: 'tw-swal-btn tw-swal-btn--danger',
      actions: 'tw-swal-actions',
    },
  };

  toast(icon: SweetAlertIcon, title: string): void {
    const variant =
      icon === 'success'
        ? 'tw-swal-toast-popup--success'
        : icon === 'error'
          ? 'tw-swal-toast-popup--error'
          : icon === 'warning'
            ? 'tw-swal-toast-popup--warn'
            : icon === 'info'
              ? 'tw-swal-toast-popup--info'
              : '';
    const id = `tw-toast-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

    void this.toastMixin.fire({
      icon,
      title,
      didOpen: (toast) => {
        try {
          (toast as HTMLElement).dataset['twToastId'] = id;
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        } catch (_) {
          // ignore
        }
      },
      customClass: {
        popup: ['tw-swal-toast-popup', variant].filter(Boolean).join(' '),
      },
    });

    // Targeted fallback: close only the toast with our id after timer+buffer
    try {
      const fallbackMs = 3800 + 700;
      window.setTimeout(() => {
        // Aggressive fallback: remove any remaining toast popups and containers.
        try {
          const popups = Array.from(document.querySelectorAll('.tw-swal-toast-popup')) as HTMLElement[];
          for (const p of popups) {
            try { p.remove(); } catch (_) { /* noop */ }
          }
          const containers = Array.from(document.querySelectorAll('.tw-swal-toast-container')) as HTMLElement[];
          for (const c of containers) {
            try { c.remove(); } catch (_) { /* noop */ }
          }
        } catch (_) {
          /* noop */
        }
        try { Swal.close(); } catch (_) { /* noop */ }
      }, fallbackMs);
    } catch (e) {
      // ignore in environments without window
    }
  }

  /** Form / client-side validation (amber, icon warning) */
  async validation(title: string, text: string): Promise<void> {
    await Swal.fire({
      ...this.modalMotion,
      title,
      text,
      icon: 'warning',
      iconColor: C.warn,
      confirmButtonText: 'Entendido',
      confirmButtonColor: C.primary,
      focusConfirm: true,
    });
  }

  /** Neutral info modal (blue accent) */
  async info(title: string, text?: string): Promise<void> {
    await Swal.fire({
      ...this.modalMotion,
      title,
      text,
      icon: 'info',
      iconColor: C.primaryAlt,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: C.primary,
    });
  }

  async confirm(
    title: string,
    text: string,
    confirmButtonText = 'Confirmar',
    cancelButtonText = 'Cancelar',
  ): Promise<boolean> {
    const result = await Swal.fire({
      ...this.modalMotion,
      title,
      text,
      icon: 'warning',
      iconColor: C.warn,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText,
      confirmButtonColor: C.danger,
      cancelButtonColor: '#94a3b8',
      reverseButtons: true,
      focusCancel: true,
    });
    return result.isConfirmed;
  }

  async success(title: string, text?: string): Promise<void> {
    await Swal.fire({
      ...this.modalMotion,
      title,
      text,
      icon: 'success',
      iconColor: C.success,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: C.primary,
      timer: 2600,
      timerProgressBar: true,
    });
  }

  async error(title: string, text?: string): Promise<void> {
    await Swal.fire({
      ...this.modalMotion,
      title,
      text,
      icon: 'error',
      iconColor: C.danger,
      confirmButtonText: 'Entendido',
      confirmButtonColor: C.primary,
    });
  }

  async warning(title: string, text?: string): Promise<void> {
    await Swal.fire({
      ...this.modalMotion,
      title,
      text,
      icon: 'warning',
      iconColor: C.warn,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: C.primary,
    });
  }
}
