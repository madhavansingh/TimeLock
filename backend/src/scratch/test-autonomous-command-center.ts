import { prisma } from '../config/db';
import { DbUserRole } from '@prisma/client';
import { DocumentService } from '../services/document.service';
import { VerificationCommandCenterService } from '../services/ai/verification-command-center.service';

async function runTest() {
  const startTime = Date.now();
  console.log("TEST INITIALIZING");

  let citizenUserId = "";
  let notaryUserId = "";
  let notaryId = "";
  let documentId = "";
  let propertyId = "";
  let docNodeId = "";
  let propNodeId = "";
  let riskAssessmentId = "";
  let chainAssessmentId = "";
  let nationalRatingId = "";

  // ==========================================
  // STEP 1: USER RESOLUTION
  // ==========================================
  console.log("STEP 1 START");
  try {
    const notaryUser = await prisma.user.findFirst({
      where: { notaryId: { not: null } }
    });
    const citizenUser = await prisma.user.findFirst({
      where: { role: DbUserRole.CITIZEN }
    });

    if (!notaryUser || !citizenUser) {
      throw new Error("Seeded users could not be resolved from database.");
    }
    citizenUserId = citizenUser.userId;
    notaryUserId = notaryUser.userId;
    notaryId = notaryUser.notaryId!;
    console.log("STEP 1 COMPLETE");
  } catch (err: any) {
    console.log("STEP 1 FAIL");
    console.log(`Failure Reason: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
    console.log(`Execution Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }

  // ==========================================
  // STEP 2: DOCUMENT REGISTRATION
  // ==========================================
  console.log("STEP 2 START");
  try {
    const uniqueId = Date.now();
    propertyId = `PROP-${uniqueId}`;
    const surveyNumber = `SV-${uniqueId}`;

    const doc = await DocumentService.uploadAndRegister(
      citizenUserId,
      `Registry Deed Plot ${uniqueId}`,
      'Sale Deed',
      Buffer.from(`plot deed registry details for ${uniqueId}`),
      `deed_${uniqueId}.pdf`,
      notaryId,
      1,
      surveyNumber,
      propertyId,
      `REG-2026-N${uniqueId}`,
      'Priya Executant'
    );
    documentId = doc.documentId;
    console.log("STEP 2 COMPLETE");
  } catch (err: any) {
    console.log("STEP 2 FAIL");
    console.log(`Failure Reason: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
    console.log(`Execution Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }

  // ==========================================
  // STEP 3: PRIOR OWNERSHIP SIMULATION
  // ==========================================
  console.log("STEP 3 START");
  try {
    const ownRec = await prisma.ownershipRecord.create({
      data: {
        documentId: documentId,
        ownerUserId: citizenUserId,
        startDate: new Date(),
        status: 'ACTIVE',
        transferReason: 'Initial Registration'
      }
    });
    console.log("STEP 3 COMPLETE");
  } catch (err: any) {
    console.log("STEP 3 FAIL");
    console.log(`Failure Reason: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
    console.log(`Execution Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }

  // ==========================================
  // STEP 4: VCC ORCHESTRATION PIPELINE
  // ==========================================
  console.log("STEP 4 START");
  try {
    const result = await VerificationCommandCenterService.orchestrate(propertyId);
    console.log("STEP 4 COMPLETE");
  } catch (err: any) {
    console.log("STEP 4 FAIL");
    console.log(`Failure Reason: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
    console.log(`Execution Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }

  // ==========================================
  // STEP 5: TRUST GRAPH PERSISTENCE VERIFICATION
  // ==========================================
  console.log("STEP 5 START");
  try {
    const docNode = await prisma.trustGraphNode.findUnique({
      where: { entityType_entityId: { entityType: 'DOCUMENT', entityId: documentId } }
    });
    const propNode = await prisma.trustGraphNode.findUnique({
      where: { entityType_entityId: { entityType: 'PROPERTY', entityId: propertyId } }
    });

    if (!docNode || !propNode) {
      throw new Error(`Expected Document and Property nodes in graph. Found docNode: ${!!docNode}, propNode: ${!!propNode}`);
    }
    docNodeId = docNode.nodeId;
    propNodeId = propNode.nodeId;

    const edges = await prisma.trustGraphEdge.findMany({
      where: { sourceNodeId: docNodeId, targetNodeId: propNodeId }
    });

    if (edges.length === 0) {
      throw new Error('Expected REGISTERED_TO edge linking Document node to Property node.');
    }
    console.log("STEP 5 COMPLETE");
  } catch (err: any) {
    console.log("STEP 5 FAIL");
    console.log(`Failure Reason: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
    console.log(`Execution Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }

  // ==========================================
  // STEP 6: AGENT SCORES AND RATING PERSISTENCE VERIFICATION
  // ==========================================
  console.log("STEP 6 START");
  try {
    const riskAssessment = await prisma.entityRiskAssessment.findUnique({
      where: { entityType_entityId: { entityType: 'PROPERTY', entityId: propertyId } }
    });

    if (!riskAssessment) {
      throw new Error('No EntityRiskAssessment created for Property.');
    }
    riskAssessmentId = riskAssessment.assessmentId;

    const chainAssessment = await prisma.chainIntegrityAssessment.findUnique({
      where: { propertyId }
    });

    if (!chainAssessment) {
      throw new Error('No ChainIntegrityAssessment found for property.');
    }
    chainAssessmentId = chainAssessment.assessmentId;

    const nationalRating = await prisma.nationalTrustRating.findUnique({
      where: { propertyId }
    });

    if (!nationalRating) {
      throw new Error('No NationalTrustRating found for property.');
    }
    nationalRatingId = nationalRating.ratingId;

    if (!nationalRating.trustReportHash || !nationalRating.trustReportTxSignature) {
      throw new Error('Blockchain anchor hash or tx signature missing.');
    }
    console.log("STEP 6 COMPLETE");
  } catch (err: any) {
    console.log("STEP 6 FAIL");
    console.log(`Failure Reason: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
    console.log(`Execution Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }

  // ==========================================
  // STEP 7: VERSION HISTORY VERIFICATION
  // ==========================================
  console.log("STEP 7 START");
  try {
    await VerificationCommandCenterService.orchestrate(propertyId);

    const nodeHist = await prisma.trustGraphNodeHistory.findMany({ where: { nodeId: docNodeId } });
    const riskHist = await prisma.entityRiskAssessmentHistory.findMany({ where: { assessmentId: riskAssessmentId } });
    const chainHist = await prisma.chainIntegrityAssessmentHistory.findMany({ where: { assessmentId: chainAssessmentId } });
    const ratingHist = await prisma.nationalTrustRatingHistory.findMany({ where: { ratingId: nationalRatingId } });

    if (nodeHist.length < 1 || riskHist.length < 1 || chainHist.length < 1 || ratingHist.length < 1) {
      throw new Error(`History records missing. nodeHist=${nodeHist.length}, riskHist=${riskHist.length}, chainHist=${chainHist.length}, ratingHist=${ratingHist.length}`);
    }
    console.log("STEP 7 COMPLETE");
  } catch (err: any) {
    console.log("STEP 7 FAIL");
    console.log(`Failure Reason: ${err.message}`);
    console.log(`Stack Trace: ${err.stack}`);
    console.log(`Execution Duration: ${Date.now() - startTime}ms`);
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  console.log("\n=== EXECUTION SUMMARY ===");
  console.log("STEP 1 PASS");
  console.log("STEP 2 PASS");
  console.log("STEP 3 PASS");
  console.log("STEP 4 PASS");
  console.log("STEP 5 PASS");
  console.log("STEP 6 PASS");
  console.log("STEP 7 PASS");
  console.log(`Execution Duration: ${duration}ms`);
  process.exit(0);
}

runTest()
  .catch(err => {
    console.error('Test script crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
