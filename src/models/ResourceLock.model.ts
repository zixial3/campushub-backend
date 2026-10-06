import { Schema, model } from 'mongoose';
import type { Types } from 'mongoose';

// A short-lived mutex per resource. _id is the resource's id, so the unique
// _id index guarantees at most one live lock per resource.
export interface IResourceLock {
  _id: Types.ObjectId;
  token: string;
  expiresAt: Date;
}

const resourceLockSchema = new Schema<IResourceLock>(
  {
    token: { type: String, required: true },
    // TTL index: MongoDB deletes locks left behind by a crashed process.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false },
);

export const ResourceLockModel = model<IResourceLock>('ResourceLock', resourceLockSchema);
