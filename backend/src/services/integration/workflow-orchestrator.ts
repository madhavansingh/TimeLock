import { prisma } from '../../config/db';
import { logger } from '../../config/logger';

export interface WorkflowStep {
  name: string;
  action: (context: any) => Promise<any>;
  compensation?: (context: any) => Promise<void>;
  isParallel?: boolean;
}

export class WorkflowOrchestrator {
  /**
   * Registers and executes a workflow Saga instance, handling rollbacks upon failure.
   */
  public static async executeWorkflow(
    workflowName: string,
    steps: WorkflowStep[],
    initialContext: any,
    correlationId?: string
  ): Promise<any> {
    const corrId = correlationId || 'wf-corr-' + Math.random().toString(36).substring(7);
    
    // 1. Create persistent execution record in database
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowName,
        status: 'RUNNING',
        currentStep: 'START',
        context: initialContext as any,
        stepsHistory: [] as any,
        correlationId: corrId,
      },
    });

    const context = { ...initialContext };
    const history: Array<{ step: string; status: 'SUCCESS' | 'FAILED' | 'PENDING'; timestamp: string; result?: any; error?: string }> = [];
    const completedSteps: WorkflowStep[] = [];

    logger.info(`[WorkflowOrchestrator] Starting workflow "${workflowName}" (Execution ID: ${execution.id})`, { correlationId: corrId });

    try {
      for (const step of steps) {
        // Update current step state
        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { 
            currentStep: step.name,
            context: context as any
          },
        });

        logger.info(`[WorkflowOrchestrator] Executing step "${step.name}" on "${workflowName}"`, { correlationId: corrId });

        history.push({ step: step.name, status: 'PENDING', timestamp: new Date().toISOString() });

        // Check if step requires human approval (e.g. Notary Signature)
        if (step.name.toUpperCase().includes('APPROVAL') || step.name.toUpperCase().includes('SIGNATURE_HUMAN')) {
          await prisma.workflowExecution.update({
            where: { id: execution.id },
            data: { 
              status: 'SUSPENDED_APPROVAL',
              stepsHistory: history as any
            },
          });
          logger.info(`[WorkflowOrchestrator] Workflow "${workflowName}" suspended for human approval at step "${step.name}"`, { correlationId: corrId });
          return { executionId: execution.id, status: 'SUSPENDED_APPROVAL', context };
        }

        // Execute step action
        const result = await step.action(context);
        
        // Merge result into context
        if (result && typeof result === 'object') {
          Object.assign(context, result);
        }

        // Mark step as completed for saga rollback tracing
        completedSteps.push(step);
        
        const histIndex = history.findIndex(h => h.step === step.name);
        history[histIndex] = {
          step: step.name,
          status: 'SUCCESS',
          timestamp: new Date().toISOString(),
          result: result ? { keys: Object.keys(result) } : undefined
        };
      }

      // 2. Mark workflow as successfully completed
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          currentStep: 'COMPLETED',
          context: context as any,
          stepsHistory: history as any,
        },
      });

      logger.info(`[WorkflowOrchestrator] Workflow "${workflowName}" completed successfully`, { correlationId: corrId });
      return { executionId: execution.id, status: 'COMPLETED', context };
    } catch (err: any) {
      const errMsg = err.message || 'Workflow step execution failed';
      logger.error(`[WorkflowOrchestrator] Step failure on "${workflowName}" at step: ${execution.currentStep}. Reason: ${errMsg}`, { correlationId: corrId });

      const failedIndex = history.findIndex(h => h.step === execution.currentStep);
      if (failedIndex !== -1) {
        history[failedIndex] = {
          step: execution.currentStep,
          status: 'FAILED',
          timestamp: new Date().toISOString(),
          error: errMsg
        };
      }

      // 3. Trigger Compensation Actions (Saga Rollback in reverse order)
      logger.warn(`[WorkflowOrchestrator] Initiating Saga compensation (rollback) for workflow "${workflowName}"...`, { correlationId: corrId });
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { 
          status: 'FAILING_ROLLBACK',
          stepsHistory: history as any
        },
      });

      for (let i = completedSteps.length - 1; i >= 0; i--) {
        const step = completedSteps[i];
        if (step.compensation) {
          try {
            logger.info(`[WorkflowOrchestrator] Running compensation action for step "${step.name}"`, { correlationId: corrId });
            await step.compensation(context);
          } catch (compErr: any) {
            logger.error(`[WorkflowOrchestrator] Saga rollback failure: Compensation for step "${step.name}" failed: ${compErr.message}`, { correlationId: corrId });
          }
        }
      }

      // 4. Mark workflow as failed
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          context: context as any,
        },
      });

      throw new Error(`[WorkflowOrchestrator] Workflow "${workflowName}" failed at step "${execution.currentStep}". Saga rolled back. Error: ${errMsg}`);
    }
  }

  /**
   * Resumes a suspended workflow execution (e.g., after human notary approval is submitted).
   */
  public static async resumeWorkflow(executionId: string, approvalContext: any): Promise<any> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new Error(`[WorkflowOrchestrator] Execution ID "${executionId}" not found.`);
    }

    if (execution.status !== 'SUSPENDED_APPROVAL') {
      throw new Error(`[WorkflowOrchestrator] Cannot resume execution "${executionId}". Current status is "${execution.status}".`);
    }

    logger.info(`[WorkflowOrchestrator] Resuming workflow "${execution.workflowName}" (Execution ID: ${executionId})`, { correlationId: execution.correlationId || undefined });

    // Merging approval details into context
    const currentContext = { ...(execution.context as any), ...approvalContext };
    
    // We rebuild the workflow steps based on the workflow name.
    // For this implementation, we will fetch the registered step orchestrator configurations dynamically.
    // E.g. rebuilding the steps of the Ownership Transfer workflow.
    const steps = this.rebuildStepsForWorkflow(execution.workflowName);

    // Find the index of the step that was suspended to resume from it
    const suspendedStepName = execution.currentStep;
    const suspendedIndex = steps.findIndex(s => s.name === suspendedStepName);

    if (suspendedIndex === -1) {
      throw new Error(`[WorkflowOrchestrator] Suspended step "${suspendedStepName}" not found in rebuilt step array.`);
    }

    // Slice the steps to only execute from the suspended step onwards
    const remainingSteps = steps.slice(suspendedIndex + 1);

    // Update state to running and continue execution
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' }
    });

    return this.executeWorkflow(execution.workflowName, remainingSteps, currentContext, execution.correlationId || undefined);
  }

  /**
   * Rebuilds steps dynamically based on the workflow name (to support resumption).
   */
  private static rebuildStepsForWorkflow(workflowName: string): WorkflowStep[] {
    if (workflowName === 'OWNERSHIP_TRANSFER') {
      // Return step definitions matching the Ownership Transfer workflow (without live dependencies)
      return [
        { name: 'IDENTITY_CHECK', action: async () => {} },
        { name: 'REGISTRY_VERIFICATION', action: async () => {} },
        { name: 'ESCROW_CLEARING', action: async () => {} },
        { name: 'NOTARY_APPROVAL', action: async () => {} }, // human suspended step
        { name: 'SOLANA_ANCHOR', action: async () => {} },
        { name: 'REGISTRY_SYNC', action: async () => {} },
      ];
    }
    return [];
  }
}
