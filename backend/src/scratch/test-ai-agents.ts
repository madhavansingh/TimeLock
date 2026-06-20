import { prisma } from '../config/db';
import { DbUserRole } from '@prisma/client';
import { DocumentService } from '../services/document.service';
import { VplService } from '../services/vpl.service';
import { AiAssessmentService } from '../services/ai/ai-assessment.service';

async function runTest() {
  console.log('=== STARTING AI INTELLIGENCE LAYER E2E TEST ===');

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

  // 2. Register Document
  console.log('\nStep 1: Registering document (automatically triggers AI)...');
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

  // Run AI analysis synchronously for testing immediate result
  console.log('\nStep 2: Performing synchronous AI analysis...');
  const result = await AiAssessmentService.runAnalysis(doc.documentId, 'INITIAL_TRIGGER');
  
  // 3. Verify Database Persistence of AiAssessment
  console.log('\nStep 3: Checking AiAssessment database record...');
  const assessment = await prisma.aiAssessment.findUnique({
    where: { documentId: doc.documentId }
  });

  if (!assessment) {
    console.error('✗ FAIL: No AiAssessment record found in database.');
    process.exit(1);
  }

  console.log('✓ AiAssessment persisted successfully:');
  console.log(`  - Risk Score: ${assessment.riskScore} (Risk Level: ${assessment.riskLevel})`);
  console.log(`  - Trust Score: ${assessment.trustScore}`);
  console.log(`  - Explanation: ${assessment.trustExplanation}`);
  console.log(`  - Positive Factors: ${JSON.stringify(assessment.positiveFactors)}`);
  console.log(`  - Negative Factors: ${JSON.stringify(assessment.negativeFactors)}`);
  console.log(`  - Score Breakdown: ${JSON.stringify(assessment.scoreBreakdown)}`);
  console.log(`  - Recommendations: ${JSON.stringify(assessment.recommendations)}`);

  if (assessment.riskLevel !== 'MEDIUM' || assessment.trustScore !== 50) {
    console.error(`✗ FAIL: Expected riskLevel to be MEDIUM and trustScore to be 50. Found Level: ${assessment.riskLevel}, Trust Score: ${assessment.trustScore}`);
    process.exit(1);
  }
  console.log('✓ PASS: Baseline risk level and trust score are correct.');

  // 4. Upload Evidence (Triggers regeneration and saves history)
  console.log('\nStep 4: Uploading evidence (Tax Receipt) to case...');
  await VplService.addEvidence(doc.documentId, 'Tax Receipt', 'QmTaxReceiptIPFSHash997');
  
  // Execute synchronously for test assert
  await AiAssessmentService.runAnalysis(doc.documentId, 'EVIDENCE_CHANGED');

  // Verify History Log
  console.log('\nStep 5: Verifying AiAssessmentHistory log...');
  const history = await prisma.aiAssessmentHistory.findMany({
    where: { documentId: doc.documentId }
  });

  if (history.length < 1) {
    console.error(`✗ FAIL: Expected at least 1 history record, found ${history.length}`);
    process.exit(1);
  }
  
  const hist = history[history.length - 1];
  console.log(`✓ History record logged successfully:`);
  console.log(`  - Trigger Event: ${hist.triggerEvent} (Expected: EVIDENCE_CHANGED)`);
  console.log(`  - Prior Risk Score: ${hist.riskScore}`);
  console.log(`  - Prior Trust Score: ${hist.trustScore}`);

  if (hist.triggerEvent !== 'EVIDENCE_CHANGED') {
    console.error('✗ FAIL: Prior trigger event value is incorrect.');
    process.exit(1);
  }

  // Verify updated current score
  const updatedAssessment = await prisma.aiAssessment.findUnique({
    where: { documentId: doc.documentId }
  });

  console.log('Updated Current Assessment:');
  console.log(`  - Risk Score: ${updatedAssessment?.riskScore} (Level: ${updatedAssessment?.riskLevel})`);
  console.log(`  - Trust Score: ${updatedAssessment?.trustScore}`);
  
  if (updatedAssessment!.trustScore <= assessment.trustScore) {
    console.error(`✗ FAIL: Trust score should have increased. Old: ${assessment.trustScore}, New: ${updatedAssessment?.trustScore}`);
    process.exit(1);
  }
  console.log(`✓ PASS: Trust score increased successfully upon evidence addition (Old: ${assessment.trustScore} -> New: ${updatedAssessment?.trustScore})`);

  console.log('=== ALL AI INTELLIGENCE LAYER TESTS PASSED SUCCESSFULLY ===');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
