import { Router } from 'express';
import { getResources } from '../controllers/resource.controller';
import { asyncHandler } from '../middleware/asyncHandler';

export const resourceRouter: Router = Router();

resourceRouter.get('/resources', asyncHandler(getResources));
