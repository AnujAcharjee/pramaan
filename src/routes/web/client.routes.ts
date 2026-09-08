import { Router } from 'express';
import { ClientController } from '../../controllers/client.controller.js';
import { clientService } from '../../services/client.service.js';
import { accountService } from '../../services/account.service.js';
import { ClientZSchema } from '../../validators/client.validators.js';
import { validateRequest } from '../../middlewares/validateRequest.js';
import { Authentication, Authorize } from '../../middlewares/authMiddleware.js';
import { ROLES } from '../../utils/constant.js';

const router = Router();
const clientController = new ClientController(clientService, accountService);

router
  .route('/create-client')
  .get(
    Authentication.ssr('default'),
    Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
    clientController.renderAddClient,
  )
  .post(
    Authentication.ssr('default'),
    Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
    validateRequest(ClientZSchema.addClientSchema),
    clientController.addClient,
  );

router
  .route('/client/:client_id')
  .get(
    Authentication.ssr('default'),
    Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
    Authorize.clientOwnership,
    validateRequest(ClientZSchema.clientIdSchema),
    clientController.renderClientDashboard,
  )
  .delete(
    Authentication.ssr('default'),
    Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
    Authorize.clientOwnership,
    validateRequest(ClientZSchema.clientIdSchema),
    clientController.delete,
  )
  .put(
    Authentication.ssr('default'),
    Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
    Authorize.clientOwnership,
    validateRequest(ClientZSchema.clientIdSchema),
    clientController.deactivate,
  );

router.get(
  '/client/:client_id/:action',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
  Authorize.clientOwnership,
  validateRequest(ClientZSchema.clientIdSchema),
  clientController.renderClientConfirmation,
);

router.post(
  '/client/:client_id/activate',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
  Authorize.clientOwnership,
  validateRequest(ClientZSchema.clientIdSchema),
  clientController.activate,
);

router.post(
  '/client/:client_id/ruri',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
  Authorize.clientOwnership,
  validateRequest(ClientZSchema.manageRedirectsSchema),
  clientController.manageRedirects,
);

router.post(
  '/client/:client_id/environment',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
  Authorize.clientOwnership,
  validateRequest(ClientZSchema.updateEnvironmentSchema),
  clientController.updateClientEnvironment,
);

router.post(
  '/client/rotate-secret',
  Authentication.ssr('default'),
  Authorize.role([ROLES.USER, ROLES.DEVELOPER]),
  Authorize.clientOwnership,
  validateRequest(ClientZSchema.rotateSecretSchema),
  clientController.rotateClientSecret,
);

export default router;
