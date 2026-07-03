import { Request, Response, NextFunction } from 'express';
import { TwinEvolutionService } from '../services/ai/twin-evolution.service';
import { logger } from '../config/logger';

export class TwinEvolutionController {
  /**
   * GET /v1/operations/twins/:type/:id
   * Resolves or initializes a non-document Digital Twin.
   */
  public static async getTwin(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, id } = req.params;
      const { tenantId } = req.query;
      
      const twin = await TwinEvolutionService.getTwin(
        type.toUpperCase(),
        id,
        (tenantId as string) || null
      );
      
      return res.status(200).json({ data: twin, error: null });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /v1/operations/twins/:type/:id/recalculate
   * Manually triggers an evolution recalculation.
   */
  public static async recalculateTwin(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, id } = req.params;
      const { tenantId } = req.query;
      
      const twin = await TwinEvolutionService.recalculateTwin(
        type.toUpperCase(),
        id,
        (tenantId as string) || null
      );
      
      return res.status(200).json({ data: twin, error: null });
    } catch (err) {
      next(err);
    }
  }
}
