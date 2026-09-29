import { Schema, model } from 'mongoose';
import { RESERVATION_STATUSES } from '../types/reservation';
import type { ReservationStatus } from '../types/reservation';

export interface IReservation {
  _id: string;
  resourceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

const reservationSchema = new Schema<IReservation>(
  {
    _id: { type: String, required: true },
    resourceId: { type: String, required: true, ref: 'Resource' },
    userId: { type: String, required: true, ref: 'User' },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: RESERVATION_STATUSES,
      default: 'PENDING',
    },
  },
  { timestamps: true },
);

// Cross-field rule lives in a document hook: field validators may also run
// against Query objects, where `this` is not the document.
reservationSchema.pre('validate', function (): void {
  const { startTime, endTime } = this;
  if (
    startTime instanceof Date &&
    endTime instanceof Date &&
    endTime.getTime() <= startTime.getTime()
  ) {
    this.invalidate('endTime', 'endTime must be later than startTime.');
  }
});

// Serves both the overlap check (per resource, by time) and per-user listing.
reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });
reservationSchema.index({ userId: 1, status: 1, startTime: 1 });

export const ReservationModel = model<IReservation>('Reservation', reservationSchema);
