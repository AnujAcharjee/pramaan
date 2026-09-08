import { Router } from 'express';
import oauthRoutes from './oauth.routes.js';
import wellKnownRoutes from './well-known.routes.js';

const apiRouter = Router();

apiRouter.use('/', oauthRoutes);
apiRouter.use('/', wellKnownRoutes);

export default apiRouter;
