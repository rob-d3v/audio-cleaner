import type { ApiErrorBody } from "./types";

/**
 * Thrown for any non-2xx response. Carries the parsed backend error body
 * when the server returned one, so callers can key off `code` /
 * `message_key` instead of parsing prose.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  messageKey: string;
  detail?: string;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    const code = body?.error?.code ?? "unknown_error";
    const messageKey = body?.error?.message_key ?? "errors.unknown";
    super(body?.error?.detail ?? fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.detail = body?.error?.detail;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "object"
  );
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Pre-built body for multipart/form uploads (skips JSON.stringify). */
  formData?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = path.startsWith("/") ? path : `/${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Core typed request helper. Throws `ApiError` on any non-ok response.
 * Callers pass the expected response type as `T`; for endpoints with no
 * body (e.g. 204) pass `T = void` and it resolves to `undefined`.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, formData, query, signal } = options;

  const init: RequestInit = { method, signal };

  if (formData) {
    init.body = formData;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }

  const res = await fetch(buildUrl(path, query), init);

  if (!res.ok) {
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      // response had no JSON body — fall through with parsed = null
    }
    throw new ApiError(
      res.status,
      isApiErrorBody(parsed) ? parsed : null,
      `Request failed: ${method} ${path} (${res.status})`,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"], signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "GET", query, signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "POST", body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "PUT", body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "PATCH", body, signal }),
  delete: <T>(path: string, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "DELETE", signal }),
  upload: <T>(path: string, formData: FormData, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: "PUT", formData, signal }),
};

/** Builds a same-origin URL for direct <audio>/<img>/wavesurfer src use. */
export function assetUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  return buildUrl(path, query);
}
