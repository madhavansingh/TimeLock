import { Router } from 'express';
import { JudgeController } from '../controllers/judge.controller';

const router = Router();

// Endpoints for the Judge Guided Demo Console
router.post('/demo-setup', JudgeController.demoSetup);
router.post('/execute-step', JudgeController.executeStep);

// Deep Judge Review Console Endpoints
router.get('/cases', JudgeController.getCases);
router.post('/cases/:id/review', JudgeController.submitReview);

export default router;
