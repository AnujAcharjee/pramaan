import { Router } from 'express';
import { LandingController } from '../../controllers/landing.controller.js';
import { Authentication } from '../../middlewares/authMiddleware.js';

const router = Router();
const landingController = new LandingController();

router.get('/', Authentication.optionalSsr(), landingController.renderLandingPage);

export default router;
