import { Router } from 'express';
import { GovernanceController } from '../controllers/governance.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

// Enforce strict enterprise role security
router.use(authMiddleware);
router.use(rbacMiddleware(['ADMIN']));

// Model Registry rollouts
router.get('/registry', GovernanceController.getRegistry);
router.post('/registry', GovernanceController.registerModel);
router.post('/registry/rollout', GovernanceController.updateRollout);
router.post('/registry/rollback', GovernanceController.rollbackModel);

// Explainable Decision Provenance
router.get('/provenance/:id', GovernanceController.getProvenance);

// HITL Governance
router.get('/hitl', GovernanceController.getHitlActions);
router.post('/hitl/review', GovernanceController.reviewHitlAction);

// Continuous Evaluation & Drift
router.get('/evaluation', GovernanceController.getEvaluation);

// AI Cost Intelligence
router.get('/costs', GovernanceController.getCosts);

// Executive briefings
router.get('/briefings', GovernanceController.getBriefings);
router.post('/briefings', GovernanceController.triggerBriefing);

// Capacity Forecasting
router.get('/forecasting', GovernanceController.getForecasting);

// Policy Simulator (What-If analysis)
router.post('/simulation/policy', GovernanceController.runPolicySimulation);

// Operational Playbooks
router.get('/playbooks', GovernanceController.getPlaybook);

export default router;
