import { Router } from 'express';
import { healthRouter } from './health.routes';
import { reservationRouter } from './reservation.routes';
import { resourceRouter } from './resource.routes';

// Each router declares full contract paths, so routes read 1:1 against the spec.
export const apiRouter: Router = Router();

apiRouter.use(healthRouter);
apiRouter.use(resourceRouter);
apiRouter.use(reservationRouter);
