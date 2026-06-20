import * as fs from 'fs';
import * as path from 'path';
import { Keypair } from '@solana/web3.js';

function logSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

function exitFailure(message: string): never {
  console.error(`\n❌ VALIDATION FAILURE: ${message}`);
  process.exit(1);
}

function exitSuccess(message: string) {
  console.log(`\n✅ VALIDATION SUCCESS: ${message}`);
  process.exit(0);
}

async function main() {
  console.log('==================================================');
  console.log('    TimeLock Solana Deployment Validation Tool     ');
  console.log('==================================================');

  // Paths
  const rootDir = path.resolve(__dirname, '../..');
  const keypairPath = path.join(rootDir, 'blockchain/target/deploy/legal_timelock-keypair.json');
  const libRsPath = path.join(rootDir, 'blockchain/programs/legal_timelock/src/lib.rs');
  const anchorTomlPath = path.join(rootDir, 'blockchain/Anchor.toml');
  const backendEnvTsPath = path.join(rootDir, 'backend/src/config/env.ts');
  const backendEnvPath = path.join(rootDir, 'backend/.env');
  const sdkDocProgramPath = path.join(rootDir, 'blockchain/src/document-program.ts');
  const sdkSolanaClientPath = path.join(rootDir, 'blockchain/src/solana-client.ts');
  const sdkRunTestsPath = path.join(rootDir, 'blockchain/src/run-tests.ts');
  const frontendDocPagePath = path.join(rootDir, 'frontend/app/document/[id]/page.tsx');
  const frontendVerifyPagePath = path.join(rootDir, 'frontend/app/verify/page.tsx');

  // 1. Get Program ID from keypair
  logSection('1. Checking Program ID in Keypair');
  if (!fs.existsSync(keypairPath)) {
    exitFailure(`Keypair file not found at ${keypairPath}. Ensure anchor build has run.`);
  }

  let expectedProgramId = '';
  try {
    const secretKeyContent = fs.readFileSync(keypairPath, 'utf8');
    const secretKeyArray = JSON.parse(secretKeyContent);
    if (!Array.isArray(secretKeyArray)) {
      throw new Error('Keypair file JSON is not a byte array');
    }
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
    expectedProgramId = keypair.publicKey.toBase58();
    console.log(`✔ Found Program ID in Keypair: ${expectedProgramId}`);
  } catch (err: any) {
    exitFailure(`Failed to parse keypair file: ${err.message}`);
  }

  // 2. Check Program ID in lib.rs
  logSection('2. Checking Program ID in lib.rs');
  if (!fs.existsSync(libRsPath)) {
    exitFailure(`lib.rs file not found at ${libRsPath}`);
  }

  try {
    const libRsContent = fs.readFileSync(libRsPath, 'utf8');
    const declareIdMatch = libRsContent.match(/declare_id!\s*\(\s*["']([^"']+)["']\s*\)/);
    if (!declareIdMatch) {
      exitFailure('Could not find declare_id! macro in lib.rs');
    }
    const libRsId = declareIdMatch[1];
    if (libRsId !== expectedProgramId) {
      exitFailure(`Program ID in lib.rs (${libRsId}) does not match expected Program ID (${expectedProgramId})`);
    }
    console.log(`✔ lib.rs declare_id! matches: ${libRsId}`);
  } catch (err: any) {
    exitFailure(`Error reading lib.rs: ${err.message}`);
  }

  // 3. Check Program ID in Anchor.toml
  logSection('3. Checking Program ID in Anchor.toml');
  if (!fs.existsSync(anchorTomlPath)) {
    exitFailure(`Anchor.toml not found at ${anchorTomlPath}`);
  }

  try {
    const anchorTomlContent = fs.readFileSync(anchorTomlPath, 'utf8');
    // Match localnet and devnet programs
    const localnetMatch = anchorTomlContent.match(/\[programs\.localnet\]\s*\n\s*legal_timelock\s*=\s*["']([^"']+)["']/);
    const devnetMatch = anchorTomlContent.match(/\[programs\.devnet\]\s*\n\s*legal_timelock\s*=\s*["']([^"']+)["']/);

    if (!localnetMatch) {
      exitFailure('Could not find [programs.localnet] legal_timelock in Anchor.toml');
    }
    if (!devnetMatch) {
      exitFailure('Could not find [programs.devnet] legal_timelock in Anchor.toml');
    }

    const localnetId = localnetMatch[1];
    const devnetId = devnetMatch[1];

    if (localnetId !== expectedProgramId) {
      exitFailure(`programs.localnet legal_timelock ID (${localnetId}) does not match expected Program ID (${expectedProgramId})`);
    }
    if (devnetId !== expectedProgramId) {
      exitFailure(`programs.devnet legal_timelock ID (${devnetId}) does not match expected Program ID (${expectedProgramId})`);
    }
    console.log(`✔ Anchor.toml [programs.localnet] matches: ${localnetId}`);
    console.log(`✔ Anchor.toml [programs.devnet] matches: ${devnetId}`);
  } catch (err: any) {
    exitFailure(`Error reading Anchor.toml: ${err.message}`);
  }

  // 4. Check Program ID in Backend env/config
  logSection('4. Checking Program ID in Backend Environment');
  if (!fs.existsSync(backendEnvTsPath)) {
    exitFailure(`Backend environment configuration not found at ${backendEnvTsPath}`);
  }

  try {
    const envTsContent = fs.readFileSync(backendEnvTsPath, 'utf8');
    const backendFallbackMatch = envTsContent.match(/solanaProgramId:\s*optionalEnv\(\s*['"]SOLANA_PROGRAM_ID['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    if (!backendFallbackMatch) {
      exitFailure('Could not find solanaProgramId default/fallback definition in backend env.ts');
    }
    const backendFallbackId = backendFallbackMatch[1];
    if (backendFallbackId !== expectedProgramId) {
      exitFailure(`Backend config default program ID (${backendFallbackId}) does not match expected Program ID (${expectedProgramId})`);
    }
    console.log(`✔ Backend config default/fallback matches: ${backendFallbackId}`);

    // If backend/.env exists, check if it specifies a overriding SOLANA_PROGRAM_ID
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, 'utf8');
      const envMatch = envContent.match(/^SOLANA_PROGRAM_ID\s*=\s*["']?([^"'\r\n]+)["']?/m);
      if (envMatch) {
        const envProgramId = envMatch[1].trim();
        if (envProgramId && envProgramId !== expectedProgramId) {
          exitFailure(`SOLANA_PROGRAM_ID in backend/.env (${envProgramId}) does not match expected Program ID (${expectedProgramId})`);
        }
        console.log(`✔ Backend .env overrides SOLANA_PROGRAM_ID with valid ID: ${envProgramId}`);
      } else {
        console.log('✔ Backend .env does not override SOLANA_PROGRAM_ID (will fallback to valid default)');
      }
    }
  } catch (err: any) {
    exitFailure(`Error validating backend environment: ${err.message}`);
  }

  // 5. Check Program ID in SDK config and defaults
  logSection('5. Checking Program ID in SDK Config');
  
  // SDK document-program.ts
  if (!fs.existsSync(sdkDocProgramPath)) {
    exitFailure(`SDK document-program.ts not found at ${sdkDocProgramPath}`);
  }
  try {
    const sdkContent = fs.readFileSync(sdkDocProgramPath, 'utf8');
    const defaultIdMatch = sdkContent.match(/export const DEFAULT_PROGRAM_ID = new PublicKey\(['"]([^'"]+)['"]\)/);
    if (!defaultIdMatch) {
      exitFailure('Could not find DEFAULT_PROGRAM_ID in SDK document-program.ts');
    }
    const defaultSdkId = defaultIdMatch[1];
    if (defaultSdkId !== expectedProgramId) {
      exitFailure(`DEFAULT_PROGRAM_ID in SDK document-program.ts (${defaultSdkId}) does not match expected Program ID (${expectedProgramId})`);
    }
    console.log(`✔ SDK document-program.ts DEFAULT_PROGRAM_ID matches: ${defaultSdkId}`);

    // Check fallback in validation method
    const fallbackMatch = sdkContent.match(/process\.env\.SOLANA_PROGRAM_ID\s*\|\|\s*['"]([^'"]+)['"]/);
    if (!fallbackMatch) {
      exitFailure('Could not find programId fallback definition in SDK validateIntegrationReadiness method');
    }
    const fallbackSdkId = fallbackMatch[1];
    if (fallbackSdkId !== expectedProgramId) {
      exitFailure(`Validation fallback program ID in SDK (${fallbackSdkId}) does not match expected Program ID (${expectedProgramId})`);
    }
    console.log(`✔ SDK validateIntegrationReadiness fallback matches: ${fallbackSdkId}`);
  } catch (err: any) {
    exitFailure(`Error reading SDK document-program.ts: ${err.message}`);
  }

  // SDK solana-client.ts
  if (!fs.existsSync(sdkSolanaClientPath)) {
    exitFailure(`SDK solana-client.ts not found at ${sdkSolanaClientPath}`);
  }
  try {
    const clientContent = fs.readFileSync(sdkSolanaClientPath, 'utf8');
    const clientMatch = clientContent.match(/let programId = ['"]([^'"]+)['"]/);
    if (!clientMatch) {
      exitFailure('Could not find let programId definition in SDK solana-client.ts constructor');
    }
    const clientProgramId = clientMatch[1];
    if (clientProgramId !== expectedProgramId) {
      exitFailure(`Default programId in SDK solana-client.ts (${clientProgramId}) does not match expected Program ID (${expectedProgramId})`);
    }
    console.log(`✔ SDK solana-client.ts default programId matches: ${clientProgramId}`);
  } catch (err: any) {
    exitFailure(`Error reading SDK solana-client.ts: ${err.message}`);
  }

  // SDK run-tests.ts
  if (!fs.existsSync(sdkRunTestsPath)) {
    exitFailure(`SDK run-tests.ts not found at ${sdkRunTestsPath}`);
  }
  try {
    const runTestsContent = fs.readFileSync(sdkRunTestsPath, 'utf8');
    const runTestsMatch = runTestsContent.match(/programId:\s*['"]([^'"]+)['"]/);
    if (!runTestsMatch) {
      exitFailure('Could not find programId in SDK run-tests.ts client initialization');
    }
    const runTestsId = runTestsMatch[1];
    if (runTestsId !== expectedProgramId) {
      exitFailure(`programId in SDK run-tests.ts (${runTestsId}) does not match expected Program ID (${expectedProgramId})`);
    }
    console.log(`✔ SDK run-tests.ts programId matches: ${runTestsId}`);
  } catch (err: any) {
    exitFailure(`Error reading SDK run-tests.ts: ${err.message}`);
  }

  // 6. Check Program ID in Frontend pages
  logSection('6. Checking Program ID in Frontend Pages');
  
  if (fs.existsSync(frontendDocPagePath)) {
    try {
      const pageContent = fs.readFileSync(frontendDocPagePath, 'utf8');
      if (pageContent.includes('LTN1111111111111111111111111111111111111111')) {
        exitFailure(`Frontend document page contains placeholder Program ID`);
      }
      console.log('✔ Frontend document detail page contains no placeholder Program ID');
    } catch (err: any) {
      console.warn(`Could not read frontend document detail page: ${err.message}`);
    }
  }

  if (fs.existsSync(frontendVerifyPagePath)) {
    try {
      const pageContent = fs.readFileSync(frontendVerifyPagePath, 'utf8');
      if (pageContent.includes('LTN1111111111111111111111111111111111111111')) {
        exitFailure(`Frontend verify page contains placeholder Program ID`);
      }
      console.log('✔ Frontend verify page contains no placeholder Program ID');
    } catch (err: any) {
      console.warn(`Could not read frontend verify page: ${err.message}`);
    }
  }

  exitSuccess(`All 5 configuration layers are consistent with Program ID: ${expectedProgramId}`);
}

main().catch((err) => {
  console.error('Unexpected error in validation script:', err);
  process.exit(1);
});
