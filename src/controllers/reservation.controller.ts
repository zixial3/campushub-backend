import type { NextFunction, Request, Response } from 'express';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  listActiveReservationsByUser,
} from '../services/reservation.service';
import { HttpStatus } from '../types/http';
import type { NewReservationInput, Reservation } from '../types/reservation';
import {
  parseCreateReservationRequest,
  parseReservationIdParam,
  parseUserIdParam,
} from '../validators/reservation.validators';

// POST /reservations -> 201 Reservation | 400 | 404 | 409 (errorHandler)
export async function postReservation(
  req: Request,
  res: Response<Reservation>,
  _next: NextFunction,
): Promise<void> {
  const input: NewReservationInput = parseCreateReservationRequest(req.body);
  const reservation: Reservation = await createReservation(input);
  res.status(HttpStatus.CREATED).json(reservation);
}

// GET /reservations/user/{userId} -> 200 Reservation[] | 400 (errorHandler)
export async function getUserReservations(
  req: Request,
  res: Response<Reservation[]>,
  _next: NextFunction,
): Promise<void> {
  const userId: string = parseUserIdParam(req.params['userId']);
  const reservations: Reservation[] = await listActiveReservationsByUser(userId);
  res.status(HttpStatus.OK).json(reservations);
}

// PATCH /reservations/{id}/confirm -> 200 Reservation | 400 | 404 | 409 (errorHandler)
export async function patchConfirmReservation(
  req: Request,
  res: Response<Reservation>,
  _next: NextFunction,
): Promise<void> {
  const id: string = parseReservationIdParam(req.params['id']);
  const reservation: Reservation = await confirmReservation(id);
  res.status(HttpStatus.OK).json(reservation);
}

// PATCH /reservations/{id}/cancel -> 200 Reservation | 400 | 404 (errorHandler)
export async function patchCancelReservation(
  req: Request,
  res: Response<Reservation>,
  _next: NextFunction,
): Promise<void> {
  const id: string = parseReservationIdParam(req.params['id']);
  const reservation: Reservation = await cancelReservation(id);
  res.status(HttpStatus.OK).json(reservation);
}
