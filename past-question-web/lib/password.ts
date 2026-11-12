/**
 * Password policy mirrored from the backend RegisterDto / ResetDto:
 * at least 12 characters, with an uppercase letter, a lowercase letter and a digit.
 * The backend is authoritative; this only gives immediate feedback.
 */
export const PASSWORD_MIN_LENGTH = 12;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
    return "Password must include an uppercase letter, a lowercase letter and a number.";
  return null;
}
