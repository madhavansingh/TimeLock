import { Router } from 'express';
import { InteropSandboxController } from '../controllers/interop-sandbox.controller';

const router = Router();

// Endpoint for health-check pings
router.get('/:connectorName/ping', InteropSandboxController.ping);

// Endpoint for executing mock-production external connector actions
router.post('/:connectorName/:action', InteropSandboxController.handleAction);

export default router;
