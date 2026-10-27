import { isErrorResponse, isReservation, isResource } from './guards';
import type {
  ClientErrorCode,
  CreateReservationDTO,
  KnownErrorCode,
  Reservation,
  Resource,
  ResourceType,
} from './types';

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// `string & {}` keeps autocomplete for the known codes while still accepting new ones.
export type ApiErrorCode = KnownErrorCode | ClientErrorCode | (string & {});

/** Every failed call rejects with this, so callers can branch on `code`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export type RequestOptions = {
  signal?: AbortSignal;
};

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function readJson(response: Response): Promise<unknown> {
  const text: string = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    // A non-JSON body (e.g. a proxy error page) is reported by the caller.
    return undefined;
  }
}

function contractViolation(path: string): ApiError {
  return new ApiError(
    0,
    'UNEXPECTED_RESPONSE',
    `Response from ${path} did not match the API contract.`,
  );
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch (err: unknown) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the CampusHub server. Check your connection and try again.',
    );
  }
}

async function request<T>(
  path: string,
  parse: (body: unknown) => T,
  init: RequestInit = {},
): Promise<T> {
  const response: Response = await send(path, init);
  const body: unknown = await readJson(response);
  if (!response.ok) {
    if (isErrorResponse(body)) {
      throw new ApiError(response.status, body.code, body.message);
    }
    // No ErrorResponse usually means the dev proxy could not reach the backend.
    throw new ApiError(
      response.status,
      'UNEXPECTED_RESPONSE',
      `The server returned an unexpected response (HTTP ${response.status}). Is the backend running?`,
    );
  }
  return parse(body);
}

function parseResourceList(body: unknown): Resource[] {
  if (Array.isArray(body) && body.every(isResource)) {
    return body;
  }
  throw contractViolation('/resources');
}

function parseReservation(body: unknown): Reservation {
  if (isReservation(body)) {
    return body;
  }
  throw contractViolation('/reservations');
}

function parseReservationList(body: unknown): Reservation[] {
  if (Array.isArray(body) && body.every(isReservation)) {
    return body;
  }
  throw contractViolation('/reservations/user');
}

/** GET /resources, optionally filtered by type (operationId listResources). */
export async function fetchResources(
  type?: ResourceType,
  options: RequestOptions = {},
): Promise<Resource[]> {
  const query: string =
    type === undefined ? '' : `?${new URLSearchParams({ type }).toString()}`;
  return request(`/resources${query}`, parseResourceList, {
    signal: options.signal ?? null,
  });
}

/** POST /reservations. Rejects with code DOUBLE_BOOKING when the slot overlaps (409). */
export async function createReservation(
  payload: CreateReservationDTO,
  options: RequestOptions = {},
): Promise<Reservation> {
  return request('/reservations', parseReservation, {
    method: 'POST',
    body: JSON.stringify(payload),
    signal: options.signal ?? null,
  });
}

/** GET /reservations/user/{userId}: PENDING and CONFIRMED reservations, earliest first. */
export async function fetchUserReservations(
  userId: string,
  options: RequestOptions = {},
): Promise<Reservation[]> {
  return request(
    `/reservations/user/${encodeURIComponent(userId)}`,
    parseReservationList,
    { signal: options.signal ?? null },
  );
}

/** PATCH /reservations/{id}/cancel. Cancelling twice is a no-op on the server. */
export async function cancelReservation(
  reservationId: string,
  options: RequestOptions = {},
): Promise<Reservation> {
  return request(
    `/reservations/${encodeURIComponent(reservationId)}/cancel`,
    parseReservation,
    { method: 'PATCH', signal: options.signal ?? null },
  );
}

/** Normalises anything a call can throw into an ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err;
  }
  const message: string = err instanceof Error ? err.message : 'Something went wrong.';
  return new ApiError(0, 'UNEXPECTED_RESPONSE', message);
}
