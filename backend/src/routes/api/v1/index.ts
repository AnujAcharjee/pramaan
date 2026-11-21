import { Router } from 'express';
import authApiRoutes from './authApi.routes.js';
import oauthApiRoutes from './oauthApi.routes.js';
import accountApiRoutes from './accountApi.routes.js';
import developerApiRoutes from './developerApi.routes.js';

const v1Router = Router();

v1Router.use('/auth', authApiRoutes);
v1Router.use('/oauth', oauthApiRoutes);
v1Router.use('/account', accountApiRoutes);
v1Router.use('/developer', developerApiRoutes);

export default v1Router;
