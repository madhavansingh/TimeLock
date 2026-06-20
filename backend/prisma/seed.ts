import { PrismaClient, DbUserRole } from '@prisma/client';
import * as crypto from 'crypto';
import nacl from 'tweetnacl';

const prisma = new PrismaClient();

function getHash(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

async function main() {
  console.log('[SEED] Starting database seeding...');

  // Clean existing tables
  await prisma.evidence.deleteMany();
  await prisma.verificationCase.deleteMany();
  await prisma.documentMetadata.deleteMany();
  await prisma.ipfsReference.deleteMany();
  await prisma.fraudScore.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.verificationEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.notary.deleteMany();
  await prisma.user.deleteMany();

  console.log('[SEED] Cleared existing data.');

  // Notary Record with real derived Ed25519 public key (Rao)
  const notaryId = '688c6761-c8d3-4628-8792-87f62f8cb5a5';
  const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY || 'ltn_master_enc_key_2026_kleos_super_secure';
  const seedBytes = crypto.createHash('sha256').update(notaryId + MASTER_KEY).digest();
  const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(seedBytes));
  const derivedPublicKeyBase64 = Buffer.from(keypair.publicKey).toString('base64');

  const notary = await prisma.notary.create({
    data: {
      notaryId,
      name: 'Advocate Rao',
      dscCertificateSerial: 'CA-3-889a2bc1',
      publicKey: derivedPublicKeyBase64,
      certStatus: 'active',
      isAccredited: true,
    },
  });

  // Notary Record with real derived Ed25519 public key (Sharma)
  const sharmaNotaryId = '9c43e49e-7117-48f8-80e9-b593ef2d7efd';
  const sharmaSeedBytes = crypto.createHash('sha256').update(sharmaNotaryId + MASTER_KEY).digest();
  const sharmaKeypair = nacl.sign.keyPair.fromSeed(new Uint8Array(sharmaSeedBytes));
  const sharmaPublicKeyBase64 = Buffer.from(sharmaKeypair.publicKey).toString('base64');

  const sharmaNotary = await prisma.notary.create({
    data: {
      notaryId: sharmaNotaryId,
      name: 'Advocate Sharma',
      dscCertificateSerial: 'CA-3-999b3cd2',
      publicKey: sharmaPublicKeyBase64,
      certStatus: 'active',
      isAccredited: true,
    },
  });

  console.log(`[SEED] Created Notaries: ${notary.name}, ${sharmaNotary.name}`);

  // Citizen A
  const citizenEmail = 'priya.executant@ltn.demo';
  const citizenUser = await prisma.user.create({
    data: {
      role: DbUserRole.CITIZEN,
      emailHash: getHash(citizenEmail),
      phoneHash: '',
    },
  });

  // Citizen B
  const citizenBEmail = 'amit.executant@ltn.demo';
  const citizenBUser = await prisma.user.create({
    data: {
      role: DbUserRole.CITIZEN,
      emailHash: getHash(citizenBEmail),
      phoneHash: '',
    },
  });

  // Notary User 1 (Rao)
  const notaryEmail = 'rao.notary@ltn.demo';
  const notaryUser = await prisma.user.create({
    data: {
      role: DbUserRole.NOTARY,
      emailHash: getHash(notaryEmail),
      phoneHash: '',
      notaryId: notaryId,
    },
  });

  // Notary User 2 (Sharma)
  const sharmaNotaryEmail = 'sharma.notary@ltn.demo';
  const sharmaNotaryUser = await prisma.user.create({
    data: {
      role: DbUserRole.NOTARY,
      emailHash: getHash(sharmaNotaryEmail),
      phoneHash: '',
      notaryId: sharmaNotaryId,
    },
  });

  // Bank Officer (from main branch)
  const bankOfficer = await prisma.user.create({
    data: {
      role: DbUserRole.BANK_OFFICER,
      emailHash: getHash('bank.officer@ltn.demo'),
      phoneHash: '',
    },
  });

  console.log(`[SEED] Citizen A ID: ${citizenUser.userId}`);
  console.log(`[SEED] Citizen B ID: ${citizenBUser.userId}`);
  console.log(`[SEED] Notary Rao User ID: ${notaryUser.userId}`);
  console.log(`[SEED] Notary Sharma User ID: ${sharmaNotaryUser.userId}`);
  console.log(`[SEED] Bank Officer ID: ${bankOfficer.userId}`);

  console.log('[SEED] Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[SEED] Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });