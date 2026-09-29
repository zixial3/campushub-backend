import { Router } from 'express';
import {
  getUserReservations,
  postReservation,
} from '../controllers/reservation.controller';
import { asyncHandler } from '../middleware/asyncHandler';

// Paths are relative to the /api/v1 server URL and match docs/openapi.yaml verbatim.
export const reservationRouter: Router = Router();

reservationRouter.post('/reservations', asyncHandler(postReservation));
reservationRouter.get('/reservations/user/:userId', asyncHandler(getUserReservations));
