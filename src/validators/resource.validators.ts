import { ValidationError } from '../errors/domainErrors';
import type { ListResourcesQuery } from '../types/reservation';
import { isPlainObject } from './common';

function parseTypeFilter(type: unknown): string | undefined {
  if (type === undefined) {
    return undefined;
  }
  // Rejects both ?type= and repeated ?type=a&type=b (parsed as an array).
  if (typeof type !== 'string' || type.length === 0) {
    throw new ValidationError('type must be a non-empty string when provided.');
  }
  return type;
}

function parseAvailabilityFilter(isAvailable: unknown): boolean | undefined {
  if (isAvailable === undefined) {
    return undefined;
  }
  // Exact strings only: Boolean('false') is true, so no truthiness coercion.
  if (isAvailable === 'true') {
    return true;
  }
  if (isAvailable === 'false') {
    return false;
  }
  throw new ValidationError('isAvailable must be "true" or "false" when provided.');
}

export function parseListResourcesQuery(query: unknown): ListResourcesQuery {
  if (!isPlainObject(query)) {
    return {};
  }
  const type: string | undefined = parseTypeFilter(query['type']);
  const isAvailable: boolean | undefined = parseAvailabilityFilter(query['isAvailable']);
  return {
    ...(type === undefined ? {} : { type }),
    ...(isAvailable === undefined ? {} : { isAvailable }),
  };
}
