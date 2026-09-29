import { Schema, model } from 'mongoose';
import { RESOURCE_TYPES } from '../types/reservation';
import type { ResourceType } from '../types/reservation';

export interface IResource {
  _id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

const resourceSchema = new Schema<IResource>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 1 },
    type: { type: String, required: true, enum: RESOURCE_TYPES, index: true },
    location: { type: String, required: true, trim: true, minlength: 1 },
    isAvailable: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const ResourceModel = model<IResource>('Resource', resourceSchema);
