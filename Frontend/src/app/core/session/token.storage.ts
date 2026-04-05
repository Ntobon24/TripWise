export const TOKEN_KEY = 'tw_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const SESSION_ENDED_EVENT = 'tw:session-ended';

export function notifySessionEnded(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
  }
}
