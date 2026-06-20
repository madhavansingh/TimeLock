/**
 * env.ts — Centralized Environment Configuration & Validation
 *
 * Loads and validates all required environment variables at process startup.
 * Any missing required variable causes an immediate fatal exit so the error
 * is obvious at boot time rather than silently failing during a live request.
 *
 * Usage: import this module BEFORE any other service or app module.
 *   import './config/env';
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from /backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ---------------------------------------------------------------------------
// Required Variables — server will NOT start if any of these are absent
// ---------------------------------------------------------------------------
const REQUIRED: string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PINATA_JWT',
  'PINATA_GATEWAY',
];

// ---------------------------------------------------------------------------
// Optional Variables — defaults are provided where sensible
// ---------------------------------------------------------------------------

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[ENV] Fatal: Required environment variable "${key}" is not set. Check your .env file.`);
  }
  return val.trim();
}

function optionalEnv(key: string, defaultValue: string): string {
  const val = process.env[key];
  return val && val.trim() !== '' ? val.trim() : defaultValue;
}

// Validate required vars at import time
const missingVars: string[] = [];
for (const key of REQUIRED) {
  if (!process.env[key] || process.env[key]!.trim() === '') {
    missingVars.push(key);
  }
}

if (missingVars.length > 0) {
  console.error('╔══════════════════════════════════════════════════════╗');
  console.error('║  FATAL: Missing required environment variables        ║');
  console.error('╠══════════════════════════════════════════════════════╣');
  for (const v of missingVars) {
    console.error(`║  ✗  ${v.padEnd(49)}║`);
  }
  console.error('╠══════════════════════════════════════════════════════╣');
  console.error('║  Copy .env.example → .env and fill in the values.   ║');
  console.error('╚══════════════════════════════════════════════════════╝');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// FRONTEND_URL Validation
// ---------------------------------------------------------------------------
const frontendUrlEnv = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL;
const isProdEnv = process.env.NODE_ENV === 'production' || (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase().trim() === 'production');

function isValidUrl(str: string): boolean {
  try {
    const parsed = new URL(str);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

if (!frontendUrlEnv || frontendUrlEnv.trim() === '') {
  console.warn('⚠️  WARNING: FRONTEND_URL environment variable is missing. QR codes will fallback to a default address.');
  if (isProdEnv) {
    console.error('❌ FATAL: FRONTEND_URL is required and cannot be empty in production mode.');
    process.exit(1);
  }
} else {
  const trimmedUrl = frontendUrlEnv.trim();
  const lowerUrl = trimmedUrl.toLowerCase();
  
  if (lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1')) {
    console.warn('⚠️  WARNING: FRONTEND_URL contains "localhost" or "127.0.0.1". Scanned QR codes will fail on external devices.');
    if (isProdEnv) {
      console.error('❌ FATAL: FRONTEND_URL cannot contain "localhost" or "127.0.0.1" in production mode.');
      process.exit(1);
    }
  }

  if (!isValidUrl(trimmedUrl)) {
    console.warn('⚠️  WARNING: FRONTEND_URL is not a valid HTTP/HTTPS URL.');
    if (isProdEnv) {
      console.error('❌ FATAL: FRONTEND_URL must be a valid HTTP/HTTPS URL in production mode.');
      process.exit(1);
    }
  }
}

if (missingVars.length > 0) {
  console.error('╔══════════════════════════════════════════════════════╗');
  console.error('║  FATAL: Missing required environment variables        ║');
  console.error('╠══════════════════════════════════════════════════════╣');
  for (const v of missingVars) {
    console.error(`║  ✗  ${v.padEnd(49)}║`);
  }
  console.error('╠══════════════════════════════════════════════════════╣');
  console.error('║  Copy .env.example → .env and fill in the values.   ║');
  console.error('╚══════════════════════════════════════════════════════╝');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Exported typed config object — import this instead of process.env directly
// ---------------------------------------------------------------------------
export const config = {
  // Server
  port: parseInt(optionalEnv('PORT', '5001'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
  isDevelopment: optionalEnv('NODE_ENV', 'development') === 'development',

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // Auth
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),

  // Solana / Blockchain
  solanaRpcUrl: optionalEnv('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
  solanaRelayerPrivateKey: optionalEnv('SOLANA_RELAYER_PRIVATE_KEY', ''),
  solanaProgramId: optionalEnv('SOLANA_PROGRAM_ID', 'EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w'),

  // IPFS / Pinata
  pinataApiKey: optionalEnv('PINATA_API_KEY', ''),
  pinataSecret: optionalEnv('PINATA_SECRET', ''),
  pinataJwt: requireEnv('PINATA_JWT'),
  pinataGateway: requireEnv('PINATA_GATEWAY'),

  // SMTP / Mail Configuration
  smtpHost: optionalEnv('SMTP_HOST', ''),
  smtpPort: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
  smtpUser: optionalEnv('SMTP_USER', ''),
  smtpPass: optionalEnv('SMTP_PASS', ''),
  smtpFrom: optionalEnv('SMTP_FROM', 'noreply@timelock.network'),

  // Public App URL (used in QR code generation and verification links)
  frontendUrl: optionalEnv('FRONTEND_URL', optionalEnv('PUBLIC_APP_URL', 'http://10.131.235.84:3000')),
  publicAppUrl: optionalEnv('FRONTEND_URL', optionalEnv('PUBLIC_APP_URL', 'http://10.131.235.84:3000')),
} as const;

// Log non-sensitive config on startup (development only)
if (config.isDevelopment) {
  console.log('[ENV] Configuration loaded:');
  console.log(`  NODE_ENV        : ${config.nodeEnv}`);
  console.log(`  PORT            : ${config.port}`);
  console.log(`  SOLANA_RPC_URL  : ${config.solanaRpcUrl}`);
  console.log(`  FRONTEND_URL    : ${config.frontendUrl}`);
  console.log(`  PINATA_GATEWAY  : ${config.pinataGateway}`);
  console.log(`  PINATA_JWT set  : ${config.pinataJwt ? 'yes' : 'no'}`);
  console.log(`  DATABASE_URL    : ${config.databaseUrl.replace(/:[^@]+@/, ':***@')}`); // mask password
  console.log(`  JWT_SECRET set  : ${config.jwtSecret ? 'yes' : 'NO (DANGER)'}`);
}

