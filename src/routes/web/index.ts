import { Router } from 'express';
import landingRoutes from './landing.routes.js';
import authRoutes from './auth.routes.js';
import accountRoutes from './account.routes.js';
import clientRoutes from './client.routes.js';
import consentRoutes from './consent.routes.js';

const webRouter = Router();

webRouter.use('/', landingRoutes);
webRouter.use('/', authRoutes);
webRouter.use('/', accountRoutes);
webRouter.use('/', clientRoutes);
webRouter.use('/', consentRoutes);

export default webRouter;
