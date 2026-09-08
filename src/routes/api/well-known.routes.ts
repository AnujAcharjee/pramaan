import { Router } from 'express';
import { JoseController } from '../../controllers/jose.controller.js';
import { joseService } from '../../services/jose.service.js';
import { DiscoveryController } from '../../controllers/discovery.controller.js';
import { discoveryService } from '../../services/discovery.service.js';

const router = Router();
const joseController = new JoseController(joseService);
const discoveryController = new DiscoveryController(discoveryService);

// OIDC Discovery endpoints (RFC 8414 & OpenID Connect Discovery 1.0)
router.get('/.well-known/openid-configuration', discoveryController.getOpenIdConfiguration);
router.get('/api/.well-known/openid-configuration', discoveryController.getOpenIdConfiguration);

// JWKS endpoints (both /api/.well-known/jwks.json and standard /.well-known/jwks.json)
router.get('/api/.well-known/jwks.json', joseController.getJwks);
router.get('/.well-known/jwks.json', joseController.getJwks);

export default router;
