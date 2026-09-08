import { Router } from 'express';
import { JoseController } from '../../controllers/jose.controller.js';
import { joseService } from '../../services/jose.service.js';

const router = Router();
const joseController = new JoseController(joseService);

// JWKS endpoints (both /api/.well-known/jwks.json and standard /.well-known/jwks.json)
router.get('/api/.well-known/jwks.json', joseController.getJwks);
router.get('/.well-known/jwks.json', joseController.getJwks);

export default router;
