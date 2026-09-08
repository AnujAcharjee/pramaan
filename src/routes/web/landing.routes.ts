import { Router } from 'express';
import { LandingController } from '../../controllers/landing.controller.js';

const router = Router();
const landingController = new LandingController();

router.get('/', landingController.renderLandingPage);

export default router;
