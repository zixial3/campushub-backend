import type { IResource } from '../models/resource.model';
import { resourceRepository } from '../repositories/resource.repository';
import type { ListResourcesQuery, Resource } from '../types/reservation';

export function toResourceDto(resource: IResource): Resource {
  return {
    id: resource._id,
    name: resource.name,
    type: resource.type,
    location: resource.location,
    isAvailable: resource.isAvailable,
  };
}

export async function listResources(query: ListResourcesQuery): Promise<Resource[]> {
  const resources: IResource[] = await resourceRepository.findAll(query);
  return resources.map(toResourceDto);
}
