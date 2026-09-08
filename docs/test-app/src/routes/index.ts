import { Router } from 'express';
import authRoutes from './auth.routes.js';
import homeRoutes from './home.routes.js';

const router = Router();

router.use('/', homeRoutes);
router.use('/', authRoutes);

export default router;
