import { prisma } from '../config/db';
import { DbUserRole, DbDocumentStatus, DbSignerRole } from '@prisma/client';
import { DocumentService } from '../services/document.service';
import { VplService } from '../services/vpl.service';

async function runTest() {
  console.log('=== STARTING VERIFICATION PROOF LAYER (VPL) WORKFLOW TEST ===');

  // 1. Resolve Seeded Users
  const raoNotaryUser = await prisma.user.findFirst({
    where: { notaryId: '688c6761-c8d3-4628-8792-87f62f8cb5a5' }
  });
  const citizenAUser = await prisma.user.findFirst({
    where: { role: DbUserRole.CITIZEN }
  });
  const citizenBUser = await prisma.user.findFirst({
    where: {
      role: DbUserRole.CITIZEN,
      userId: { not: citizenAUser?.userId }
    }
  });

  if (!raoNotaryUser || !citizenAUser || !citizenBUser) {
    const allUsers = await prisma.user.findMany();
    console.log('Database users found:', allUsers);
    console.error('Failed to resolve seeded users for test.');
    process.exit(1);
  }

  console.log(`Resolved Citizen A: ${citizenAUser.userId}`);
  console.log(`Resolved Citizen B: ${citizenBUser.userId}`);
  console.log(`Resolved Notary Rao: ${raoNotaryUser.userId} (Notary ID: ${raoNotaryUser.notaryId})`);

  // 2. Register Document 1 (Priya owns Plot 42 under Survey number SV-100)
  console.log('\nRegistering Document 1 (Citizen A, Survey SV-100, Property PROP-42)...');
  const doc1 = await DocumentService.uploadAndRegister(
    citizenAUser.userId,
    'Deed Priya Plot 42',
    'Sale Deed',
    Buffer.from('priya document content'),
    'priya_deed.pdf',
    raoNotaryUser.notaryId!,
    1,
    'SV-100',
    'PROP-42',
    'REG-2026-P42',
    'Priya Executant'
  );
  console.log(`✓ Document 1 Registered: ID ${doc1.documentId}`);

  // Retrieve case 1 (should have 0 conflicts since it is the first)
  const case1 = await prisma.verificationCase.findUnique({
    where: { documentId: doc1.documentId }
  });
  console.log(`✓ Case 1 Initialized: Status: ${case1?.status}, Trust Score: ${case1?.trustScore}`);

  // 3. Register Document 2 (Amit attempts to register Survey number SV-100)
  console.log('\nRegistering Document 2 with DUPLICATE Survey Number SV-100 (Citizen B)...');
  const doc2 = await DocumentService.uploadAndRegister(
    citizenBUser.userId,
    'Deed Amit Duplicate Plot 42',
    'Sale Deed',
    Buffer.from('amit duplicate content'),
    'amit_deed.pdf',
    raoNotaryUser.notaryId!,
    1,
    'SV-100',
    'PROP-43', // Unique Property ID
    'REG-2026-P43', // Unique Registration number
    'Amit Executant'
  );
  console.log(`✓ Document 2 Registered: ID ${doc2.documentId}`);

  // 4. Retrieve Case 2 and Verify Conflict Challenge is Created
  const case2 = await prisma.verificationCase.findUnique({
    where: { documentId: doc2.documentId },
    include: { evidence: true }
  });

  if (!case2) {
    console.error('✗ FAIL: VerificationCase for Document 2 was not created.');
    process.exit(1);
  }

  const challenges = case2.challenges as any[];
  console.log(`✓ Case 2 Challenges Count: ${challenges.length}`);
  console.log('Challenges details:');
  challenges.forEach(ch => console.log(`  - ID: ${ch.id}, Type: ${ch.type}, Resolved: ${ch.resolved}, Question: ${ch.question}`));

  const hasConflict = challenges.some(ch => ch.type === 'CONFLICT' && ch.id.includes('survey'));
  if (!hasConflict) {
    console.error('✗ FAIL: Conflict challenge for duplicate survey number SV-100 not generated!');
    process.exit(1);
  }
  console.log('✓ PASS: Duplicate survey number conflict challenge successfully generated.');

  console.log(`Case 2 Initial Trust Score: ${case2.trustScore}`);

  // 5. Upload Evidence to Resolve Missing Evidence Challenge
  console.log('\nUploading supporting evidence "Identity Proof"...');
  await VplService.addEvidence(doc2.documentId, 'Identity Proof', 'QmIdentityProofCIDHash123');

  let updatedCase2 = await prisma.verificationCase.findUnique({
    where: { caseId: case2.caseId }
  });
  let updatedChallenges = updatedCase2?.challenges as any[];
  const identityChallenge = updatedChallenges.find(ch => ch.field === 'Identity Proof');
  
  if (!identityChallenge || !identityChallenge.resolved) {
    console.error('✗ FAIL: Identity Proof challenge was not marked resolved!');
    process.exit(1);
  }
  console.log(`✓ PASS: Identity Proof challenge resolved. Current Trust Score: ${updatedCase2?.trustScore}`);

  // 6. Submit Notary Justification to Resolve Duplicate Conflict Challenge
  console.log('\nSubmitting notary justification for duplicate survey conflict...');
  const surveyChallenge = updatedChallenges.find(ch => ch.type === 'CONFLICT' && ch.id.includes('survey'));
  
  await VplService.resolveChallenge(
    doc2.documentId,
    surveyChallenge.id,
    'Verified via local sub-registrar archives. Citizen B holds clean historical partition.'
  );

  updatedCase2 = await prisma.verificationCase.findUnique({
    where: { caseId: case2.caseId }
  });
  updatedChallenges = updatedCase2?.challenges as any[];
  const surveyChallengeResolved = updatedChallenges.find(ch => ch.id === surveyChallenge.id);

  if (!surveyChallengeResolved || !surveyChallengeResolved.resolved) {
    console.error('✗ FAIL: Survey number conflict challenge was not marked resolved!');
    process.exit(1);
  }
  console.log(`✓ PASS: Survey conflict challenge resolved. Current Trust Score: ${updatedCase2?.trustScore}`);

  // 7. Verify Checklist Verification Flow
  console.log('\nUpdating case checklist to all PASSED...');
  const checklist = updatedCase2?.checklist as any[];
  const passedChecklist = checklist.map(item => ({ ...item, status: 'PASSED' }));

  await VplService.updateChecklist(doc2.documentId, passedChecklist);

  updatedCase2 = await prisma.verificationCase.findUnique({
    where: { caseId: case2.caseId }
  });
  
  console.log(`✓ PASS: Checklist compliance updated. Final trust score before sign: ${updatedCase2?.trustScore}`);

  // Make sure other mandatory evidence types are uploaded to allow anchoring
  console.log('\nUploading remaining mandatory evidence (Prior Title Deed, Tax Receipt)...');
  await VplService.addEvidence(doc2.documentId, 'Prior Title Deed', 'QmPriorTitleDeedCIDHash');
  await VplService.addEvidence(doc2.documentId, 'Tax Receipt', 'QmTaxReceiptCIDHash');

  // 8. Anchor Verification Case to Solana
  console.log('\nAnchoring VPL Case to Solana...');
  const anchoredCase = await VplService.anchorVerificationProof(doc2.documentId, raoNotaryUser.userId);
  console.log(`✓ VPL Case Anchored! Status: ${anchoredCase.status}`);
  console.log(`  - VPL On-Chain TX Signature: ${anchoredCase.vplOnchainTx}`);
  console.log(`  - VPL Proof Record Hash (SHA-256): ${anchoredCase.vplProofHash}`);

  // Assert Document status is NOTARY_SIGNED or FULLY_EXECUTED
  const finalDoc2 = await prisma.document.findUnique({
    where: { documentId: doc2.documentId },
    include: { verificationEvents: true }
  });

  console.log(`✓ Final Document Status: ${finalDoc2?.status}`);
  if (finalDoc2?.status !== DbDocumentStatus.FULLY_EXECUTED && finalDoc2?.status !== DbDocumentStatus.NOTARY_SIGNED) {
    console.error(`✗ FAIL: Document status is ${finalDoc2?.status}, expected NOTARY_SIGNED or FULLY_EXECUTED.`);
    process.exit(1);
  }

  const hasNotarySignedEvent = finalDoc2.verificationEvents.some(e => e.eventType === 'NOTARY_SIGNED');
  if (!hasNotarySignedEvent) {
    console.error('✗ FAIL: VerificationEvent timeline does not contain NOTARY_SIGNED event!');
    process.exit(1);
  }

  console.log('✓ PASS: Document status updated and verification events generated successfully.');

  console.log('\n=== ALL VERIFICATION PROOF LAYER WORKFLOW TESTS PASSED ===');
  process.exit(0);
}

runTest()
  .catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
