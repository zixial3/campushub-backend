import { ConflictError, NotFoundError } from '../errors/domainErrors';
import type { IReservation } from '../models/Reservation.model';
import type { IResource } from '../models/Resource.model';
import { reservationRepository } from '../repositories/reservation.repository';
import { resourceRepository } from '../repositories/resource.repository';
import type {
  NewReservationInput,
  Reservation,
  ReservationStatus,
  ReservationTransitionTarget,
} from '../types/reservation';

// Which statuses each PATCH endpoint may move a reservation out of.
// CANCELLED is terminal: a cancelled booking is replaced by a new one.
const ALLOWED_FROM: Readonly<
  Record<ReservationTransitionTarget, readonly ReservationStatus[]>
> = {
  CONFIRMED: ['PENDING'],
  CANCELLED: ['PENDING', 'CONFIRMED'],
};

const TRANSITION_VERB: Readonly<Record<ReservationTransitionTarget, string>> = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

export function toReservationDto(reservation: IReservation): Reservation {
  return {
    id: reservation._id.toHexString(),
    resourceId: reservation.resourceId.toHexString(),
    userId: reservation.userId,
    startTime: reservation.startTime.toISOString(),
    endTime: reservation.endTime.toISOString(),
    status: reservation.status,
  };
}

async function findBookableResource(resourceId: string): Promise<IResource> {
  const resource: IResource | undefined = await resourceRepository.findById(resourceId);
  if (resource === undefined) {
    throw new NotFoundError(
      'RESOURCE_NOT_FOUND',
      `Resource ${resourceId} does not exist.`,
    );
  }
  if (!resource.isAvailable) {
    throw new ConflictError(
      'RESOURCE_UNAVAILABLE',
      `Resource ${resourceId} is not available for booking.`,
    );
  }
  return resource;
}

/**
 * Creates a PENDING reservation unless it collides with an active one.
 *
 * Collision rule: an existing PENDING or CONFIRMED reservation on the same
 * resource overlaps [startTime, endTime) when it starts before the new
 * endTime AND ends after the new startTime. Back-to-back slots do not
 * overlap. The check and the insert run under one per-resource lock, so two
 * concurrent requests cannot both pass the check.
 */
export async function createReservation(
  input: NewReservationInput,
): Promise<Reservation> {
  const resource: IResource = await findBookableResource(input.resourceId);

  const created: IReservation = await reservationRepository.runExclusive(
    resource._id,
    async (): Promise<IReservation> => {
      const collides: boolean = await reservationRepository.existsActiveInRange({
        resourceId: resource._id,
        startsBefore: input.endTime,
        endsAfter: input.startTime,
      });
      if (collides) {
        throw new ConflictError(
          'DOUBLE_BOOKING',
          'Resource is already reserved for this time slot.',
        );
      }
      return reservationRepository.create({
        resourceId: resource._id,
        userId: input.userId,
        startTime: input.startTime,
        endTime: input.endTime,
        status: 'PENDING',
      });
    },
  );
  return toReservationDto(created);
}

export async function listActiveReservationsByUser(
  userId: string,
): Promise<Reservation[]> {
  const reservations: IReservation[] =
    await reservationRepository.findActiveByUser(userId);
  return reservations.map(toReservationDto);
}

/**
 * Moves a reservation to `target`. Repeating a transition that already
 * happened returns the reservation unchanged, so a retried PATCH is safe.
 */
async function transitionReservation(
  id: string,
  target: ReservationTransitionTarget,
): Promise<Reservation> {
  const updated: IReservation | undefined = await reservationRepository.updateStatusIf(
    id,
    ALLOWED_FROM[target],
    target,
  );
  if (updated !== undefined) {
    return toReservationDto(updated);
  }

  // The conditional update matched nothing: either the ID is unknown, or the
  // reservation is in a status this transition cannot leave.
  const current: IReservation | undefined = await reservationRepository.findById(id);
  if (current === undefined) {
    throw new NotFoundError('RESERVATION_NOT_FOUND', `Reservation ${id} does not exist.`);
  }
  if (current.status === target) {
    return toReservationDto(current);
  }
  throw new ConflictError(
    'INVALID_STATUS_TRANSITION',
    `Reservation ${id} is ${current.status} and cannot be ${TRANSITION_VERB[target]}.`,
  );
}

export async function confirmReservation(id: string): Promise<Reservation> {
  return transitionReservation(id, 'CONFIRMED');
}

/** Cancels a reservation. The slot is free for new bookings once this resolves. */
export async function cancelReservation(id: string): Promise<Reservation> {
  return transitionReservation(id, 'CANCELLED');
}
