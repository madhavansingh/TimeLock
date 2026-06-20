import { prisma } from '../config/db';
import { DbUserRole } from '@prisma/client';
import { DocumentService } from '../services/document.service';
import { VplService } from '../services/vpl.service';
import { VerificationCopilotService } from '../services/ai/verification-copilot.service';

async function runTest() {
  console.log('=== STARTING AI VERIFICATION COPILOT E2E TEST ===');

  // 1. Resolve Seeded Users
  const raoNotaryUser = await prisma.user.findFirst({
    where: { notaryId: '688c6761-c8d3-4628-8792-87f62f8cb5a5' }
  });
  const citizenAUser = await prisma.user.findFirst({
    where: { role: DbUserRole.CITIZEN }
  });

  if (!raoNotaryUser || !citizenAUser) {
    console.error('Failed to resolve database users.');
    process.exit(1);
  }

  console.log(`Resolved Citizen A: ${citizenAUser.userId}`);
  console.log(`Resolved Notary: ${raoNotaryUser.userId} (Notary ID: ${raoNotaryUser.notaryId})`);

  // 2. Register Document (triggers AI lazy initialization hook)
  console.log('\nStep 1: Registering document...');
  const uniqueId = Date.now();
  const doc = await DocumentService.uploadAndRegister(
    citizenAUser.userId,
    `Deed Plot ${uniqueId}`,
    'Sale Deed',
    Buffer.from(`plot ${uniqueId} deed content for AI verification`),
    `plot_deed_${uniqueId}.pdf`,
    raoNotaryUser.notaryId!,
    1,
    `SV-${uniqueId}`,
    `PROP-${uniqueId}`,
    `REG-2026-P${uniqueId}`,
    'Priya Executant'
  );
  console.log(`✓ Document Registered: ID ${doc.documentId}`);

  // 3. Perform AI Copilot Run
  console.log('\nStep 2: Performing synchronous AI Copilot execution...');
  await VerificationCopilotService.runCopilot(doc.documentId, 'INITIAL_E2E_TRIGGER');
  console.log('✓ AI Copilot execution completed.');

  // 4. Assert Database Persistence for all 4 models
  console.log('\nStep 3: Checking AI Copilot records in database...');
  const [conflict, prediction, questions, recommendation] = await Promise.all([
    prisma.aiConflictAssessment.findUnique({ where: { documentId: doc.documentId } }),
    prisma.aiApprovalPrediction.findUnique({ where: { documentId: doc.documentId } }),
    prisma.aiCrossExamination.findUnique({ where: { documentId: doc.documentId } }),
    prisma.aiDecisionRecommendation.findUnique({ where: { documentId: doc.documentId } })
  ]);

  if (!conflict) {
    console.error('✗ FAIL: No AiConflictAssessment found.');
    process.exit(1);
  }
  console.log('✓ AiConflictAssessment persisted successfully:');
  console.log(`  - Conflict Score: ${conflict.conflictScore}`);
  console.log(`  - Conflict Level: ${conflict.conflictLevel}`);
  console.log(`  - Findings: ${JSON.stringify(conflict.findings)}`);
  console.log(`  - Recommendation: ${conflict.recommendation}`);

  if (!prediction) {
    console.error('✗ FAIL: No AiApprovalPrediction found.');
    process.exit(1);
  }
  console.log('✓ AiApprovalPrediction persisted successfully:');
  console.log(`  - Approval Probability: ${prediction.approvalProbability}%`);
  console.log(`  - Expected Review Days: ${prediction.expectedReviewDays}`);
  console.log(`  - Missing Evidence Risk: ${prediction.missingEvidenceRisk}`);
  console.log(`  - Blockers: ${JSON.stringify(prediction.blockers)}`);

  if (!questions) {
    console.error('✗ FAIL: No AiCrossExamination found.');
    process.exit(1);
  }
  console.log('✓ AiCrossExamination persisted successfully:');
  console.log(`  - Questions: ${JSON.stringify(questions.questions)}`);

  if (!recommendation) {
    console.error('✗ FAIL: No AiDecisionRecommendation found.');
    process.exit(1);
  }
  console.log('✓ AiDecisionRecommendation persisted successfully:');
  console.log(`  - Recommendation: ${recommendation.recommendation}`);
  console.log(`  - Rationale: ${JSON.stringify(recommendation.rationale)}`);

  // Verify baseline version is 1 for all models
  if (
    conflict.version !== 1 ||
    prediction.version !== 1 ||
    questions.version !== 1 ||
    recommendation.version !== 1
  ) {
    console.error(`✗ FAIL: Expected version 1 for all records, found: conflict=${conflict.version}, prediction=${prediction.version}, questions=${questions.version}, recommendation=${recommendation.version}`);
    process.exit(1);
  }
  console.log('✓ PASS: Baseline versions are all 1.');

  // 5. Trigger manual regeneration to test versioning and history logging
  console.log('\nStep 4: Triggering manual regeneration to check history and versioning...');
  await VerificationCopilotService.runCopilot(doc.documentId, 'MANUAL_REGEN_TEST');

  // Fetch updated records
  const [conflictV2, predictionV2, questionsV2, recommendationV2] = await Promise.all([
    prisma.aiConflictAssessment.findUnique({ where: { documentId: doc.documentId } }),
    prisma.aiApprovalPrediction.findUnique({ where: { documentId: doc.documentId } }),
    prisma.aiCrossExamination.findUnique({ where: { documentId: doc.documentId } }),
    prisma.aiDecisionRecommendation.findUnique({ where: { documentId: doc.documentId } })
  ]);

  if (
    conflictV2?.version !== 2 ||
    predictionV2?.version !== 2 ||
    questionsV2?.version !== 2 ||
    recommendationV2?.version !== 2
  ) {
    console.error(`✗ FAIL: Expected version 2 after regeneration, found: conflict=${conflictV2?.version}, prediction=${predictionV2?.version}, questions=${questionsV2?.version}, recommendation=${recommendationV2?.version}`);
    process.exit(1);
  }
  console.log('✓ PASS: Version numbers incremented to 2.');

  // Verify history logs exist
  console.log('\nStep 5: Verifying history archives...');
  const [conflictHist, predictionHist, questionsHist, recHist] = await Promise.all([
    prisma.aiConflictAssessmentHistory.findMany({ where: { documentId: doc.documentId } }),
    prisma.aiApprovalPredictionHistory.findMany({ where: { documentId: doc.documentId } }),
    prisma.aiCrossExaminationHistory.findMany({ where: { documentId: doc.documentId } }),
    prisma.aiDecisionRecommendationHistory.findMany({ where: { documentId: doc.documentId } })
  ]);

  if (
    conflictHist.length < 1 ||
    predictionHist.length < 1 ||
    questionsHist.length < 1 ||
    recHist.length < 1
  ) {
    console.error(`✗ FAIL: History records missing: conflictHist=${conflictHist.length}, predictionHist=${predictionHist.length}, questionsHist=${questionsHist.length}, recHist=${recHist.length}`);
    process.exit(1);
  }

  console.log(`✓ History logs verified successfully:`);
  console.log(`  - Conflict History Entry trigger: ${conflictHist[0].triggerEvent} (Version: ${conflictHist[0].version})`);
  console.log(`  - Prediction History Entry trigger: ${predictionHist[0].triggerEvent} (Version: ${predictionHist[0].version})`);
  console.log(`  - Questions History Entry trigger: ${questionsHist[0].triggerEvent} (Version: ${questionsHist[0].version})`);
  console.log(`  - Recommendation History Entry trigger: ${recHist[0].triggerEvent} (Version: ${recHist[0].version})`);

  console.log('\n=== ALL AI VERIFICATION COPILOT E2E TESTS PASSED ===');
}

runTest()
  .catch(err => {
    console.error('Test script crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
