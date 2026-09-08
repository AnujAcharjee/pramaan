import { Router } from 'express';
import { homeController } from '../controllers/home.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', (req, res) => homeController.renderIndex(req, res));
router.get('/dashboard', requireAuth, (req, res) => homeController.renderDashboard(req, res));

export default router;
