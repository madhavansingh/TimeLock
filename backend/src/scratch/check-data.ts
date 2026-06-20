import { prisma } from '../config/db';

async function checkData() {
  console.log('=== DATABASE STATE CHECK ===');
  const documents = await prisma.document.findMany({
    include: {
      metadata: true,
      verificationCase: {
        include: {
          evidence: true
        }
      },
      aiConflictAssessment: true,
      aiApprovalPrediction: true,
      aiDecisionRecommendation: true,
      evidenceRecommendations: true
    }
  });

  console.log(`Found ${documents.length} documents in the database.`);
  for (const doc of documents) {
    console.log(`\nDocument: ${doc.title} (${doc.documentId})`);
    console.log(`  Status: ${doc.status}`);
    if (doc.metadata) {
      console.log(`  Metadata: Survey=${doc.metadata.surveyNumber}, PropertyID=${doc.metadata.propertyId}, RegNum=${doc.metadata.registrationNumber}`);
    }
    if (doc.verificationCase) {
      const vc = doc.verificationCase;
      console.log(`  Verification Case: Status=${vc.status}, TrustScore=${vc.trustScore}`);
      console.log(`    Checklist (${(vc.checklist as any[]).length}):`);
      (vc.checklist as any[]).forEach(item => {
        console.log(`      - ${item.id} (${item.label}): ${item.status}`);
      });
      console.log(`    Challenges (${(vc.challenges as any[]).length}):`);
      (vc.challenges as any[]).forEach(ch => {
        console.log(`      - ${ch.id} (${ch.type}): Resolved=${ch.resolved}, Field=${ch.field}`);
      });
    }
    console.log(`  AI Conflict: Score=${doc.aiConflictAssessment?.conflictScore}, Level=${doc.aiConflictAssessment?.conflictLevel}`);
    console.log(`  AI Prediction: Prob=${doc.aiApprovalPrediction?.approvalProbability}%`);
    console.log(`  AI Decision: Rec=${doc.aiDecisionRecommendation?.recommendation}`);
    console.log(`  Evidence Recommendations Count: ${doc.evidenceRecommendations.length}`);
  }
}

checkData()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
