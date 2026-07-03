import { prisma, basePrisma } from '../../config/db';
import { logger } from '../../config/logger';

export interface ModelRegistryEntry {
  registryId: string;
  agentName: string;
  modelVersion: string;
  promptVersion: string;
  rolloutPercentage: number;
  isActive: boolean;
  rollbackSupported: boolean;
  evaluationMetrics: any;
  status: 'STAGED' | 'ACTIVE' | 'DEPRECATED' | 'ROLLED_BACK';
}

export class ModelRegistryService {
  /**
   * Resolves the active model and prompt version for an agent.
   * Leverages rollout percentages to route traffic between active/staged versions.
   */
  public static async resolveActiveVersion(agentName: string): Promise<{ modelVersion: string; promptVersion: string }> {
    try {
      // Fetch all non-deprecated registry entries for this agent
      const entries = await basePrisma.aiModelRegistry.findMany({
        where: {
          agentName,
          status: { in: ['ACTIVE', 'STAGED'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (entries.length === 0) {
        // Fallback to defaults if no registry is configured
        return { modelVersion: 'Nemotron-3-Nano', promptVersion: 'v1.0' };
      }

      // Find the active baseline
      const activeBaseline = entries.find(e => e.status === 'ACTIVE');
      // Find the staged candidate (for canary rollouts)
      const stagedCandidate = entries.find(e => e.status === 'STAGED' && e.rolloutPercentage > 0);

      if (stagedCandidate && activeBaseline) {
        // Determine rollout routing based on random threshold
        const randomVal = Math.floor(Math.random() * 100);
        if (randomVal < stagedCandidate.rolloutPercentage) {
          logger.info(`[ModelRegistry] Routing to canary version for agent ${agentName} (${stagedCandidate.promptVersion}, rollout: ${stagedCandidate.rolloutPercentage}%)`);
          return { modelVersion: stagedCandidate.modelVersion, promptVersion: stagedCandidate.promptVersion };
        }
      }

      if (activeBaseline) {
        return { modelVersion: activeBaseline.modelVersion, promptVersion: activeBaseline.promptVersion };
      }

      // Fallback to the latest entry if no explicit active baseline exists
      return { modelVersion: entries[0].modelVersion, promptVersion: entries[0].promptVersion };
    } catch (err: any) {
      logger.error(`[ModelRegistry] Failed to resolve active version for agent ${agentName}: ${err.message}`);
      return { modelVersion: 'Nemotron-3-Nano', promptVersion: 'v1.0' };
    }
  }

  /**
   * Registers a new AI agent version in the registry.
   */
  public static async registerModel(
    agentName: string,
    modelVersion: string,
    promptVersion: string,
    rollbackSupported: boolean = true,
    evaluationMetrics: any = {}
  ): Promise<any> {
    logger.info(`[ModelRegistry] Registering agent ${agentName} (Model: ${modelVersion}, Prompt: ${promptVersion})`);
    
    return basePrisma.aiModelRegistry.upsert({
      where: {
        agentName_modelVersion_promptVersion: {
          agentName,
          modelVersion,
          promptVersion
        }
      },
      update: {
        rollbackSupported,
        evaluationMetrics: evaluationMetrics || {},
        status: 'STAGED'
      },
      create: {
        agentName,
        modelVersion,
        promptVersion,
        rolloutPercentage: 0,
        isActive: false,
        rollbackSupported,
        evaluationMetrics: evaluationMetrics || {},
        status: 'STAGED'
      }
    });
  }

  /**
   * Updates the rollout percentage of a staged candidate.
   * If rollout reaches 100%, it becomes the new active baseline and prior baselines are marked DEPRECATED.
   */
  public static async updateRollout(
    agentName: string,
    modelVersion: string,
    promptVersion: string,
    rolloutPercentage: number
  ): Promise<any> {
    logger.info(`[ModelRegistry] Updating rollout for agent ${agentName} (${promptVersion}) to ${rolloutPercentage}%`);

    if (rolloutPercentage < 0 || rolloutPercentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    return basePrisma.$transaction(async (tx) => {
      const target = await tx.aiModelRegistry.findUnique({
        where: {
          agentName_modelVersion_promptVersion: {
            agentName,
            modelVersion,
            promptVersion
          }
        }
      });

      if (!target) {
        throw new Error(`Model registry entry not found for agent ${agentName} (${promptVersion})`);
      }

      if (rolloutPercentage === 100) {
        // Deprecate all prior active/staged versions
        await tx.aiModelRegistry.updateMany({
          where: {
            agentName,
            NOT: {
              modelVersion,
              promptVersion
            }
          },
          data: {
            status: 'DEPRECATED',
            isActive: false,
            rolloutPercentage: 0
          }
        });

        // Promote target to ACTIVE baseline
        return tx.aiModelRegistry.update({
          where: {
            agentName_modelVersion_promptVersion: {
              agentName,
              modelVersion,
              promptVersion
            }
          },
          data: {
            status: 'ACTIVE',
            isActive: true,
            rolloutPercentage: 100
          }
        });
      } else {
        // Simply update rollout percentage for staged candidate
        return tx.aiModelRegistry.update({
          where: {
            agentName_modelVersion_promptVersion: {
              agentName,
              modelVersion,
              promptVersion
            }
          },
          data: {
            rolloutPercentage,
            status: 'STAGED',
            isActive: false
          }
        });
      }
    });
  }

  /**
   * Triggers a rollback of a failing agent to the last stable version.
   */
  public static async rollbackModel(
    agentName: string,
    modelVersion: string,
    promptVersion: string
  ): Promise<any> {
    logger.warn(`[ModelRegistry] Rollback requested for agent ${agentName} (${promptVersion})`);

    return basePrisma.$transaction(async (tx) => {
      const target = await tx.aiModelRegistry.findUnique({
        where: {
          agentName_modelVersion_promptVersion: {
            agentName,
            modelVersion,
            promptVersion
          }
        }
      });

      if (!target) {
        throw new Error(`Model registry entry not found for agent ${agentName} (${promptVersion})`);
      }

      if (!target.rollbackSupported) {
        throw new Error(`Rollback is not supported for agent ${agentName} (${promptVersion})`);
      }

      // Mark the target as rolled back
      await tx.aiModelRegistry.update({
        where: {
          agentName_modelVersion_promptVersion: {
            agentName,
            modelVersion,
            promptVersion
          }
        },
        data: {
          status: 'ROLLED_BACK',
          isActive: false,
          rolloutPercentage: 0
        }
      });

      // Find the most recent deprecated or active version that was stable
      const priorStable = await tx.aiModelRegistry.findFirst({
        where: {
          agentName,
          status: 'DEPRECATED'
        },
        orderBy: { createdAt: 'desc' }
      });

      if (priorStable) {
        logger.info(`[ModelRegistry] Restoring prior stable version for agent ${agentName} (${priorStable.promptVersion})`);
        return tx.aiModelRegistry.update({
          where: {
            registryId: priorStable.registryId
          },
          data: {
            status: 'ACTIVE',
            isActive: true,
            rolloutPercentage: 100
          }
        });
      }

      logger.warn(`[ModelRegistry] No prior stable version found to roll back to for agent ${agentName}.`);
      return null;
    });
  }

  /**
   * Retrieves the full model registry database table.
   */
  public static async getRegistry(): Promise<any[]> {
    return basePrisma.aiModelRegistry.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
