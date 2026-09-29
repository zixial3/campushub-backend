import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../errors/domainErrors';
import type { IReservation } from '../models/reservation.model';
import type { IResource } from '../models/resource.model';
import { reservationRepository } from '../repositories/reservation.repository';
import type { InsertReservationResult } from '../repositories/reservation.repository';
import { resourceRepository } from '../repositories/resource.repository';
import type { NewReservationInput, Reservation } from '../types/reservation';

export function toReservationDto(reservation: IReservation): Reservation {
  return {
    id: reservation._id,
    resourceId: reservation.resourceId,
    userId: reservation.userId,
    startTime: reservation.startTime.toISOString(),
    endTime: reservation.endTime.toISOString(),
    status: reservation.status,
  };
}

export async function createReservation(
  input: NewReservationInput,
): Promise<Reservation> {
  const resource: IResource | undefined = await resourceRepository.findById(
    input.resourceId,
  );
  if (resource === undefined) {
    throw new NotFoundError(
      'RESOURCE_NOT_FOUND',
      `Resource ${input.resourceId} does not exist.`,
    );
  }
  if (!resource.isAvailable) {
    throw new ConflictError(
      'RESOURCE_UNAVAILABLE',
      `Resource ${input.resourceId} is not available for booking.`,
    );
  }

  const result: InsertReservationResult = await reservationRepository.insertIfSlotFree({
    _id: randomUUID(),
    resourceId: input.resourceId,
    userId: input.userId,
    startTime: input.startTime,
    endTime: input.endTime,
    status: 'PENDING',
  });
  if (!result.inserted) {
    throw new ConflictError(
      'DOUBLE_BOOKING',
      'Resource is already reserved for this time slot.',
    );
  }
  return toReservationDto(result.reservation);
}

export async function listActiveReservationsByUser(
  userId: string,
): Promise<Reservation[]> {
  const reservations: IReservation[] =
    await reservationRepository.findActiveByUser(userId);
  return reservations.map(toReservationDto);
}
