import { prisma } from '../config/db';
import { DbUserRole, DbDocumentStatus, DbSignerRole } from '@prisma/client';
import { DocumentService } from '../services/document.service';
import { VplService } from '../services/vpl.service';
import { NotaryController } from '../controllers/notary.controller';
import { DocumentController } from '../controllers/document.controller';

async function runTest() {
  console.log('=== STARTING PREMIUM NOTARY OPERATIONS Lifecycle TEST ===');

  // 1. Resolve Seeded Users
  const raoNotaryUser = await prisma.user.findFirst({
    where: { notaryId: '688c6761-c8d3-4628-8792-87f62f8cb5a5' },
    include: { notary: true }
  });
  const citizenAUser = await prisma.user.findFirst({
    where: { role: DbUserRole.CITIZEN }
  });

  if (!raoNotaryUser || !citizenAUser) {
    console.error('Failed to resolve seeded users for test.');
    process.exit(1);
  }

  const notaryId = raoNotaryUser.notaryId!;
  console.log(`Resolved Citizen: ${citizenAUser.userId}`);
  console.log(`Resolved Notary: ${raoNotaryUser.userId} (Notary ID: ${notaryId})`);

  // 2. Register Document
  const uniqueReg = `REG-${Date.now()}`;
  console.log(`\nRegistering deed with survey SV-200 and registration number ${uniqueReg}...`);
  const doc = await DocumentService.uploadAndRegister(
    citizenAUser.userId,
    `Deed test notary operations ${Date.now()}`,
    'Sale Deed',
    Buffer.from('notary operations content'),
    'deed_ops.pdf',
    notaryId,
    1,
    'SV-200',
    'PROP-200',
    uniqueReg,
    'Deed Executant'
  );
  const documentId = doc.documentId;
  console.log(`✓ Document Registered: ID ${documentId}, status: ${doc.status}`);
  if (doc.status !== DbDocumentStatus.ONCHAIN_CONFIRMED) {
    console.error(`✗ FAIL: Expected status ONCHAIN_CONFIRMED, got ${doc.status}`);
    process.exit(1);
  }

  // Helper mock request object generator
  const makeMockReq = (userId: string, role: DbUserRole) => ({
    user: { userId, role },
    headers: {},
    params: { id: documentId }
  } as any);

  const makeMockRes = () => {
    const res: any = {};
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body: any) => {
      res.body = body;
      return res;
    };
    return res;
  };

  // 3. Verify analytics before starting review
  console.log('\nChecking analytics before review starts...');
  const resAnalytics1 = makeMockRes();
  await NotaryController.getAnalytics(makeMockReq(raoNotaryUser.userId, DbUserRole.NOTARY), resAnalytics1, (err) => { if (err) throw err; });
  console.log('Analytics response status:', resAnalytics1.statusCode);
  const dataAnalytics1 = resAnalytics1.body.data;
  console.log('Analytics data:', dataAnalytics1);
  if (!dataAnalytics1 || dataAnalytics1.documentsAssigned < 1) {
    console.error('✗ FAIL: Assigned documents count not matching.');
    process.exit(1);
  }
  console.log('✓ PASS: Analytics retrieved successfully before review.');

  // 4. Mark document under review
  console.log('\nMarking document Under Review (startReview)...');
  const resReview = makeMockRes();
  await DocumentController.startReview(makeMockReq(raoNotaryUser.userId, DbUserRole.NOTARY), resReview, (err) => { if (err) throw err; });
  
  const updatedDoc1 = await prisma.document.findUnique({ where: { documentId } });
  console.log(`✓ Document status after startReview: ${updatedDoc1?.status}`);
  if (updatedDoc1?.status !== DbDocumentStatus.NOTARY_REVIEW_STARTED) {
    console.error(`✗ FAIL: Expected status NOTARY_REVIEW_STARTED, got ${updatedDoc1?.status}`);
    process.exit(1);
  }
  console.log('✓ PASS: Document correctly marked under review.');

  // 5. Request additional evidence challenge
  console.log('\nRequesting additional evidence "Tax Receipt 2026"...');
  const reqEvidence = makeMockReq(raoNotaryUser.userId, DbUserRole.NOTARY);
  reqEvidence.body = { title: 'Tax Receipt 2026' };
  const resEvidence = makeMockRes();
  await DocumentController.requestAdditionalEvidence(reqEvidence, resEvidence, (err) => { if (err) throw err; });
  
  const vCase = await prisma.verificationCase.findUnique({ where: { documentId } });
  const challenges = vCase?.challenges as any[];
  const hasExtraEvidence = challenges.some(ch => ch.field === 'Tax Receipt 2026' && ch.type === 'MISSING_EVIDENCE');
  if (!hasExtraEvidence) {
    console.error('✗ FAIL: Extra evidence request was not appended to challenges.');
    process.exit(1);
  }
  console.log('✓ PASS: Extra evidence request successfully registered.');

  // 6. Approve for Signature
  console.log('\nApproving document for signature (approveForSignature)...');
  const resApprove = makeMockRes();
  await DocumentController.approveForSignature(makeMockReq(raoNotaryUser.userId, DbUserRole.NOTARY), resApprove, (err) => { if (err) throw err; });
  
  const updatedDoc2 = await prisma.document.findUnique({ where: { documentId } });
  console.log(`✓ Document status after approveForSignature: ${updatedDoc2?.status}`);
  if (updatedDoc2?.status !== DbDocumentStatus.READY_FOR_SIGNATURE) {
    console.error(`✗ FAIL: Expected status READY_FOR_SIGNATURE, got ${updatedDoc2?.status}`);
    process.exit(1);
  }
  console.log('✓ PASS: Document status updated to READY_FOR_SIGNATURE.');

  // 7. Resolve all challenges and checklist items to prepare for DSC Signature anchoring
  console.log('\nResolving all challenges and checklist items for signing...');
  // Upload all evidence including the new one
  await VplService.addEvidence(documentId, 'Identity Proof', 'QmId1');
  await VplService.addEvidence(documentId, 'Prior Title Deed', 'QmPriorDeed1');
  await VplService.addEvidence(documentId, 'Tax Receipt', 'QmTax1');
  await VplService.addEvidence(documentId, 'Tax Receipt 2026', 'QmTax2');

  const refreshedCase = await prisma.verificationCase.findUnique({ where: { documentId } });
  const passedChecklist = (refreshedCase?.checklist as any[]).map(item => ({ ...item, status: 'PASSED' }));
  await VplService.updateChecklist(documentId, passedChecklist);

  // 8. Apply DSC Signature (anchor proof to Solana)
  console.log('\nApplying DSC signature (anchor VPL)...');
  const resAnchor = makeMockRes();
  await DocumentController.anchorVerification(makeMockReq(raoNotaryUser.userId, DbUserRole.NOTARY), resAnchor, (err) => { if (err) throw err; });
  console.log('Anchor response status:', resAnchor.statusCode);

  const finalDoc = await prisma.document.findUnique({ where: { documentId } });
  console.log(`✓ Final document status: ${finalDoc?.status}`);
  if (finalDoc?.status !== DbDocumentStatus.FULLY_EXECUTED && finalDoc?.status !== DbDocumentStatus.NOTARY_SIGNED) {
    console.error(`✗ FAIL: Expected signed/executed status, got ${finalDoc?.status}`);
    process.exit(1);
  }
  console.log('✓ PASS: DSC signature applied and anchored successfully.');

  // 9. Fetch Archive and confirm document is returned
  console.log('\nChecking GET /notaries/archive...');
  const resArchive = makeMockRes();
  await NotaryController.getArchive(makeMockReq(raoNotaryUser.userId, DbUserRole.NOTARY), resArchive, (err) => { if (err) throw err; });
  const archiveDocs = resArchive.body.data;
  console.log(`✓ Archive documents returned: ${archiveDocs.length}`);
  const foundInArchive = archiveDocs.some((d: any) => d.documentId === documentId);
  if (!foundInArchive) {
    console.error('✗ FAIL: Newly signed document not found in completed archive.');
    process.exit(1);
  }
  console.log('✓ PASS: Document returned in SQL-backed Completed Archive.');

  // 10. Check final analytics
  console.log('\nChecking final analytics stats...');
  const resAnalytics2 = makeMockRes();
  await NotaryController.getAnalytics(makeMockReq(raoNotaryUser.userId, DbUserRole.NOTARY), resAnalytics2, (err) => { if (err) throw err; });
  const dataAnalytics2 = resAnalytics2.body.data;
  console.log('Final Analytics:', dataAnalytics2);
  if (!dataAnalytics2 || dataAnalytics2.documentsSigned < 1) {
    console.error('✗ FAIL: Analytics signature counts not updated.');
    process.exit(1);
  }
  console.log('✓ PASS: Analytics correctly calculated signatures directly from DB.');

  console.log('\n=== ALL NOTARY OPERATIONS LIFECYCLE TESTS PASSED ===');
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
