# API Flow Mapping - Legal TimeLock Network (LTN)

This document details the step-by-step API flows, tracking client-side requests, input validation, database operations, and blockchain relayer execution paths.

---

## 1. Flow: Document Upload & Registration

### Endpoint: `POST /v1/documents`

1. **Client Action**: Citizen fills in title, type, assigns notary, and uploads PDF/image. Client computes SHA-256 and sends it in payload headers/body.
2. **Input Validation**:
   - Backend interceptor runs `Zod` schema validation on fields (e.g., ensuring `title` is not empty, `notaryId` is a valid UUID format, `clientHash` is a valid 64-character hexadecimal SHA-256).
   - Rejects with `400 Bad Request` if validation fails.
3. **Malware Scan & Server-Side Hash**:
   - Uploaded file buffer is routed to a file scanner mock.
   - `HashService.generateSHA256()` computes the hash server-side.
   - Rejects with `400 Bad Request` if computed hash does not match the client-supplied hash (ensures integrity during upload).
4. **Decentralized Storage Commit**:
   - Backend calls `StorageService.upload()` to write the document to Pinata (IPFS) in an encrypted format.
   - Retrieves the IPFS Content Identifier (CID).
5. **Database Transaction (Pre-chain)**:
   - Backend opens a database transaction.
   - Inserts record into `documents` table:
     - `status`: `'pending'`
     - `content_hash`: `serverHash`
     - `cid`: `ipfsCid`
     - `owner_user_id`: `req.user.userId`
   - Commits transaction.
6. **Solana PDA Commitment**:
   - Backend invokes the `blockchain` module's `initializeDocument` function.
   - Computes derived Program Derived Address (PDA) seed using `sha256(document_id)`.
   - Relayer authority signs and pays transaction fee on Solana Devnet.
   - Awaits RPC confirmation.
7. **Database Transaction (Post-chain)**:
   - Backend receives transaction signature.
   - Updates `documents` table:
     - `status`: `'onchain_confirmed'`
     - `onchain_tx_signature`: `solanaTxSig`
   - Inserts row to `verification_events`:
     - `event_type`: `'registration_confirmed'`
8. **Client Response**: Returns `201 Created` with the JSON payload including `documentId`, `hash`, `cid`, `status`, and `txSignature`.

---

## 2. Flow: Notary Document Signing

### Endpoint: `POST /v1/documents/:id/signatures`

1. **Client Action**: Notary plugs in Class 3 DSC token, verifies hash in dashboard, inputs PIN, generates signature, and posts payload.
2. **Input Validation**:
   - Validates document `id` is UUID.
   - Validates `signatureBytes` (Base64) and `certSerial` are present.
3. **Signature Verification**:
   - Calls `HashService.verifySignature()` to confirm the signature is cryptographically bound to the document's registered SHA-256 hash.
   - Rejects with `400 Bad Request` if validation fails.
4. **Solana Program Sign Commit**:
   - Calls `blockchain` module's `recordSignature` function.
   - Derives PDA address for `SignatureRecord` using seed `["signature", document_pda, role_byte]`.
   - Transmits transaction to Solana cluster.
5. **Database Update**:
   - Inserts signature record into `signatures` table.
   - Updates `documents` table:
     - `status`: `'notary_signed'` (or `'fully_executed'` if multi-sig threshold is met).
   - Inserts row to `verification_events` with type `'notary_signed'`.
6. **Client Response**: Returns `200 OK` with updated status.

---

## 3. Flow: Verify Re-Uploaded File

### Endpoint: `POST /v1/documents/:id/verify`

1. **Client Action**: Verifier uploads scanned copy of document to check for modifications.
2. **Hash & Risk Analysis**:
   - Centralized `HashService` hashes the submitted document.
   - Backend queries the `documents` table (or Solana PDA directly if cache misses) to retrieve the expected hash.
   - Calls `HashService.compareHashes()`.
3. **Fraud Engine Check**:
   - Calls `FraudService.calculateRiskScore()`:
     - If hashes mismatch, assigns `riskScore = 100` (tampered).
     - Otherwise, reviews metadata to check for missing notary signatures (`80` risk), missing Solana transactions (`90` risk), or expired status.
4. **Timeline Audit Log**:
   - Inserts row to `verification_events` containing the verifier's user ID (or label `'anonymous'`), event status (e.g. `'VERIFICATION_SUCCESS'` or `'VERIFICATION_TAMPER_DETECTED'`), and timestamp.
5. **Client Response**: Returns `200 OK` showing matching result, risk score, and detailed timeline.
