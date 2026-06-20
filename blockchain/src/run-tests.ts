import { SolanaClient } from './solana-client';
import { DocumentProgramClient } from './document-program';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';
import assert from 'assert';

async function runTests() {
  console.log('==================================================');
  console.log('   LTN Blockchain Integration SDK Test Suite     ');
  console.log('==================================================\n');

  // Initialize Solana client and SDK client in demo/failover mode
  const client = new SolanaClient({
    rpcUrl: 'https://api.devnet.solana.com',
    programId: 'EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w'
  });
  const sdk = new DocumentProgramClient(client, { profile: 'demo', strictMode: false });

  let testsPassed = 0;
  let testsFailed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      testsPassed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      testsFailed++;
    }
  }

  // --- 1. PDA Generation & Caching Tests ---
  await test('PDA Generation & Cache Performance', () => {
    const docId = 'doc_' + Math.floor(Math.random() * 1000000);
    
    // Time the first PDA derivation (calculating math/hash)
    const t0 = process.hrtime.bigint();
    const pda1 = sdk.deriveDocumentPDA(docId);
    const t1 = process.hrtime.bigint();
    
    // Retrieve from cache
    const t2 = process.hrtime.bigint();
    const pda2 = sdk.deriveDocumentPDA(docId);
    const t3 = process.hrtime.bigint();

    assert.strictEqual(pda1.pda.toBase58(), pda2.pda.toBase58(), 'PDA derivation mismatch');
    assert.strictEqual(pda1.bump, pda2.bump, 'PDA bump mismatch');
    
    const timeFirst = Number(t1 - t0);
    const timeCached = Number(t3 - t2);
    
    console.log(`       -> Derivation time: ${timeFirst}ns | Cached time: ${timeCached}ns`);
  });

  // --- 2. Cryptographic Signature Validation Tests ---
  await (async () => {
    // Generate a test keypair
    const nacl = require('tweetnacl');
    const keypair = nacl.sign.keyPair();
    const publicKeyBase58 = new PublicKey(keypair.publicKey).toBase58();
    
    const message = Buffer.from('Legal Land Title Verification Message for TimeLock');
    const signature = nacl.sign.detached(new Uint8Array(message), keypair.secretKey);
    const signatureBase64 = Buffer.from(signature).toString('base64');

    await test('Ed25519 Cryptographic Verification (Positive Case)', async () => {
      const result = await sdk.verifyEd25519Signature(message, signatureBase64, publicKeyBase58);
      assert.strictEqual(result.valid, true, 'Valid signature failed verification');
      assert.strictEqual(result.signerAddress, publicKeyBase58, 'Signer address mismatch');
    });

    await test('Ed25519 Cryptographic Verification (Negative Case)', async () => {
      const corruptedSig = Buffer.from(signature);
      corruptedSig[0] ^= 1; // flip a bit
      const corruptedBase64 = corruptedSig.toString('base64');
      const result = await sdk.verifyEd25519Signature(message, corruptedBase64, publicKeyBase58);
      assert.strictEqual(result.valid, false, 'Invalid/Corrupted signature passed verification');
    });
  })();

  // --- 3. Memory & Eviction Cache Limits Tests ---
  await test('Memory & Eviction Cache Limits', () => {
    // Configure small cache size for testing
    sdk.configureCacheLimits({
      maxWorkflowItems: 3
    });

    sdk.clearCaches();

    // Populate cache past limit
    sdk.setMockRecordOverride('doc_1', 1, 1, 1);
    sdk.setMockRecordOverride('doc_2', 1, 1, 1);
    sdk.setMockRecordOverride('doc_3', 1, 1, 1);
    sdk.setMockRecordOverride('doc_4', 1, 1, 1); // Evicts doc_1's PDA derivations or custom states if Map exceeds

    // Trigger workflow cache saves (sets)
    sdk.createApprovalWorkflow('doc_1', ['OWNER'], 1);
    sdk.createApprovalWorkflow('doc_2', ['OWNER'], 1);
    sdk.createApprovalWorkflow('doc_3', ['OWNER'], 1);
    sdk.createApprovalWorkflow('doc_4', ['OWNER'], 1); // Should evict doc_1 from workflow cache

    // Verify cache eviction
    const w1 = (sdk as any).workflowCache.get('doc_1');
    const w4 = (sdk as any).workflowCache.get('doc_4');
    
    assert.strictEqual(w1, undefined, 'Workflow doc_1 should have been evicted');
    assert.ok(w4 !== undefined, 'Workflow doc_4 should be cached');
  });

  // --- 4. Authority Registry Validation Tests ---
  await test('Authority Registry Accreditation', async () => {
    const customKey = 'AuthRegistryTestKey1111111111111111111111';
    
    await sdk.registerAuthority(customKey, 'AUDITOR', 'A certified third-party smart auditor');
    const result = await sdk.verifyAuthority(customKey);
    assert.ok(result, 'Registered authority should not be null');
    assert.strictEqual(result.status, 'ACTIVE', 'Accredited status should be ACTIVE');

    await sdk.revokeAuthority(customKey);
    const resultRevoked = await sdk.verifyAuthority(customKey);
    assert.ok(resultRevoked, 'Revoked authority should not be null');
    assert.strictEqual(resultRevoked.status, 'REVOKED', 'Revoked authority status should be REVOKED');
  });

  // --- 5. Demo Scenario Generator Tests ---
  await (async () => {
    const demoDocId = 'demo_property_bangalore';
    
    await test('Demo Scenario Generator (Property Creation)', async () => {
      const proof = await sdk.generateDemoProperty({
        documentId: demoDocId,
        location: '12th Main Road, Bengaluru',
        ownerName: 'Ram Sharan'
      });

      assert.strictEqual(proof.documentId, demoDocId, 'Demo property ID mismatch');
      assert.strictEqual(proof.verificationResult.documentProof.foundOnChain, true, 'Demo property not marked as anchored');
      assert.strictEqual(proof.verificationResult.documentProof.signerCount, 1, 'Demo signer count mismatch');
    });

    await test('Demo Scenario Generator (Ownership Transfer)', async () => {
      const transfer = await sdk.generateDemoTransfer({
        documentId: demoDocId,
        ownerName: 'Ram Sharan',
        buyerName: 'Aishwarya Sen',
        amount: 8500000
      });

      assert.strictEqual(transfer.status, 'APPROVED', 'Simulated transfer not approved');
      assert.strictEqual(transfer.approvals.length, 3, 'Not all required approvers signed transfer');
    });

    await test('Demo Scenario Generator (Dispute Flagging)', async () => {
      const scan = await sdk.generateDemoDispute(demoDocId, 'GovtAuthority', 'Conflicting survey boundaries');
      assert.strictEqual(scan.healthy, false, 'Disputed document should report unhealthy status');
      const disputeIssue = scan.issues.find(i => i.issueType === 'DISPUTED_ASSET');
      assert.ok(disputeIssue, 'Dispute scan did not flag DISPUTED_ASSET');
    });

    await test('Demo Verification Bundle Exporter', async () => {
      const bundle = await sdk.generateDemoVerificationBundle(demoDocId);
      assert.strictEqual(bundle.documentProof.documentId, demoDocId, 'Bundle document ID mismatch');
      assert.ok(bundle.bundleHash, 'Bundle missing cryptographic integrity checksum');
      assert.ok(bundle.qrPayload, 'Bundle missing QR verification payload');
    });
  })();

  // --- 6. Trust Score Calculations & Integrity Scans ---
  await (async () => {
    const trustDocId = 'trust_score_test_doc';
    
    await test('Trust Score Engine Logic', async () => {
      sdk.setMockRecordOverride(trustDocId, 3, 2, 2, [
        { roleByte: 2, signerPubkey: 'Ownr1111111111111111111111111111111111111111', signedAt: Math.floor(Date.now() / 1000) },
        { roleByte: 1, signerPubkey: '5h3K1111111111111111111111111111111111111111', signedAt: Math.floor(Date.now() / 1000) }
      ]);

      const report = await sdk.calculateTrustScore(trustDocId);
      assert.ok(report.score >= 90, `Fully signed document should score high, got ${report.score}`);
    });
  })();

  // --- 7. Production Mode Strict Exception Enforcement ---
  await (async () => {
    const prodSdk = new DocumentProgramClient(client, { profile: 'production', strictMode: true });
    
    await test('Production Profile Strict Exception Mode', async () => {
      // In production profile without connection, operations should throw hard RPC exceptions
      try {
        await prodSdk.fetchDocumentRecord('non_existent_doc');
        assert.fail('Production client should have thrown RPC error');
      } catch (err: any) {
        assert.ok(
          err.message.includes('fetch') || 
          err.message.includes('connect') || 
          err.message.includes('fail') || 
          err.message.includes('Connection') ||
          err.message.includes('fetch') ||
          err.message.includes('404') ||
          err.message.includes('RPC'), 
          'Unexpected error thrown: ' + err.message
        );
      }
    });
  })();

  // --- 8. Readiness Assessment & Integration Readiness Layer ---
  await (async () => {
    await test('Self-Readiness Assessment Report', async () => {
      const report = await sdk.generateReadinessReport();
      assert.strictEqual(report.overallScore >= 95, true, 'Overall readiness score low');
      assert.strictEqual(report.featureCompleteness, 100, 'Features incomplete');
    });

    await test('Integration Compatibility Checks', async () => {
      const result = await sdk.validateIntegrationReadiness();
      assert.ok(result.details.length > 0, 'Integration readiness details empty');
    });
  })();

  console.log('\n==================================================');
  console.log(`Test Execution Finished. Passed: ${testsPassed} | Failed: ${testsFailed}`);
  console.log('==================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled failure in test suite:', err);
  process.exit(1);
});
