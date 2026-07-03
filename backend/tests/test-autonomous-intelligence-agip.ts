import { prisma, basePrisma, tenantContextStorage } from '../src/config/db';
import { ModelRegistryService } from '../src/services/ai/model-registry.service';
import { ProvenanceService } from '../src/services/ai/provenance.service';
import { HitlService } from '../src/services/ai/hitl.service';
import { EvaluationEngineService } from '../src/services/ai/evaluation-engine.service';
import { CostIntelligenceService } from '../src/services/ai/cost-intelligence.service';
import { PolicyAnalyzerService } from '../src/services/ai/policy-analyzer.service';
import { PlaybookService } from '../src/services/ai/playbook.service';
import { BriefingService } from '../src/services/ai/briefing.service';
import { ForecastingService } from '../src/services/ai/forecasting.service';
import { TwinEvolutionService } from '../src/services/ai/twin-evolution.service';
import { AutonomousVerificationEngine } from '../src/services/ai/ave.service';
import { PlatformLearningService } from '../src/services/ai/platform-learning.service';

async function runTests() {
  console.log('============================================================');
  console.log('Starting AGIP & Autonomous Intelligence Automated Tests...');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const tenantId = 'test-tenant-agip';
  const targetId = 'test-doc-provenance-uuid';
  
  try {
    // Clean up any residual data from prior failed runs to ensure absolute test isolation
    console.log('Clearing residual test data to guarantee pristine state...');
    await basePrisma.feedbackLearningDataset.deleteMany({ where: { tenantId } }).catch(() => {});
    await basePrisma.decisionProvenance.deleteMany({ where: { targetId } }).catch(() => {});
    await basePrisma.hitlAction.deleteMany({ where: { tenantId } }).catch(() => {});
    await basePrisma.continuousEvaluationLog.deleteMany({ where: { agentName: 'AutonomousVerificationEngine' } }).catch(() => {});
    await basePrisma.aiCostMetric.deleteMany({ where: { tenantId } }).catch(() => {});
    await basePrisma.policyEvaluationLog.deleteMany({ where: { tenantId } }).catch(() => {});
    await basePrisma.policySimulation.deleteMany({ where: { tenantId } }).catch(() => {});
    await basePrisma.executiveBriefing.deleteMany({ where: { tenantId } }).catch(() => {});
    await basePrisma.digitalTwinHistory.deleteMany({ where: { targetId: 'test-property-twin-id' } }).catch(() => {});
    await basePrisma.digitalTwin.deleteMany({ where: { tenantId } }).catch(() => {});
    await basePrisma.aiModelRegistry.deleteMany({ where: { agentName: 'AutonomousVerificationEngine' } }).catch(() => {});
    await basePrisma.tenant.delete({ where: { tenantId } }).catch(() => {});

    // 1. Setup clean test tenant
    await basePrisma.tenant.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        name: 'Sovereign AGIP Test Authority',
        type: 'STATE_GOV',
        brandingConfig: {},
        aiPolicies: {},
        securityPolicies: {},
        auditPolicies: {},
        country: 'IN',
        state: 'MH',
        district: 'PUNE'
      }
    });

    // -------------------------------------------------------------------------
    // TEST 1: Model Registry Rollout Control
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Model Registry Deploys & Rollouts ---');
    
    // Register prior model v1.0.0
    await ModelRegistryService.registerModel(
      'AutonomousVerificationEngine',
      'v1.0.0',
      'prompt:ave:production:v1',
      true,
      { accuracy: 0.90 }
    );
    // Promote to 100% to make it the active baseline
    await ModelRegistryService.updateRollout(
      'AutonomousVerificationEngine',
      'v1.0.0',
      'prompt:ave:production:v1',
      100
    );

    // Register new candidate v2.0.0-rc1
    const initialEntry = await ModelRegistryService.registerModel(
      'AutonomousVerificationEngine',
      'v2.0.0-rc1',
      'prompt:ave:production:v2',
      true,
      { accuracy: 0.94 }
    );
    assert(initialEntry !== null, 'Agent successfully registered in the Model Registry.');
    assert(initialEntry.rolloutPercentage === 0, 'Initial rollout percentage is zero.');
    assert(initialEntry.status === 'STAGED', 'Initial status is STAGED.');

    // Promote new candidate to 100% (which deprecates v1.0.0)
    await ModelRegistryService.updateRollout(
      'AutonomousVerificationEngine',
      'v2.0.0-rc1',
      'prompt:ave:production:v2',
      100
    );

    // Rollback new candidate v2.0.0-rc1 (should restore v1.0.0)
    const rollbackedEntry = await ModelRegistryService.rollbackModel(
      'AutonomousVerificationEngine',
      'v2.0.0-rc1',
      'prompt:ave:production:v2'
    );
    assert(rollbackedEntry !== null, 'Rollback successfully restored a prior stable version.');
    assert(rollbackedEntry.status === 'ACTIVE', 'Restored prior version is now ACTIVE.');
    assert(rollbackedEntry.modelVersion === 'v1.0.0', 'Restored prior version is v1.0.0.');

    // Verify that v2.0.0-rc1 status in the registry table is now ROLLED_BACK
    const registry = await ModelRegistryService.getRegistry();
    const v2Entry = registry.find(r => r.modelVersion === 'v2.0.0-rc1');
    assert(v2Entry?.status === 'ROLLED_BACK', 'Failing agent version successfully marked as ROLLED_BACK.');

    // -------------------------------------------------------------------------
    // TEST 2: Cryptographic Decision Provenance
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Cryptographic Decision Provenance ---');
    
    const confidenceVector = {
      confidence: 95,
      quality: 98,
      completeness: 92,
      reliability: 94
    };

    // Using targetId defined at the top of runTests
    
    // Generate signed provenance record
    const provenance = await ProvenanceService.generateProvenance(
      targetId,
      'document',
      'FRAUD_RISK',
      ['AutonomousVerificationEngine', 'GovernmentIntelligenceEngine'],
      ['neon-database', 'solana-ledger'],
      ['evidence-ipfs-hash-value'],
      ['GCPX-AUTH-RULE-101'],
      confidenceVector,
      'v2.0.0-rc1',
      420,
      true // Anchor on chain simulation
    );

    assert(provenance !== null, 'Decision provenance record successfully created.');
    assert(provenance.signature !== null, 'Cryptographic signature generated.');
    assert(provenance.onchainTxSignature?.startsWith('sol-tx-'), 'On-chain cryptographic ledger anchor created.');

    // Verify integrity (non-repudiation)
    const isIntegrityValid = await ProvenanceService.verifyIntegrity(provenance.provenanceId);
    assert(isIntegrityValid === true, 'Provenance cryptographic verification confirms block integrity.');

    // -------------------------------------------------------------------------
    // TEST 3: Human-in-the-Loop (HITL) Override Logic
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Human-in-the-Loop (HITL) Override Queue ---');
    
    const hitlAction = await HitlService.createAction(
      tenantId,
      targetId,
      'document',
      { status: 'LOCKED' },
      { status: 'UNLOCKED' },
      'ADMIN'
    );

    assert(hitlAction !== null, 'HITL override action registered in the review queue.');
    assert(hitlAction.workflowStatus === 'PENDING_HUMAN_REVIEW', 'HITL action workflow status is correctly set to pending.');

    // Resolve review
    const reviewedAction = await HitlService.reviewAction(
      hitlAction.actionId,
      'OVERRIDDEN',
      'admin-ops-center',
      'Emergency override for legal timeline continuity.'
    );
    assert(reviewedAction.workflowStatus === 'OVERRIDDEN', 'HITL action resolved as OVERRIDDEN.');
    assert(reviewedAction.reviewedBy === 'admin-ops-center', 'Reviewing admin recorded correctly.');

    // Verify feedback was captured in the learning dataset
    const feedbackRecords = await basePrisma.feedbackLearningDataset.findMany({
      where: { sourceId: targetId }
    });
    assert(feedbackRecords.length > 0, 'Platform learning feedback dataset successfully generated from override.');

    // -------------------------------------------------------------------------
    // TEST 4: Continuous Evaluation Engine & Drift Checking
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Continuous Evaluation Engine & SLA breaches ---');
    
    // Seed some learning feedback samples so that runEvaluation doesn't just return baseline defaults
    for (let i = 0; i < 6; i++) {
      await PlatformLearningService.captureFeedback(
        tenantId,
        'AutonomousVerificationEngine',
        `test-feedback-eval-${i}-${Date.now()}`,
        {
          proposedState: { riskLevel: 'HIGH', decision: 'DENY', isLocked: true },
          inferenceTimeMs: 1100
        },
        { decision: 'DENY', actualOutcome: 'FRAUD' },
        'Valid model alignment'
      );
    }

    // Run dynamic evaluation loop
    const evalLog = await EvaluationEngineService.runEvaluation('AutonomousVerificationEngine');
    assert(evalLog !== null, 'Evaluation run logged successfully.');
    assert(evalLog.precision > 0, 'Continuous precision metric successfully computed.');
    assert(evalLog.driftScore >= 0, 'Dynamic population drift index calculated.');

    // Verify history retrieval
    const history = await EvaluationEngineService.getEvaluationHistory('AutonomousVerificationEngine', 10);
    assert(history.length > 0, 'Longitudinal evaluation history logs retrieved.');

    // -------------------------------------------------------------------------
    // TEST 5: AI Cost Intelligence Reporting
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: AI Cost Intelligence ---');
    
    // Log a test cost metric
    const loggedCost = await CostIntelligenceService.logCost(
      tenantId,
      'AutonomousVerificationEngine',
      targetId,
      1200, // prompt tokens
      800,  // completion tokens
      350,  // inference time ms
      55.2  // GPU utilization percentage
    );
    assert(loggedCost !== null, 'AI Cost metric successfully logged.');
    assert(loggedCost.estimatedCost > 0, 'Estimated cost calculated.');

    // Retrieve report
    const costSummary = await CostIntelligenceService.getCostSummary(tenantId);
    assert(costSummary !== null, 'Aggregated AI Cost intelligence summary report generated.');
    assert(costSummary.totalTokensConsumed === 2000, 'Total tokens aggregated correctly.');

    // -------------------------------------------------------------------------
    // TEST 6: Policy Simulation (What-If Analysis)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Policy Simulation (What-If Analysis) ---');
    
    // Create a mock PolicyEvaluationLog to represent historical accesses
    await basePrisma.policyEvaluationLog.create({
      data: {
        evaluationId: `sim-eval-log-${Date.now()}`,
        tenantId,
        userId: 'citizen-user-id',
        resourceId: 'test-resource-uuid',
        resourceType: 'document',
        action: 'document:write',
        decision: 'ALLOW',
        policyVersion: 'v1.0',
        matchingRules: [],
        deniedRules: [],
        evaluationTimeMs: 12
      }
    });

    const proposedRules = [
      {
        name: 'Simulated strict write restrictions',
        effect: 'DENY' as const,
        actions: ['document:write'],
        classifications: ['INTERNAL'],
        conditions: { requireOwner: true },
        isActive: true
      }
    ];

    const simReport = await PolicyAnalyzerService.analyzeImpact(tenantId, proposedRules);
    assert(simReport !== null, 'What-If policy simulation executed.');
    assert(simReport.totalEvaluated === 1, 'Simulation successfully evaluated baseline logs.');
    assert(simReport.deniedAccessDelta === 1, 'Denied access delta correctly projected write restrictions.');

    // Verify it was written to simulation logs
    const dbSim = await basePrisma.policySimulation.findFirst({
      where: { tenantId }
    });
    assert(dbSim !== null, 'Policy simulation logs persisted in neon database.');

    // -------------------------------------------------------------------------
    // TEST 7: Executive Briefing Synthesis
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Executive Briefing Synthesis ---');
    
    const briefing = await BriefingService.generateBriefing(tenantId, 'ON_DEMAND', 'test-operator');
    assert(briefing !== null, 'Executive briefing generated.');
    assert((briefing.briefingContent as any).indices.blockchainHealth === 100, 'Briefing indices generated correctly.');
    assert(briefing.scope === 'ON_DEMAND', 'Twin synchronization sync state tracked.');

    // -------------------------------------------------------------------------
    // TEST 8: Platform Capacity & Queue Forecasting
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: Platform Capacity & Queue Forecasting ---');
    
    const forecasts = await ForecastingService.getForecasts(tenantId);
    assert(forecasts.length > 0, 'Sovereign capacity forecasts computed.');
    const storageForecast = forecasts.find(f => f.metricName === 'STORAGE_EXHAUSTION');
    assert(storageForecast !== undefined, 'Infrastructure storage exhaustion forecast found.');
    const costForecast = forecasts.find(f => f.metricName === 'AI_COST_EXHAUSTION');
    assert(costForecast !== undefined, 'AI operational budget exhaustion forecast found.');

    // -------------------------------------------------------------------------
    // TEST 9: Playbook Mapping
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Automated Incident Playbooks ---');
    
    const playbook = PlaybookService.generatePlaybook('MODEL_DRIFT', 'HIGH');
    assert(playbook !== null, 'Incident response playbook mapped.');
    assert(playbook.remediationSteps.length > 0, 'Playbook contains actionable recovery steps.');

    // -------------------------------------------------------------------------
    // TEST 10: AVE Operational Metrics
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: AVE Operational Metrics ---');
    
    const aveMetrics = await AutonomousVerificationEngine.getGlobalMetrics();
    assert(aveMetrics !== null, 'Autonomous Verification Engine executed global metrics aggregation.');
    assert(aveMetrics.digitalTwinHealthScore !== undefined, 'Twin health score returned.');
    assert(aveMetrics.aiAgreementRate !== undefined, 'AI agreement rate returned.');

    // -------------------------------------------------------------------------
    // TEST 11: Twin Evolution Health
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: Digital Twin Evolution & Health ---');
    
    // Resolve/initialize twin via TwinEvolutionService
    const twin = await TwinEvolutionService.getTwin('PROPERTY', 'test-property-twin-id', tenantId);
    assert(twin !== null, 'Digital twin successfully initialized via TwinEvolutionService.');
    assert(twin.passportStatus === 'SYNCHRONIZED', 'Twin initialized with SYNCHRONIZED sync status.');

    // Recalculate/evolve twin
    const evolvedTwin = await TwinEvolutionService.recalculateTwin('PROPERTY', 'test-property-twin-id', tenantId);
    assert(evolvedTwin.version === 2, 'Twin evolved to version 2.');

    // Clean up all generated test data
    console.log('\nCleaning up all AGIP test data...');
    await basePrisma.feedbackLearningDataset.deleteMany({ where: { tenantId } });
    await basePrisma.decisionProvenance.deleteMany({ where: { targetId } });
    await basePrisma.hitlAction.deleteMany({ where: { tenantId } });
    await basePrisma.continuousEvaluationLog.deleteMany({ where: { agentName: 'AutonomousVerificationEngine' } });
    await basePrisma.aiCostMetric.deleteMany({ where: { tenantId } });
    await basePrisma.policyEvaluationLog.deleteMany({ where: { tenantId } });
    await basePrisma.policySimulation.deleteMany({ where: { tenantId } });
    await basePrisma.executiveBriefing.deleteMany({ where: { tenantId } });
    await basePrisma.digitalTwinHistory.deleteMany({ where: { targetId: 'test-property-twin-id' } });
    await basePrisma.digitalTwin.deleteMany({ where: { tenantId } });
    await basePrisma.aiModelRegistry.deleteMany({ where: { agentName: 'AutonomousVerificationEngine' } });
    await basePrisma.tenant.delete({ where: { tenantId } });
    
  } catch (err) {
    console.error('Test execution error encountered:', err);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`Autonomous Intelligence Test Run Finished: ${passed} Passed, ${failed} Failed.`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
