import { prisma } from '../config/db';
import { DbUserRole, DbDocumentStatus } from '@prisma/client';
import { DocumentService } from '../services/document.service';
import { TransferService } from '../services/transfer.service';

async function runTest() {
  console.log('=== STARTING OWNERSHIP LIFE CYCLE & CHAIN OF TITLE REGISTRY E2E TEST ===');

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
  let adminUser = await prisma.user.findFirst({
    where: { role: DbUserRole.ADMIN }
  });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        role: DbUserRole.ADMIN,
        emailHash: 'admin-email-hash-placeholder',
        phoneHash: 'admin-phone-hash-placeholder'
      }
    });
  }

  if (!raoNotaryUser || !citizenAUser || !citizenBUser || !adminUser) {
    console.error('Failed to resolve database users.');
    process.exit(1);
  }

  console.log(`Resolved Seller (Citizen A): ${citizenAUser.userId}`);
  console.log(`Resolved Buyer (Citizen B): ${citizenBUser.userId}`);
  console.log(`Resolved Notary: ${raoNotaryUser.userId} (Notary ID: ${raoNotaryUser.notaryId})`);
  console.log(`Resolved Government Registry Officer: ${adminUser.userId}`);

  // 2. Register Document 1 (Priya owns Plot 42 under Survey number SV-200)
  console.log('\nStep 1: Registering Document under Citizen A...');
  const doc = await DocumentService.uploadAndRegister(
    citizenAUser.userId,
    'Deed Priya Plot 105',
    'Sale Deed',
    Buffer.from('priya plot 105 deed content'),
    'priya_deed_105.pdf',
    raoNotaryUser.notaryId!,
    1,
    'SV-200',
    'PROP-105',
    'REG-2026-P105',
    'Priya Executant'
  );
  console.log(`✓ Document Registered: ID ${doc.documentId}`);

  // 3. Assert initial OwnershipRecord is created
  console.log('\nStep 2: Checking initial Ownership Record...');
  const initialRecords = await prisma.ownershipRecord.findMany({
    where: { documentId: doc.documentId }
  });

  if (initialRecords.length !== 1) {
    console.error(`✗ FAIL: Expected 1 initial OwnershipRecord, found ${initialRecords.length}`);
    process.exit(1);
  }

  const initialRecord = initialRecords[0];
  console.log('✓ Initial OwnershipRecord details:');
  console.log(`  - Record ID: ${initialRecord.recordId}`);
  console.log(`  - Owner: ${initialRecord.ownerUserId} (Expected: ${citizenAUser.userId})`);
  console.log(`  - Status: ${initialRecord.status} (Expected: ACTIVE)`);
  console.log(`  - Reason: ${initialRecord.transferReason} (Expected: Initial Registration)`);

  if (initialRecord.ownerUserId !== citizenAUser.userId || initialRecord.status !== 'ACTIVE') {
    console.error('✗ FAIL: Initial OwnershipRecord values are incorrect.');
    process.exit(1);
  }
  console.log('✓ PASS: Initial ownership record is correct.');

  // 4. Initiate Ownership Transfer (Citizen A to Citizen B)
  console.log('\nStep 3: Initiating ownership transfer request...');
  const supportingDocs = [{ title: 'Sale Agreement', ipfsCid: 'QmSaleAgreementEvidenceHash' }];
  const transfer = await TransferService.initiateTransfer(
    citizenAUser.userId,
    doc.documentId,
    citizenBUser.userId,
    'Sale',
    'Transferring deed to B on full payment receipt',
    supportingDocs
  );
  console.log(`✓ Transfer session initialized: Session ID: ${transfer.transferId}`);

  // 5. Collect Approvals (Seller, Buyer, Notary)
  console.log('\nStep 4: Approving transfer request...');
  
  console.log('Approving as Seller (OWNER)...');
  await TransferService.approveTransfer(
    citizenAUser.userId,
    transfer.transferId,
    'OWNER',
    '5h3K1111111111111111111111111111111111111111',
    'seller_signature_hash'
  );

  console.log('Approving as Buyer (BUYER)...');
  await TransferService.approveTransfer(
    citizenBUser.userId,
    transfer.transferId,
    'BUYER',
    '5h3K2222222222222222222222222222222222222222',
    'buyer_signature_hash'
  );

  console.log('Approving as Notary (NOTARY)...');
  await TransferService.approveTransfer(
    raoNotaryUser.userId,
    transfer.transferId,
    'NOTARY',
    '5h3K3333333333333333333333333333333333333333',
    'notary_signature_hash'
  );

  console.log('✓ All base approvals collected.');

  // 6. Finalize Transfer (Government)
  console.log('\nStep 5: Finalizing transfer request as Government Officer...');
  const finalizeRes = await TransferService.finalizeTransfer(
    adminUser.userId,
    transfer.transferId
  );
  console.log('✓ Transfer finalized. Database registry updated.');

  // 7. Verify Ownership Records transitions
  console.log('\nStep 6: Verifying registry transitions...');
  const finalRecords = await prisma.ownershipRecord.findMany({
    where: { documentId: doc.documentId },
    orderBy: { startDate: 'asc' }
  });

  if (finalRecords.length !== 2) {
    console.error(`✗ FAIL: Expected exactly 2 OwnershipRecords (1 historical, 1 active), found ${finalRecords.length}`);
    process.exit(1);
  }

  const [rec1, rec2] = finalRecords;
  
  console.log('Record 1 (Historical) check:');
  console.log(`  - Owner: ${rec1.ownerUserId}`);
  console.log(`  - Status: ${rec1.status} (Expected: HISTORICAL)`);
  console.log(`  - End Date: ${rec1.endDate ? rec1.endDate.toISOString() : 'null'}`);

  console.log('Record 2 (Active) check:');
  console.log(`  - Owner: ${rec2.ownerUserId} (Expected: ${citizenBUser.userId})`);
  console.log(`  - Status: ${rec2.status} (Expected: ACTIVE)`);
  console.log(`  - Previous Owner: ${rec2.previousOwnerId} (Expected: ${citizenAUser.userId})`);

  if (rec1.status !== 'HISTORICAL' || !rec1.endDate || rec2.status !== 'ACTIVE' || rec2.ownerUserId !== citizenBUser.userId) {
    console.error('✗ FAIL: Ownership record status transitions are incorrect.');
    process.exit(1);
  }
  console.log('✓ PASS: Ownership record state transitions succeeded.');

  // 8. Assert Chain of Title Reconstructs A -> B correctly
  console.log('\nStep 7: Verifying Chain of Title chronological order...');
  const updatedDoc = await prisma.document.findUnique({
    where: { documentId: doc.documentId }
  });

  if (updatedDoc?.ownerUserId !== citizenBUser.userId) {
    console.error(`✗ FAIL: Document ownerUserId is ${updatedDoc?.ownerUserId}, expected ${citizenBUser.userId}`);
    process.exit(1);
  }

  if (updatedDoc?.status !== DbDocumentStatus.FULLY_EXECUTED) {
    console.error(`✗ FAIL: Document status is ${updatedDoc?.status}, expected FULLY_EXECUTED`);
    process.exit(1);
  }

  console.log(`✓ PASS: Document owner is now Citizen B (${citizenBUser.userId}) and document is FULLY_EXECUTED.`);
  console.log('=== ALL OWNERSHIP LIFECYCLE TESTS COMPLETED SUCCESSFULY ===');
  process.exit(0);
}

runTest()
  .catch((err) => {
    console.error('Test crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
