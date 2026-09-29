import { ValidationError } from '../errors/domainErrors';
import type { ListResourcesQuery } from '../types/reservation';
import { isPlainObject } from './common';

export function parseListResourcesQuery(query: unknown): ListResourcesQuery {
  if (!isPlainObject(query) || query['type'] === undefined) {
    return {};
  }
  const type: unknown = query['type'];
  // Rejects both ?type= and repeated ?type=a&type=b (parsed as an array).
  if (typeof type !== 'string' || type.length === 0) {
    throw new ValidationError('type must be a non-empty string when provided.');
  }
  return { type };
}
