import { Router } from 'express';
import { developerApiController } from '../../../controllers/api/developerApi.controller.js';
import { Authentication, Authorize } from '../../../middlewares/authMiddleware.js';
import { ROLES } from '../../../utils/constant.js';
import { ClientZSchema } from '../../../validators/client.validators.js';
import { validateRequest } from '../../../middlewares/validateRequest.js';

const router = Router();

router.use(Authentication.ssr('default'), Authorize.role([ROLES.USER, ROLES.DEVELOPER]));

router.get('/clients', developerApiController.listClients);
router.post(
  '/clients',
  validateRequest(ClientZSchema.addClientSchema),
  developerApiController.createClient,
);
router.get(
  '/clients/:client_id',
  Authorize.clientOwnership,
  developerApiController.getClient,
);
router.put(
  '/clients/:client_id',
  Authorize.clientOwnership,
  validateRequest(ClientZSchema.updateClientSettingsSchema),
  developerApiController.updateClient,
);
router.post(
  '/clients/:client_id/rotate-secret',
  Authorize.clientOwnership,
  developerApiController.rotateSecret,
);
router.post(
  '/clients/:client_id/redirect-uris',
  Authorize.clientOwnership,
  developerApiController.addRedirectUri,
);
router.delete(
  '/clients/:client_id/redirect-uris',
  Authorize.clientOwnership,
  developerApiController.removeRedirectUri,
);
router.post(
  '/clients/:client_id/verify-domain',
  Authorize.clientOwnership,
  developerApiController.verifyDomain,
);
router.post(
  '/clients/:client_id/environment',
  Authorize.clientOwnership,
  developerApiController.switchEnvironment,
);
router.post(
  '/clients/:client_id/type',
  Authorize.clientOwnership,
  developerApiController.switchClientType,
);
router.post(
  '/clients/:client_id/pkce',
  Authorize.clientOwnership,
  developerApiController.togglePkce,
);
router.post(
  '/clients/:client_id/status',
  Authorize.clientOwnership,
  developerApiController.toggleStatus,
);
router.delete(
  '/clients/:client_id',
  Authorize.clientOwnership,
  developerApiController.deleteClient,
);

export default router;
