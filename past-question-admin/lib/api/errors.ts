/**
 * Typed API error used across the admin data layer.
 *
 * `kind` classifies the failure so UI can render the right honest state
 * (e.g. "backend unreachable" vs "not authorized" vs "endpoint not built yet").
 * This class is pure (no React/Next imports) and unit-tested in `errors.test.ts`.
 */

export type ApiErrorKind =
  | "network" // could not reach the backend at all
  | "unauthorized" // 401 — missing/expired/invalid session
  | "forbidden" // 403 — authenticated but not allowed
  | "not_found" // 404 — resource (or, in this phase, the endpoint) is absent
  | "validation" // 400 / 422 — request rejected
  | "conflict" // 409
  | "rate_limited" // 429
  | "server" // 5xx
  | "not_implemented" // 501
  | "parse" // response was not valid JSON
  | "http"; // any other non-2xx

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
  }

  /** True when re-authenticating might fix it. */
  get isAuthError(): boolean {
    return this.kind === "unauthorized";
  }

  /** Map an HTTP status + optional backend error object into an ApiError. */
  static fromResponse(
    status: number,
    errorBody?: { code?: string; message?: string; details?: unknown } | unknown,
  ): ApiError {
    const body =
      errorBody && typeof errorBody === "object"
        ? (errorBody as { code?: string; message?: string; details?: unknown })
        : undefined;
    const code = body?.code;
    const kind = kindForStatus(status);
    const message =
      body?.message?.trim() || defaultMessageForKind(kind, status);
    return new ApiError({
      kind,
      status,
      code,
      details: body?.details,
      message,
    });
  }
}

export function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
    case 413:
    case 415:
    case 422:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limited";
    case 501:
      return "not_implemented";
    default:
      if (status >= 500) return "server";
      if (status >= 400) return "http";
      return "http";
  }
}

export interface ErrorDescription {
  /** Short headline for an error UI. */
  title: string;
  /** One or two sentences safe to show an admin. */
  message: string;
  kind: ApiErrorKind | "unknown";
}

/**
 * Turn any thrown value into a user-safe, honest description for an error state.
 * Never leaks stack traces or secrets; for `not_implemented`/`not_found` it is
 * explicit that the backend endpoint may not exist yet (this phase's reality).
 */
export function describeError(error: unknown): ErrorDescription {
  if (error instanceof ApiError) {
    return { title: titleForKind(error.kind), message: error.message, kind: error.kind };
  }
  return {
    title: "Something went wrong",
    message: "An unexpected error occurred. Please try again.",
    kind: "unknown",
  };
}

function titleForKind(kind: ApiErrorKind): string {
  switch (kind) {
    case "network":
      return "Cannot reach the backend";
    case "unauthorized":
      return "Session expired";
    case "forbidden":
      return "Not authorized";
    case "not_found":
      return "Not found";
    case "not_implemented":
      return "Backend endpoint not available";
    case "validation":
      return "Invalid request";
    case "conflict":
      return "Conflict";
    case "rate_limited":
      return "Too many requests";
    case "server":
      return "Backend error";
    case "parse":
      return "Unexpected response";
    default:
      return "Request failed";
  }
}

function defaultMessageForKind(kind: ApiErrorKind, status: number): string {
  switch (kind) {
    case "unauthorized":
      return "Your session is missing or has expired. Please sign in again.";
    case "forbidden":
      return "You do not have permission to perform this action.";
    case "not_found":
      return "The requested resource was not found.";
    case "validation":
      if (status === 413) return "The file is too large. The maximum upload size is 25 MB.";
      if (status === 415) return "That file type is not supported. Upload a PDF.";
      return "The request was rejected by the server.";
    case "conflict":
      return "The request conflicts with the current state.";
    case "rate_limited":
      return "Too many requests. Please slow down and try again.";
    case "server":
      return "The backend encountered an error. Please try again later.";
    case "not_implemented":
      return "This endpoint is not implemented on the backend yet.";
    default:
      return `Request failed with status ${status}.`;
  }
}
