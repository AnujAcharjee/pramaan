import { Router } from 'express';
import oauthRoutes from './oauth.routes.js';
import wellKnownRoutes from './well-known.routes.js';
import v1Router from './v1/index.js';

const apiRouter = Router();

apiRouter.use('/api/v1', v1Router);
apiRouter.use('/v1', v1Router);
apiRouter.use('/', oauthRoutes);
apiRouter.use('/', wellKnownRoutes);

export default apiRouter;
