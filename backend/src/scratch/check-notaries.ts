import { prisma } from '../config/db';
import { HashService } from '../services/hash.service';
import { PublicKey } from '@solana/web3.js';

async function checkNotaries() {
  const notaries = await prisma.notary.findMany();
  console.log(`Found ${notaries.length} notaries in the database.`);
  for (const notary of notaries) {
    console.log(`\nNotary: ${notary.name} (ID: ${notary.notaryId})`);
    console.log(`  DB PublicKey (Base64): ${notary.publicKey}`);
    try {
      const pubkeyBytes = Buffer.from(notary.publicKey, 'base64');
      const solanaPubkey = new PublicKey(pubkeyBytes).toBase58();
      console.log(`  Derived Solana PubKey:   ${solanaPubkey}`);
      
      const derivedKeypair = HashService.getNotaryKeypair(notary.notaryId);
      const derivedSolanaPubkey = new PublicKey(derivedKeypair.publicKey).toBase58();
      console.log(`  Keypair Solana PubKey:   ${derivedSolanaPubkey}`);
      console.log(`  Match:                   ${solanaPubkey === derivedSolanaPubkey ? 'YES' : 'NO'}`);
    } catch (err: any) {
      console.error(`  Error deriving keys: ${err.message}`);
    }
  }
}

checkNotaries()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
