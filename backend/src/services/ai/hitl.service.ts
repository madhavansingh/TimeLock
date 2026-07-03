import { prisma, basePrisma } from '../../config/db';
import { logger } from '../../config/logger';
import { PlatformLearningService } from './platform-learning.service';

export class HitlService {
  /**
   * Registers a new action requiring human review/override.
   */
  public static async createAction(
    tenantId: string | null,
    targetId: string,
    targetType: string,
    originalState: any,
    proposedState: any,
    assignedRole: string
  ): Promise<any> {
    logger.info(`[HITL] Creating review action for ${targetType} ${targetId} (Assigned Role: ${assignedRole})`);

    return basePrisma.hitlAction.create({
      data: {
        tenantId,
        targetId,
        targetType,
        originalState: originalState || {},
        proposedState: proposedState || {},
        workflowStatus: 'PENDING_HUMAN_REVIEW',
        assignedRole
      }
    });
  }

  /**
   * Reviews and executes a decision on a pending HITL action.
   * If the decision is an override or modification, it logs the rationale to the Platform Learning database.
   */
  public static async reviewAction(
    actionId: string,
    status: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'ESCALATED' | 'OVERRIDDEN',
    reviewedBy: string,
    overrideRationale?: string,
    modifiedState?: any
  ): Promise<any> {
    logger.info(`[HITL] Action ${actionId} reviewed. Decision: ${status} by User ${reviewedBy}`);

    const updatedAction = await basePrisma.$transaction(async (tx) => {
      const action = await tx.hitlAction.findUnique({
        where: { actionId }
      });

      if (!action) {
        throw new Error(`HITL Action not found for ID: ${actionId}`);
      }

      const finalProposedState = status === 'MODIFIED' ? (modifiedState || action.proposedState) : action.proposedState;

      // Update HITL action state
      return tx.hitlAction.update({
        where: { actionId },
        data: {
          workflowStatus: status,
          reviewedBy,
          overrideRationale: overrideRationale || null,
          proposedState: finalProposedState,
          executionTimestamp: new Date()
        }
      });
    });

    // Log override/decision details to Platform Learning to capture alignment feedback outside transaction
    try {
      await PlatformLearningService.captureFeedback(
        updatedAction.tenantId,
        status === 'OVERRIDDEN' ? 'HUMAN_OVERRIDE' : `${status}_ACTION`,
        updatedAction.targetId,
        {
          originalState: updatedAction.originalState,
          proposedState: updatedAction.proposedState,
          assignedRole: updatedAction.assignedRole,
          reviewedBy
        },
        {
          decision: status,
          rationale: overrideRationale || 'Standard review action execution.'
        },
        overrideRationale
      );
    } catch (err: any) {
      logger.error(`[HITL] Failed to capture feedback dataset for learning: ${err.message}`);
    }

    return updatedAction;
  }

  /**
   * Retrieves all pending review actions for a specific role or tenant.
   */
  public static async getPendingActions(assignedRole?: string, tenantId?: string): Promise<any[]> {
    const whereClause: any = { workflowStatus: 'PENDING_HUMAN_REVIEW' };
    if (assignedRole) whereClause.assignedRole = assignedRole;
    if (tenantId) whereClause.tenantId = tenantId;

    return basePrisma.hitlAction.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' }
    });
  }
}
