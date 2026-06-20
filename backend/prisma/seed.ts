import { PrismaClient, DbUserRole } from '@prisma/client';
import * as crypto from 'crypto';
import nacl from 'tweetnacl';
// @ts-ignore
import bcrypt from 'bcrypt';

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

  const defaultPasswordHash = bcrypt.hashSync('Demo@123', 10);

  // New Demo Accounts
  const demoCitizen = await prisma.user.create({
    data: {
      role: DbUserRole.CITIZEN,
      name: 'Demo Citizen',
      email: 'citizen@ltn.demo',
      passwordHash: defaultPasswordHash,
      emailHash: getHash('citizen@ltn.demo'),
      phoneHash: '',
    },
  });

  const demoNotary = await prisma.user.create({
    data: {
      role: DbUserRole.NOTARY,
      name: 'Demo Notary',
      email: 'notary@ltn.demo',
      passwordHash: defaultPasswordHash,
      emailHash: getHash('notary@ltn.demo'),
      phoneHash: '',
      notaryId: notaryId, // Link to Rao
    },
  });

  const demoJudge = await prisma.user.create({
    data: {
      role: DbUserRole.JUDGE,
      name: 'Demo Judge',
      email: 'judge@ltn.demo',
      passwordHash: defaultPasswordHash,
      emailHash: getHash('judge@ltn.demo'),
      phoneHash: '',
    },
  });

  const demoAdmin = await prisma.user.create({
    data: {
      role: DbUserRole.ADMIN,
      name: 'Demo Admin',
      email: 'admin@ltn.demo',
      passwordHash: defaultPasswordHash,
      emailHash: getHash('admin@ltn.demo'),
      phoneHash: '',
    },
  });

  console.log('[SEED] Created Demo Accounts (Citizen, Notary, Judge, Admin)');

  // Legacy/existing citizen A
  const citizenEmail = 'priya.executant@ltn.demo';
  const citizenUser = await prisma.user.create({
    data: {
      role: DbUserRole.CITIZEN,
      name: 'Priya Executant',
      email: citizenEmail,
      passwordHash: defaultPasswordHash,
      emailHash: getHash(citizenEmail),
      phoneHash: '',
    },
  });

  // Legacy/existing citizen B
  const citizenBEmail = 'amit.executant@ltn.demo';
  const citizenBUser = await prisma.user.create({
    data: {
      role: DbUserRole.CITIZEN,
      name: 'Amit Executant',
      email: citizenBEmail,
      passwordHash: defaultPasswordHash,
      emailHash: getHash(citizenBEmail),
      phoneHash: '',
    },
  });

  // Legacy/existing Notary User 1 (Rao)
  const notaryEmail = 'rao.notary@ltn.demo';
  const notaryUser = await prisma.user.create({
    data: {
      role: DbUserRole.NOTARY,
      name: 'Rao Notary',
      email: notaryEmail,
      passwordHash: defaultPasswordHash,
      emailHash: getHash(notaryEmail),
      phoneHash: '',
      notaryId: notaryId,
    },
  });

  // Legacy/existing Notary User 2 (Sharma)
  const sharmaNotaryEmail = 'sharma.notary@ltn.demo';
  const sharmaNotaryUser = await prisma.user.create({
    data: {
      role: DbUserRole.NOTARY,
      name: 'Sharma Notary',
      email: sharmaNotaryEmail,
      passwordHash: defaultPasswordHash,
      emailHash: getHash(sharmaNotaryEmail),
      phoneHash: '',
      notaryId: sharmaNotaryId,
    },
  });

  // Bank Officer (from main branch)
  const bankOfficer = await prisma.user.create({
    data: {
      role: DbUserRole.BANK_OFFICER,
      name: 'Bank Officer',
      email: 'bank.officer@ltn.demo',
      passwordHash: defaultPasswordHash,
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