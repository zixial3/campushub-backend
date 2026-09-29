import type { NextFunction, Request, Response } from 'express';
import { listResources } from '../services/resource.service';
import { HttpStatus } from '../types/http';
import type { ListResourcesQuery, Resource } from '../types/reservation';
import { parseListResourcesQuery } from '../validators/resource.validators';

// GET /resources -> 200 Resource[] | 400 (errorHandler)
export async function getResources(
  req: Request,
  res: Response<Resource[]>,
  _next: NextFunction,
): Promise<void> {
  const query: ListResourcesQuery = parseListResourcesQuery(req.query);
  const resources: Resource[] = await listResources(query);
  res.status(HttpStatus.OK).json(resources);
}
