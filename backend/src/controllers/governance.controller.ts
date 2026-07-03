import { Request, Response, NextFunction } from 'express';
import { ModelRegistryService } from '../services/ai/model-registry.service';
import { ProvenanceService } from '../services/ai/provenance.service';
import { HitlService } from '../services/ai/hitl.service';
import { EvaluationEngineService } from '../services/ai/evaluation-engine.service';
import { CostIntelligenceService } from '../services/ai/cost-intelligence.service';
import { PolicyAnalyzerService } from '../services/ai/policy-analyzer.service';
import { PlaybookService } from '../services/ai/playbook.service';
import { BriefingService } from '../services/ai/briefing.service';
import { ForecastingService } from '../services/ai/forecasting.service';
import { TwinEvolutionService } from '../services/ai/twin-evolution.service';
import { logger } from '../config/logger';

export class GovernanceController {
  /**
   * GET /v1/operations/governance/registry
   */
  public static async getRegistry(req: Request, res: Response, next: NextFunction) {
    try {
      const registry = await ModelRegistryService.getRegistry();
      return res.status(200).json({ data: registry, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/operations/governance/registry
   */
  public static async registerModel(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentName, modelVersion, promptVersion, rollbackSupported, evaluationMetrics } = req.body;
      const entry = await ModelRegistryService.registerModel(
        agentName,
        modelVersion,
        promptVersion,
        rollbackSupported,
        evaluationMetrics
      );
      return res.status(201).json({ data: entry, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/operations/governance/registry/rollout
   */
  public static async updateRollout(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentName, modelVersion, promptVersion, rolloutPercentage } = req.body;
      const entry = await ModelRegistryService.updateRollout(
        agentName,
        modelVersion,
        promptVersion,
        rolloutPercentage
      );
      return res.status(200).json({ data: entry, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/operations/governance/registry/rollback
   */
  public static async rollbackModel(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentName, modelVersion, promptVersion } = req.body;
      const entry = await ModelRegistryService.rollbackModel(agentName, modelVersion, promptVersion);
      return res.status(200).json({ data: entry, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/operations/governance/provenance/:id
   */
  public static async getProvenance(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { decisionType } = req.query;
      const provenance = await ProvenanceService.getProvenance(id, (decisionType as string) || 'FRAUD_RISK');
      
      if (!provenance) {
        return res.status(404).json({ data: null, error: { code: 'PROVENANCE_NOT_FOUND', message: 'No decision provenance found.' } });
      }

      const isValid = await ProvenanceService.verifyIntegrity(provenance.provenanceId);

      return res.status(200).json({
        data: {
          ...provenance,
          integrityVerified: isValid
        },
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/operations/governance/hitl
   */
  public static async getHitlActions(req: Request, res: Response, next: NextFunction) {
    try {
      const { role, tenantId } = req.query;
      const actions = await HitlService.getPendingActions(role as string, tenantId as string);
      return res.status(200).json({ data: actions, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/operations/governance/hitl/review
   */
  public static async reviewHitlAction(req: Request, res: Response, next: NextFunction) {
    try {
      const { actionId, status, reviewedBy, overrideRationale, modifiedState } = req.body;
      const action = await HitlService.reviewAction(actionId, status, reviewedBy, overrideRationale, modifiedState);
      return res.status(200).json({ data: action, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/operations/governance/evaluation
   */
  public static async getEvaluation(req: Request, res: Response, next: NextFunction) {
    try {
      const { agentName } = req.query;
      if (!agentName) {
        return res.status(400).json({ data: null, error: { code: 'MISSING_PARAM', message: 'agentName is required.' } });
      }
      // Run evaluation dynamically and fetch history
      await EvaluationEngineService.runEvaluation(agentName as string);
      const history = await EvaluationEngineService.getEvaluationHistory(agentName as string);
      return res.status(200).json({ data: history, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/operations/governance/costs
   */
  public static async getCosts(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.query;
      const report = await CostIntelligenceService.getCostSummary(tenantId as string);
      return res.status(200).json({ data: report, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/operations/governance/briefings
   */
  public static async getBriefings(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.query;
      const briefing = await BriefingService.getLatestBriefing(tenantId as string);
      return res.status(200).json({ data: briefing, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/operations/governance/briefings
   */
  public static async triggerBriefing(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, scope, generatedBy } = req.body;
      const briefing = await BriefingService.generateBriefing(tenantId, scope, generatedBy);
      return res.status(201).json({ data: briefing, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/operations/governance/forecasting
   */
  public static async getForecasting(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.query;
      const forecasts = await ForecastingService.getForecasts(tenantId as string);
      return res.status(200).json({ data: forecasts, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/operations/governance/simulation/policy
   */
  public static async runPolicySimulation(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId, proposedRules } = req.body;
      const report = await PolicyAnalyzerService.analyzeImpact(tenantId, proposedRules);
      return res.status(200).json({ data: report, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/operations/governance/playbooks
   */
  public static async getPlaybook(req: Request, res: Response, next: NextFunction) {
    try {
      const { riskType, severity } = req.query;
      const playbook = PlaybookService.generatePlaybook(riskType as string, severity as string);
      return res.status(200).json({ data: playbook, error: null });
    } catch (err) {
      next(err);
    }
  }
}
