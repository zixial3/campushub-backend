import { ValidationError } from '../errors/domainErrors';
import type { CreateReservationRequest, NewReservationInput } from '../types/reservation';
import {
  isPlainObject,
  parseDateTime,
  parseIdentifier,
  rejectUnknownKeys,
} from './common';

const CREATE_RESERVATION_FIELDS: readonly (keyof CreateReservationRequest)[] = [
  'resourceId',
  'userId',
  'startTime',
  'endTime',
];

export function parseCreateReservationRequest(body: unknown): NewReservationInput {
  if (!isPlainObject(body)) {
    throw new ValidationError('Request body must be a JSON object.');
  }
  rejectUnknownKeys(body, CREATE_RESERVATION_FIELDS, 'Request body');

  const input: NewReservationInput = {
    resourceId: parseIdentifier(body['resourceId'], 'resourceId'),
    userId: parseIdentifier(body['userId'], 'userId'),
    startTime: parseDateTime(body['startTime'], 'startTime'),
    endTime: parseDateTime(body['endTime'], 'endTime'),
  };
  if (input.endTime.getTime() <= input.startTime.getTime()) {
    throw new ValidationError('endTime must be later than startTime.');
  }
  return input;
}

export function parseUserIdParam(userId: unknown): string {
  return parseIdentifier(userId, 'userId');
}
