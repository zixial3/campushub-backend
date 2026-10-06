import { isObjectIdOrHexString } from 'mongoose';
import { ResourceModel } from '../models/Resource.model';
import type { IResource } from '../models/Resource.model';
import { RESOURCE_TYPES } from '../types/reservation';
import type { ResourceType } from '../types/reservation';

export interface ResourceRepository {
  findAll(filter: { readonly type?: string }): Promise<IResource[]>;
  findById(id: string): Promise<IResource | undefined>;
}

function isResourceType(value: string): value is ResourceType {
  return (RESOURCE_TYPES as readonly string[]).includes(value);
}

export function createMongooseResourceRepository(): ResourceRepository {
  return {
    async findAll(filter: { readonly type?: string }): Promise<IResource[]> {
      if (filter.type === undefined) {
        return ResourceModel.find().sort({ _id: 1 }).lean<IResource[]>().exec();
      }
      // An unknown type matches nothing, which is the contract's 200 [].
      if (!isResourceType(filter.type)) {
        return [];
      }
      return ResourceModel.find({ type: filter.type })
        .sort({ _id: 1 })
        .lean<IResource[]>()
        .exec();
    },
    async findById(id: string): Promise<IResource | undefined> {
      // Identifiers are opaque in the contract, so a malformed one is "not found"
      // rather than a Mongoose CastError surfacing as a 500.
      if (!isObjectIdOrHexString(id)) {
        return undefined;
      }
      const found: IResource | null = await ResourceModel.findById(id)
        .lean<IResource>()
        .exec();
      return found ?? undefined;
    },
  };
}

export const resourceRepository: ResourceRepository = createMongooseResourceRepository();
