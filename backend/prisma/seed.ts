import { PrismaClient, DbUserRole } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function getHash(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

async function main() {
  console.log('[SEED] Starting database seeding...');

  // Clean existing tables in proper order
  await prisma.ipfsReference.deleteMany();
  await prisma.fraudScore.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.verificationEvent.deleteMany();
  await prisma.document.deleteMany();
  await prisma.notary.deleteMany();
  await prisma.user.deleteMany();

  console.log('[SEED] Cleared existing data.');

  // 1. Create Notary "Advocate Rao"
  // A standard mock Base64 encoded RSA public key
  const mockPublicKeyBase64 = 
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzV1M3m7M9z98k3YFq2+f' +
    'w5RzD3XQ1V4gH9eD6H3I0D4yV8JbWvW/O/e6T3WjWw1oX1jL1w4o8y6w5Q1y2r8M' +
    'sD8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7' +
    'mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1' +
    'y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD' +
    '8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7mO8Q9Q1y2r8MsD8XgW7mA' +
    'QIDAQAB';

  const notary = await prisma.notary.create({
    data: {
      name: 'Advocate Rao',
      dscCertificateSerial: 'CA-3-889a2bc1',
      publicKey: mockPublicKeyBase64,
      certStatus: 'active',
    },
  });
  console.log(`[SEED] Created Notary: ${notary.name} (ID: ${notary.notaryId})`);

  // 2. Create NOTARY role User "rao.notary@ltn.demo"
  const notaryEmail = 'rao.notary@ltn.demo';
  const notaryUser = await prisma.user.create({
    data: {
      role: DbUserRole.NOTARY,
      emailHash: getHash(notaryEmail),
      phoneHash: '',
    },
  });
  console.log(`[SEED] Created User: ${notaryEmail} as ${notaryUser.role} (ID: ${notaryUser.userId})`);

  // 3. Create CITIZEN role User "priya.executant@ltn.demo"
  const citizenEmail = 'priya.executant@ltn.demo';
  const citizenUser = await prisma.user.create({
    data: {
      role: DbUserRole.CITIZEN,
      emailHash: getHash(citizenEmail),
      phoneHash: '',
    },
  });
  console.log(`[SEED] Created User: ${citizenEmail} as ${citizenUser.role} (ID: ${citizenUser.userId})`);

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
