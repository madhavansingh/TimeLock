# Sequence Diagrams - Legal TimeLock Network (LTN)

This document contains sequence diagrams detailing the communication and data flows between the Frontend Client, Backend API Gateway/Services, Database, IPFS, and Solana cluster.

---

## 1. Document Upload & Registration Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen Client
    participant FE as Frontend Client
    participant BE as Backend Server
    participant DB as Postgres Database
    participant IPFS as Pinata IPFS
    participant SOL as Solana Program (Anchor)

    Citizen->>FE: Select file & select Notary ID
    FE->>FE: Compute SHA-256 client-side
    FE->>BE: POST /v1/documents (file, metadata, clientHash)
    Note over BE: Validate inputs via shared/validation schema
    BE->>BE: Run malware scan on file
    BE->>BE: Recompute SHA-256 (serverHash) & verify clientHash == serverHash
    BE->>IPFS: Upload encrypted document bytes
    IPFS-->>BE: Return CID (Content Identifier)
    BE->>DB: INSERT into documents (status=PENDING, content_hash=serverHash, cid)
    BE->>SOL: initialize_document(document_id_hash, content_hash, authority)
    Note over SOL: Check derived PDA doesn't already exist
    SOL-->>BE: Confirmed (Solana Tx Signature, Slot)
    BE->>DB: UPDATE document status=ONCHAIN_CONFIRMED, tx_signature
    BE-->>FE: Return document_id, hash, status=ONCHAIN_CONFIRMED, txSignature
    FE->>BE: GET /v1/documents/{id}/qr
    BE->>BE: Generate QR code image with signed verification URL token
    BE-->>FE: Return QR code image
    FE-->>Citizen: Display Success screen & printable QR code
```

---

## 2. Notary Signing Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Notary as Notary Public
    participant FE as Notary Dashboard
    participant BE as Backend Server
    participant DB as Postgres Database
    participant SOL as Solana Program (Anchor)

    Notary->>FE: Insert Class 3 DSC USB Token & Open Queue
    FE->>BE: GET /v1/notaries/queue (bearer JWT token)
    BE->>DB: Fetch pending documents assigned to Notary
    DB-->>BE: List documents
    BE-->>FE: Display pending documents queue
    Notary->>FE: Click "Sign Document" on selected item
    FE->>BE: GET /v1/documents/{id}
    BE-->>FE: Return Document Details (hash, metadata)
    FE->>FE: Local workstation prompts for DSC PIN entry
    Notary->>FE: Enter PIN
    FE->>FE: DSC token signs the document hash cryptographically
    FE->>BE: POST /v1/documents/{id}/signatures (signatureBytes, certSerial)
    Note over BE: Centralized HashService validates signature matches doc hash
    BE->>SOL: record_signature(role=NOTARY, signer_pubkey, offChainCertRef)
    SOL-->>BE: Signature written in PDA & signer_count incremented
    BE->>DB: INSERT into signatures (notary_id, signature_bytes, signed_at)
    BE->>DB: UPDATE document status=NOTARY_SIGNED
    BE->>DB: INSERT into verification_events (event_type=NOTARY_SIGNED)
    BE-->>FE: Return status=NOTARY_SIGNED, updated Timeline
    FE-->>Notary: Show signature recorded confirmation
```

---

## 3. Document Verification & Tamper Detection Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Verifier as Verifier (Bank / Court / Public)
    participant FE as Verification Client
    participant BE as Backend Server
    participant DB as Postgres Database
    participant SOL as Solana Program (Anchor)

    Verifier->>FE: Scan QR / Input Document ID
    FE->>BE: GET /v1/documents/{id}/status
    Note over BE: Check Redis Cache for document status
    BE->>DB: Fetch document registry (hash, status, signature, tx)
    DB-->>BE: Return metadata
    BE-->>FE: Display status (e.g. AUTHENTIC, PENDING)
    
    rect rgb(240, 240, 240)
        Note over Verifier, FE: Optional: Upload physical scanned file to detect tampering
        Verifier->>FE: Upload physical scanned document
        FE->>BE: POST /v1/documents/{id}/verify (file upload)
        BE->>BE: Centralized HashService computes upload hash
        BE->>SOL: Get Document PDA account details
        SOL-->>BE: Return registered on-chain hash
        BE->>BE: Centralized HashService compares upload hash with on-chain hash
        alt Hashes Match (Authentic)
            BE->>DB: INSERT into verification_events (event_type=VERIFICATION_SUCCESS, status=AUTHENTIC)
            BE-->>FE: Return result=AUTHENTIC, risk_score=0 (LOW)
        else Hashes Mismatch (Tampered)
            BE->>DB: INSERT into verification_events (event_type=VERIFICATION_TAMPER_DETECTED, status=TAMPERED)
            BE->>DB: UPDATE document status=DISPUTED
            BE->>BE: Trigger SMS/Email notifications to owner (tamper alert)
            BE-->>FE: Return result=TAMPERED, risk_score=100 (HIGH), expected/submitted hashes
        end
    end
    FE-->>Verifier: Display verification result & timeline
```
