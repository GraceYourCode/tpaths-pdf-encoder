/**
 * WhatsApp number helpers. Same rule as the backend RegisterDto: an optional
 * leading "+", then 8 to 15 digits with a non-zero first digit.
 */
const WHATSAPP_RE = /^\+?[1-9]\d{7,14}$/;

export function normalizeWhatsapp(input: string): string {
  return input.replace(/[\s().-]/g, "");
}

export function isValidWhatsapp(normalized: string): boolean {
  return WHATSAPP_RE.test(normalized);
}
