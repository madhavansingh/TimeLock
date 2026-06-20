import { prisma } from '../config/db';

async function run() {
  console.log('Initializing check_db script using backend prisma config...');
  
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected successfully.');

    // Query list of tables in the public schema
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('Tables in database:');
    tables.forEach(row => {
      console.log(` - ${row.table_name}`);
    });

    const paymentsExist = tables.some(row => row.table_name === 'payments');
    console.log(`Does 'payments' table exist? ${paymentsExist ? 'YES' : 'NO'}`);

    if (paymentsExist) {
      console.log('Querying payments via prisma.payment.findMany()...');
      const payments = await prisma.payment.findMany();
      console.log(`Successfully queried payments. Count: ${payments.length}`);
    }

  } catch (err) {
    console.error('Prisma Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
