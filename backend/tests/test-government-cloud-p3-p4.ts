import { prisma, basePrisma, tenantContextStorage } from '../src/config/db';
import { PolicyService, CLASSIFICATION_VALUES } from '../src/services/policy.service';
import { ResidencyService } from '../src/services/residency.service';
import { VersionRegistryService } from '../src/services/version-registry.service';

async function runTests() {
  console.log('============================================================');
  
  console.log('Starting GCPX Phase 3 & Phase 4 Automated Test Suite...');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // Set up clean test tenants and users in the database
  const tenantAId = 'test-tenant-a';
  const tenantBId = 'test-tenant-b';
  
  try {
    // Upsert test tenants
    await basePrisma.tenant.upsert({
      where: { tenantId: tenantAId },
      update: {},
      create: {
        tenantId: tenantAId,
        name: 'Test State Government A',
        type: 'STATE_GOV',
        brandingConfig: {},
        aiPolicies: {},
        securityPolicies: {},
        auditPolicies: {},
        country: 'IN',
        state: 'MH',
        district: 'PUNE'
      }
    });

    await basePrisma.tenant.upsert({
      where: { tenantId: tenantBId },
      update: {},
      create: {
        tenantId: tenantBId,
        name: 'Test State Government B',
        type: 'STATE_GOV',
        brandingConfig: {},
        aiPolicies: {},
        securityPolicies: {},
        auditPolicies: {},
        country: 'IN',
        state: 'KA',
        district: 'BANGALORE'
      }
    });

    // Clean up old test documents for these tenants to prevent key collisions
    await basePrisma.document.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });

    // Create test user for Tenant A
    const userAId = 'test-user-a';
    await basePrisma.user.upsert({
      where: { userId: userAId },
      update: {},
      create: {
        userId: userAId,
        tenantId: tenantAId,
        role: 'CITIZEN',
        email: 'user-a@test.gov',
        securityClearance: 'INTERNAL',
        residencyCountry: 'IN',
        residencyState: 'MH',
        residencyDistrict: 'PUNE'
      }
    });

    // Create test user for Tenant B
    const userBId = 'test-user-b';
    await basePrisma.user.upsert({
      where: { userId: userBId },
      update: {},
      create: {
        userId: userBId,
        tenantId: tenantBId,
        role: 'CITIZEN',
        email: 'user-b@test.gov',
        securityClearance: 'SECRET',
        residencyCountry: 'IN',
        residencyState: 'KA',
        residencyDistrict: 'BANGALORE'
      }
    });

    // Create a document belonging to Tenant B
    const docBId = 'test-doc-b-uuid';
    await basePrisma.document.create({
      data: {
        documentId: docBId,
        tenantId: tenantBId,
        title: 'Confidential Land Record B',
        type: 'LandDeed',
        contentHash: 'hash-bbbb',
        classification: 'SECRET',
        ownerUserId: userBId
      }
    });

    // Create an INTERNAL document belonging to Tenant A
    const docAId = 'test-doc-a-uuid';
    await basePrisma.document.create({
      data: {
        documentId: docAId,
        tenantId: tenantAId,
        title: 'Internal Memo A',
        type: 'Memo',
        contentHash: 'hash-aaaa',
        classification: 'INTERNAL',
        ownerUserId: userAId
      }
    });

    // -------------------------------------------------------------------------
    // TEST 1: Explainable ABAC PDP Denial
    // -------------------------------------------------------------------------
    console.log('\n--- Test 1: Explainable ABAC PDP Denial ---');
    const decisionDeny = await PolicyService.evaluate(
      { userId: userAId, role: 'CITIZEN', securityClearance: 'INTERNAL' },
      { id: docBId, type: 'document', classification: 'SECRET', ownerId: userBId },
      'document:read',
      tenantAId
    );
    assert(decisionDeny.decision === 'DENY', 'Access denied for insufficient clearance.');
    assert(decisionDeny.deniedRules.includes('GCPX-AUTH-RULE-102'), 'Classification clearance rule correctly enforced.');
    assert(decisionDeny.evaluationId.length > 20, 'Unique decision ID generated.');
    assert(decisionDeny.supportReference.startsWith('GCPX-AUTH-REF-'), 'Standard support reference generated.');

    // -------------------------------------------------------------------------
    // TEST 2: Emergency Override & PDP Auditing
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Emergency Override & PDP Auditing ---');
    const decisionAllow = await PolicyService.evaluate(
      { userId: userAId, role: 'CITIZEN', securityClearance: 'INTERNAL', emergencyOverrideActive: true },
      { id: docBId, type: 'document', classification: 'SECRET', ownerId: userBId },
      'document:read',
      tenantAId
    );
    assert(decisionAllow.decision === 'ALLOW', 'Emergency override successfully grants access.');
    
    // Verify audit record was written
    const auditRecord = await basePrisma.policyEvaluationLog.findFirst({
      where: { evaluationId: decisionAllow.evaluationId }
    });
    assert(auditRecord !== null, 'PDP decision successfully logged to PolicyEvaluationLog.');
    assert(auditRecord?.decision === 'ALLOW', 'Logged decision matches evaluation.');

    // -------------------------------------------------------------------------
    // TEST 3: Policy Cache Invalidation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Policy Cache Invalidation ---');
    const ruleId = 'test-rule-uuid';
    await basePrisma.policyRule.upsert({
      where: { ruleId },
      update: {},
      create: {
        ruleId,
        tenantId: tenantAId,
        name: 'Deny Citizens out of hours',
        description: 'Deny Citizen operations',
        effect: 'DENY',
        actions: ['document:write'],
        classifications: ['INTERNAL'],
        conditions: { requireOwner: true }
      }
    });

    // Invalidate stale cache from prior tests to force loading of the new rule
    PolicyService.invalidateCache(tenantAId);

    // Force load and cache policies
    const initialEval = await PolicyService.evaluate(
      { userId: userAId, role: 'CITIZEN', securityClearance: 'INTERNAL' },
      { id: docAId, type: 'document', classification: 'INTERNAL', ownerId: userAId },
      'document:write',
      tenantAId
    );
    assert(initialEval.decision === 'DENY', 'ABAC rule successfully evaluated and denied.');

    // Deactivate rule in database
    await basePrisma.policyRule.update({
      where: { ruleId },
      data: { isActive: false }
    });

    // Invalidate Cache
    PolicyService.invalidateCache(tenantAId);

    const postInvalidateEval = await PolicyService.evaluate(
      { userId: userAId, role: 'CITIZEN', securityClearance: 'INTERNAL' },
      { id: docAId, type: 'document', classification: 'INTERNAL', ownerId: userAId },
      'document:write',
      tenantAId
    );
    assert(postInvalidateEval.decision === 'ALLOW', 'Policy cache invalidation successfully refreshes active policies.');

    // -------------------------------------------------------------------------
    // TEST 4: Multi-Dimensional Residency Routing
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Multi-Dimensional Residency Routing ---');
    const residencyMH = ResidencyService.resolveResidency('IN', 'MH', 'PUNE');
    assert(residencyMH.regulatoryJurisdiction === 'IN-DPDP-MH', 'Geopolitical regulation mapped correctly.');
    assert(residencyMH.storageZone === 'sovereign-mh-pune-s3', 'Sovereign storage zone routed correctly.');
    assert(residencyMH.backupRegion === 'sovereign-mh-mumbai-s3', 'Backup region routed within borders.');

    const validationValid = ResidencyService.validateResidency(residencyMH, { country: 'IN', state: 'MH' });
    assert(validationValid.isValid === true, 'Residency matches tenant boundaries.');

    const validationInvalid = ResidencyService.validateResidency(residencyMH, { country: 'IN', state: 'KA' });
    assert(validationInvalid.isValid === false, 'Cross-state residency violation correctly identified.');

    // -------------------------------------------------------------------------
    // TEST 5: Platform Version Governance
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Platform Version Governance ---');
    const matrix = VersionRegistryService.getActiveVersionMatrix();
    assert(matrix.platformVersion === '2.0.0', 'Platform version tracked.');
    assert(matrix.prismaClientVersion === '5.22.0', 'Prisma client version tracked.');
    assert(matrix.securityPolicyVersion === 'security-policy:4.0', 'Security policy version tracked.');

    const snapshotHash = await VersionRegistryService.registerSnapshot(matrix);
    assert(snapshotHash.length === 64, 'Platform version matrix successfully hashed (SHA256).');

    const retrievedMatrix = await VersionRegistryService.getSnapshotByHash(snapshotHash);
    assert(retrievedMatrix?.platformVersion === '2.0.0', 'Version snapshot successfully retrieved from VersionGovernanceRegistry.');

    // -------------------------------------------------------------------------
    // TEST 6: Cross-Tenant Isolation Verification (Zero Leakage)
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Cross-Tenant Isolation Verification ---');

    // Isolation Test 1: Zero Cross-Tenant Reads
    // Run under Tenant A context, try to find Tenant B document
    const readLeakResult = await tenantContextStorage.run({ tenantId: tenantAId }, async () => {
      return prisma.document.findUnique({
        where: { documentId: docBId }
      });
    });
    assert(readLeakResult === null, 'Tenant boundary successfully blocks cross-tenant reads (returned null).');

    // Isolation Test 2: Zero Cross-Tenant Writes
    // Run under Tenant A context, try to update Tenant B document
    let writeLeakFailed = false;
    try {
      await tenantContextStorage.run({ tenantId: tenantAId }, async () => {
        return prisma.document.update({
          where: { documentId: docBId },
          data: { title: 'Hacked Title' }
        });
      });
    } catch (e) {
      writeLeakFailed = true;
    }
    assert(writeLeakFailed === true, 'Tenant boundary successfully blocks cross-tenant updates.');

    // Isolation Test 3: Zero Cross-Tenant Search Leakage
    const searchLeakResult = await tenantContextStorage.run({ tenantId: tenantAId }, async () => {
      return prisma.document.findMany({
        where: { title: { contains: 'Land Record' } }
      });
    });
    assert(searchLeakResult.length === 0, 'Tenant boundary successfully blocks cross-tenant search leakage.');

    // Clean up test data from database
    await basePrisma.document.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await basePrisma.user.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await basePrisma.policyRule.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });
    await basePrisma.tenant.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } }
    });

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`Test Execution Finished: ${passed} Passed, ${failed} Failed.`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
