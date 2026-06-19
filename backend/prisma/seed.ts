import { PrismaClient, DbUserRole } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateSHA256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function main() {
  console.log('Cleaning database...');
  await prisma.ipfsReference.deleteMany();
  await prisma.fraudScore.deleteMany();
  await prisma.verificationEvent.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.document.deleteMany();
  await prisma.notary.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding roles and users...');

  // 1. Citizen Priya Executant
  const priyaEmailHash = generateSHA256('priya.executant@example.com');
  const citizen = await prisma.user.create({
    data: {
      role: DbUserRole.CITIZEN,
      emailHash: priyaEmailHash,
      phoneHash: '',
    },
  });

  // 2. Notary Rao
  const raoEmailHash = generateSHA256('rao.notary@example.com');
  const notaryUser = await prisma.user.create({
    data: {
      role: DbUserRole.NOTARY,
      emailHash: raoEmailHash,
      phoneHash: '',
    },
  });

  // 3. Bank Officer Anjali
  const bankEmailHash = generateSHA256('bank.officer@example.com');
  const bankOfficer = await prisma.user.create({
    data: {
      role: DbUserRole.BANK_OFFICER,
      emailHash: bankEmailHash,
      phoneHash: '',
    },
  });

  // 4. Onboard Notary Record for Advocate Rao
  // A standard public key base64 for validation
  const dummyPublicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzV14227n23727372737273727372';
  const notaryRecord = await prisma.notary.create({
    data: {
      notaryId: '7df83c92-d3a9-4672-9b2f-2d93e110b9ad',
      name: 'Advocate Rao',
      dscCertificateSerial: 'CA-3-889a2bc1',
      publicKey: dummyPublicKey,
      certStatus: 'active',
    },
  });

  console.log('Seeding completed successfully!');
  console.log(`Citizen User ID: ${citizen.userId}`);
  console.log(`Notary User ID: ${notaryUser.userId}`);
  console.log(`Bank Officer User ID: ${bankOfficer.userId}`);
  console.log(`Notary Record ID: ${notaryRecord.notaryId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
