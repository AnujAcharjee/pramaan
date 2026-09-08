import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';

const router = Router();

router.get('/login', (req, res) => authController.login(req, res));
router.get('/oauth/callback', (req, res) => authController.callback(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));

export default router;
