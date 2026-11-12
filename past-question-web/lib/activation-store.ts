/**
 * The backend returns an activation token only once, when a purchase first
 * completes. It is kept in sessionStorage for this browser session so a reload of
 * the confirmation page does not lose it. It is cleared on logout.
 */
const PREFIX = "tpaths_activation_token:";

export function saveActivationToken(reference: string, token: string) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(`${PREFIX}${reference}`, token);
}

export function readActivationToken(reference: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(`${PREFIX}${reference}`);
}

export function clearActivationTokens() {
  if (typeof window === "undefined") return;
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith(PREFIX)) window.sessionStorage.removeItem(key);
  }
}
