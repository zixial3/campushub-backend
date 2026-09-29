import type { IResource } from '../models/resource.model';

export interface ResourceRepository {
  findAll(filter: { readonly type?: string }): Promise<IResource[]>;
  findById(id: string): Promise<IResource | undefined>;
}

const SEED_RESOURCES: readonly IResource[] = [
  {
    _id: 'res-101',
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Snell Library, Floor 3',
    isAvailable: true,
  },
  {
    _id: 'res-102',
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'EXP Makerspace',
    isAvailable: true,
  },
  {
    _id: 'res-103',
    name: 'Chemistry Lab B',
    type: 'LAB',
    location: 'Hurtig Hall 210',
    isAvailable: true,
  },
  {
    _id: 'res-104',
    name: 'Group Study Room 115',
    type: 'ROOM',
    location: 'Snell Library, Floor 1',
    isAvailable: true,
  },
  // Out of service, to exercise RESOURCE_UNAVAILABLE.
  {
    _id: 'res-202',
    name: 'Laser Cutter',
    type: 'EQUIPMENT',
    location: 'EXP Makerspace',
    isAvailable: false,
  },
];

export function createInMemoryResourceRepository(
  seed: readonly IResource[],
): ResourceRepository {
  const resources: IResource[] = seed.map((resource: IResource): IResource => ({
    ...resource,
  }));

  return {
    findAll(filter: { readonly type?: string }): Promise<IResource[]> {
      const matches: IResource[] = resources.filter(
        (resource: IResource): boolean =>
          filter.type === undefined || resource.type === filter.type,
      );
      return Promise.resolve(
        matches.map((resource: IResource): IResource => ({ ...resource })),
      );
    },
    findById(id: string): Promise<IResource | undefined> {
      const found: IResource | undefined = resources.find(
        (resource: IResource): boolean => resource._id === id,
      );
      return Promise.resolve(found === undefined ? undefined : { ...found });
    },
  };
}

export const resourceRepository: ResourceRepository =
  createInMemoryResourceRepository(SEED_RESOURCES);
