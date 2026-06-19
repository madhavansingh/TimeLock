# Legal TimeLock Network
## Software Requirements Specification (SRS)

### Document Control

| Field | Value |
|---|---|
| Document Title | Software Requirements Specification — Legal TimeLock Network (LTN) |
| Version | 2.0 — Industry Release |
| Conformance | Structured per IEEE 830 / ISO-IEC-IEEE 29148 conventions; NFRs organized per ISO/IEC 25010 quality model |
| Status | Draft for Engineering & QA Review |
| Related Documents | `01_product_requirements_document.md`, `03_system_design_document.md`, `04_implementation_plan.md` |

---

## Table of Contents

1. Introduction
2. Overall Description
3. External Interface Requirements
4. Functional Requirements
5. Use Case Specifications
6. Data Requirements
7. Non-Functional Requirements (ISO/IEC 25010)
8. Other Requirements (Legal & Regulatory)
9. Appendix A — Requirement Traceability Matrix
10. Appendix B — Glossary & Acronyms

---

## 1. Introduction

### 1.1 Purpose
This SRS specifies the functional and non-functional requirements for Legal TimeLock Network (LTN), translating the product intent in the PRD into testable, implementation-ready requirements. It is written for engineering, QA, and security review.

### 1.2 Scope
LTN covers: document ingestion and hashing; on-chain timestamp commitment; QR-based public verification; notary digital signature workflow; tamper detection; chain-of-custody logging; institutional dashboards; and the bonus capabilities (IPFS storage, fraud scoring, multi-signature approval). Out of scope: stamp duty collection, legal registration filing, contract drafting/AI clause review (see PRD §5.3).

### 1.3 Definitions, Acronyms, Abbreviations
See Appendix B. Key terms: **PDA** (Program Derived Address), **DSC** (Digital Signature Certificate), **CCA** (Controller of Certifying Authorities), **RPC** (Remote Procedure Call, used for Solana cluster communication), **CU** (Compute Unit, Solana's transaction execution cost metric).

### 1.4 References
- PRD: `01_product_requirements_document.md`
- Information Technology Act, 2000 (India), Sections 4, 5, 65B-equivalent provisions as incorporated in the Indian Evidence Act, 1872
- Digital Personal Data Protection Act, 2023 (India)
- ISO/IEC 25010:2011 — Systems and software Quality Requirements and Evaluation (SQuaRE)
- Solana Program Library and Anchor Framework documentation

### 1.5 Overview
Section 2 describes the product context; Section 3 the external interfaces; Section 4 the numbered functional requirements; Section 5 illustrative use cases; Section 6 the data dictionary; Section 7 the non-functional requirements; Section 8 legal/regulatory requirements; Appendices provide traceability and glossary.

---

## 2. Overall Description

### 2.1 Product Perspective
LTN is a standalone web/mobile platform with a public verification surface and an authenticated institutional surface, backed by a relational database, a cache layer, an off-chain document/encrypted-blob store, and a Solana on-chain program. It does not depend on any single external legal system but is designed to interoperate with e-Stamping (SHCIL) and DSC infrastructure already in use by Indian notaries.

### 2.2 Product Functions (Summary)
Document upload & hashing; on-chain timestamp commitment; notary signature capture and verification; QR generation/scanning; tamper detection on re-verification; chain-of-custody logging; institutional dashboard with search/export; fraud risk scoring; multi-signature workflow; encrypted off-chain storage via IPFS; audit logging; notifications.

### 2.3 User Characteristics
Ranges from non-technical citizens (mobile-first, OTP auth, no blockchain literacy assumed) to technical institutional integrators (API consumers). The system must never require an end user to hold or understand a cryptocurrency wallet.

### 2.4 Constraints
- No document content or personally identifiable information may be written on-chain (PRD §9, F-01).
- Notary signing requires a CCA-compliant Class 3 DSC hardware token; software-only certificates are not permitted for production notary signing.
- All citizen/PII data at rest must reside in AWS ap-south-1 (Mumbai) per data-residency requirements anticipated under the DPDP Act, 2023.
- Solana cluster usage progresses devnet → testnet → mainnet-beta, gated by the security audit milestone (Implementation Plan, Phase 3).

### 2.5 Assumptions & Dependencies
See PRD §12. Additionally: SRS assumes Node.js/TypeScript backend runtime, Anchor ≥ 0.30 program framework, and Postgres ≥ 15.

---

## 3. External Interface Requirements

### 3.1 User Interfaces
- **Citizen Web/Mobile App:** document upload, QR display/scan, status view, notification center. Must meet WCAG 2.1 AA accessibility minimums.
- **Notary Console:** signing queue, DSC token interaction prompt, signed-document history.
- **Institutional Dashboard (Bank/Court):** search/filter, single and bulk verification, chain-of-custody viewer, export (PDF/CSV).
- **Admin Console:** notary onboarding/offboarding, API key management, fraud-rule configuration, audit log viewer.

### 3.2 Hardware Interfaces
- USB/PKCS#11-compliant DSC hardware token reader (notary signing workstation).
- Device camera (citizen/institutional mobile QR scanning).

### 3.3 Software Interfaces
- **Solana RPC endpoint(s):** transaction submission, account queries; must support failover across ≥ 2 RPC providers.
- **IPFS pinning service** (e.g., a managed pinning provider) for F-08 encrypted blob storage.
- **SMS/Email gateway** for OTP and notifications (F-12), India-compliant sender ID registration (TRAI DLT for SMS).
- **Optional e-KYC interface** (e.g., DigiLocker-based) for stronger institutional/notary identity verification at Beta phase.

### 3.4 Communication Interfaces
- REST over HTTPS (TLS 1.2 minimum, TLS 1.3 preferred) for all client-server communication.
- WebSocket or Server-Sent Events channel for real-time status updates (e.g., live signature-collection progress for multi-sig documents).

---

## 4. Functional Requirements

Each requirement is traceable to a PRD Feature ID. Priority: **M**ust / **S**hould / **C**ould (MoSCoW).

### 4.1 Document Ingestion & Hashing (→ F-02)

| ID | Requirement | Priority |
|---|---|---|
| FR-02.1 | The system shall accept document uploads in PDF, JPG, and PNG formats up to a configurable maximum size (default 25 MB). | M |
| FR-02.2 | The system shall compute a SHA-256 hash of the uploaded file content, computed client-side where the client environment supports it, and re-verified server-side. | M |
| FR-02.3 | For multi-page documents, the system shall compute per-page hashes and a composite Merkle root hash. | S |
| FR-02.4 | The system shall reject uploads that fail virus/malware scanning before hashing proceeds. | M |
| FR-02.5 | The system shall generate and persist a unique, non-sequential Document ID (UUID v4 or equivalent) at upload time. | M |

### 4.2 Blockchain Timestamp Commitment (→ F-01)

| ID | Requirement | Priority |
|---|---|---|
| FR-01.1 | The system shall submit a transaction to the configured Solana cluster containing the document hash, a UTC timestamp, and an initial status, via a dedicated Anchor program. | M |
| FR-01.2 | The system shall derive the on-chain account address deterministically as a PDA seeded by the Document ID, avoiding reliance on a per-document keypair. | M |
| FR-01.3 | The system shall poll for transaction confirmation and update the document's status to "On-Chain Confirmed" only after the cluster reports finalized (or, where configured, confirmed) commitment level. | M |
| FR-01.4 | On RPC failure or transaction drop, the system shall retry submission with exponential backoff up to a configurable retry ceiling, without altering the original client-observed upload timestamp recorded off-chain. | M |
| FR-01.5 | The system shall NOT store document content, filenames, or any personally identifiable information in any on-chain account. | M |

### 4.3 QR Verification (→ F-03)

| ID | Requirement | Priority |
|---|---|---|
| FR-03.1 | The system shall generate a QR code encoding a signed, time-bound verification token and Document ID, not the raw hash. | M |
| FR-03.2 | The system shall expose a public verification URL that resolves the token to current status, timestamp, and (where the document owner has opted to make it public) notary detail, without requiring authentication. | M |
| FR-03.3 | The system shall apply QR error-correction level Q or H to remain scannable after standard photocopying/print degradation. | S |
| FR-03.4 | Every successful or failed scan-to-verification event shall be appended to the chain of custody (→ FR-06.x). | M |

### 4.4 Notary Digital Signature (→ F-04)

| ID | Requirement | Priority |
|---|---|---|
| FR-04.1 | The system shall require notary authentication via a CCA-compliant Class 3 DSC hardware token before allowing a signing action. | M |
| FR-04.2 | The system shall bind the resulting signature cryptographically to the specific document hash and timestamp pair, rejecting signature submission if the hash has changed since the signing request was issued. | M |
| FR-04.3 | The system shall record the notary's certificate validity status (active/expired/revoked) as observed *at the moment of signing*, independent of its status at later verification time. | M |
| FR-04.4 | The system shall expose notary public key/certificate chain data for independent third-party signature verification. | S |

### 4.5 Tamper Detection (→ F-05)

| ID | Requirement | Priority |
|---|---|---|
| FR-05.1 | On verification submission, the system shall recompute the hash of the submitted document and compare it against the stored on-chain hash for the claimed Document ID. | M |
| FR-05.2 | A match shall result in status "Authentic — Unmodified" with original timestamp and notary chain returned. | M |
| FR-05.3 | A mismatch shall result in status "Modified — Hash Mismatch," logged with detection timestamp, without altering the original on-chain record. | M |
| FR-05.4 | Every verification attempt (match or mismatch) shall itself generate a chain-of-custody event (→ FR-06.x). | M |

### 4.6 Chain of Custody (→ F-06)

| ID | Requirement | Priority |
|---|---|---|
| FR-06.1 | The system shall maintain an append-only Verification Events log per document, enforced at the database constraint level (no UPDATE/DELETE permitted on historical rows). | M |
| FR-06.2 | Each event shall record: event type, actor (user ID or "anonymous"), timestamp, and related on-chain transaction reference where applicable. | M |
| FR-06.3 | The system shall expose the full chain of custody to authorized institutional users and a redacted/summarized view to public QR scanners. | M |

### 4.7 Verification Dashboard (→ F-07)

| ID | Requirement | Priority |
|---|---|---|
| FR-07.1 | Authenticated institutional users shall be able to search documents by Document ID, date range, status, and notary. | M |
| FR-07.2 | The dashboard shall support bulk export (CSV/PDF) of search results and individual chain-of-custody reports. | S |
| FR-07.3 | Every dashboard access to a specific document's data shall itself be logged as a chain-of-custody event. | M |

### 4.8 IPFS Storage (→ F-08)

| ID | Requirement | Priority |
|---|---|---|
| FR-08.1 | The system shall, where the document owner opts in, encrypt the document client-side or server-side with a per-document key prior to upload to IPFS. | S |
| FR-08.2 | The system shall store only the resulting Content Identifier (CID) and a reference to (not the value of) the decryption key in its database. | S |
| FR-08.3 | Document retrieval via CID alone (without an authorized LTN decryption request) shall yield ciphertext only. | S |

### 4.9 Fraud Risk Score Engine (→ F-09)

| ID | Requirement | Priority |
|---|---|---|
| FR-09.1 | The system shall compute a Fraud Risk Score (0–100) per document based on configurable weighted rules, including metadata/timestamp inconsistency, notary certificate validity, and repeated failed verifications. | S |
| FR-09.2 | The system shall surface the contributing signals alongside the score, not the score alone. | S |
| FR-09.3 | Score computation and updates shall be logged as chain-of-custody events. | S |

### 4.10 Multi-Signature Approval (→ F-10)

| ID | Requirement | Priority |
|---|---|---|
| FR-10.1 | The system shall support configuring an N-of-M signer requirement per document (e.g., 3-of-3: buyer, seller, notary). | S |
| FR-10.2 | The system shall block transition to "Fully Executed" status until the configured threshold of valid signatures is recorded on-chain or in the signature ledger. | S |
| FR-10.3 | Partial signature state (e.g., "2/3 signed") shall be visible on both institutional and public verification surfaces. | S |

### 4.11 Identity & Access Management (→ F-11)

| ID | Requirement | Priority |
|---|---|---|
| FR-11.1 | The system shall authenticate citizens via OTP (SMS/email) with a 5-minute expiry and a 3-attempt lockout threshold. | M |
| FR-11.2 | The system shall authenticate notaries via Class 3 DSC hardware token challenge-response, not password alone. | M |
| FR-11.3 | The system shall authenticate institutional (bank/court) users via credentials plus MFA, with role-based access control enforced server-side for every protected action. | M |
| FR-11.4 | Institutional sessions shall expire after a configurable idle period (default 15 minutes). | S |

### 4.12 Notifications (→ F-12)

| ID | Requirement | Priority |
|---|---|---|
| FR-12.1 | The system shall send notifications for: registration confirmation, signature requests, tamper-detection alerts, and status changes, via SMS, email, or push. | S |
| FR-12.2 | Tamper-detection alerts shall be delivered to the registered document owner within the latency budget in §7.2. | S |

### 4.13 Audit Logging (→ F-13)

| ID | Requirement | Priority |
|---|---|---|
| FR-13.1 | The system shall maintain a separate, append-only administrative audit log capturing notary onboarding/offboarding, API key issuance/revocation, and fraud-rule changes. | M |
| FR-13.2 | Audit log entries shall be exportable but not deletable through any application-layer interface, including by administrator roles. | M |

### 4.14 Public Verification API (→ F-14)

| ID | Requirement | Priority |
|---|---|---|
| FR-14.1 | The system shall expose a documented REST API for institutional verification queries, authenticated via issued API keys. | C |
| FR-14.2 | API requests shall be rate-limited per key with configurable thresholds and burst handling. | C |

### 4.15 Section 65B Certificate Generator (→ F-15)

| ID | Requirement | Priority |
|---|---|---|
| FR-15.1 | The system shall generate a certificate describing the electronic record's production process and responsible party, structured to align with Section 65B(4), Indian Evidence Act, 1872, subject to legal review of the template. | S |
| FR-15.2 | The certificate output shall include a clear disclaimer that it supports, but does not itself guarantee, admissibility, and that legal counsel should be consulted. | M |

---

## 5. Use Case Specifications

### UC-01: Register a Document
- **Actor:** Citizen
- **Preconditions:** Citizen authenticated via OTP.
- **Main Flow:** 1) Citizen uploads document. 2) System scans for malware. 3) System computes SHA-256 hash. 4) System submits hash+timestamp to Solana program. 5) System awaits confirmation. 6) System generates QR code. 7) System notifies citizen of successful registration.
- **Alternate Flow (RPC failure at step 4):** System queues transaction, shows "Pending" status, retries per FR-01.4.
- **Postcondition:** Document status = "On-Chain Confirmed"; QR code available.

### UC-02: Notary Signs a Document
- **Actor:** Notary
- **Preconditions:** Notary onboarded with valid Class 3 DSC; document already registered (UC-01 complete).
- **Main Flow:** 1) Notary opens signing queue. 2) Notary selects document, reviews hash/metadata. 3) Notary's DSC token is challenged. 4) Notary enters token PIN. 5) System binds signature to hash+timestamp. 6) System records signature and updates chain of custody.
- **Exception Flow:** If hash has changed since the signing request was generated (e.g., a newer version was re-registered under a different Document ID), system rejects the signature and alerts the notary.

### UC-03: Bank Verifies a Document
- **Actor:** Bank Officer
- **Preconditions:** Authenticated institutional session.
- **Main Flow:** 1) Officer scans QR or enters Document ID. 2) System re-hashes any submitted file (if verifying a physical re-scan) or fetches on-chain record (if verifying status only). 3) System compares hashes if applicable. 4) System displays status, timestamp, notary chain, and fraud score. 5) Officer exports report to loan file.
- **Exception Flow:** Hash mismatch → system displays "Modified" with full chain of custody and triggers a notification per FR-12.2.

### UC-04: Multi-Party Signature Collection
- **Actor:** Buyer, Seller, Notary
- **Preconditions:** Document registered with a 3-of-3 multi-sig requirement (F-10).
- **Main Flow:** 1) Each party receives a signing request notification. 2) Each party authenticates and signs independently. 3) System tracks partial state (e.g., 2/3). 4) On the third valid signature, system transitions status to "Fully Executed" and updates the public QR page.

### UC-05: Court Requests Evidence Package
- **Actor:** Lawyer / Court Clerk
- **Main Flow:** 1) User retrieves chain-of-custody report for a Document ID. 2) User requests Section 65B-aligned certificate generation (F-15). 3) System produces the certificate and verification report bundle for export.

---

## 6. Data Requirements

### 6.1 Data Dictionary (key entities — full schema in SDD §Database Design)

| Entity | Key Fields | PII? | Notes |
|---|---|---|---|
| Document | document_id, hash, merkle_root, status, created_at | No (hash is not reversible to content) | On-chain reference stored here |
| Citizen/User | user_id, phone/email (hashed at rest), role | Yes | Subject to DPDP Act data-fiduciary obligations |
| Notary | notary_id, name, dsc_certificate_serial, public_key | Yes (name) | Public key may be publicly exposed for verification; name handling reviewed for minimal necessary disclosure |
| Verification Event | event_id, document_id, event_type, actor_ref, timestamp | Conditional | Actor may be anonymized for public scans |
| Fraud Score | document_id, score, signals (JSON), computed_at | No | |
| IPFS Reference | document_id, cid, key_reference | No (CID not reversible without key) | |

### 6.2 Data Retention
- On-chain data: permanent by design (Solana ledger immutability).
- Off-chain PII: retained per DPDP Act-aligned retention schedule, deletable on valid erasure request *except* where retention is required for legal/audit purposes (chain-of-custody integrity is preserved even if the associated PII is subsequently minimized/redacted).

### 6.3 Data Classification
- **Public:** Document ID, hash, on-chain timestamp, verification status (by design, since these underlie public QR verification).
- **Restricted:** Notary identity detail, citizen contact information, fraud score signals.
- **Confidential:** Decryption keys, DSC private key material (never stored by LTN in any form), API keys.

---

## 7. Non-Functional Requirements (ISO/IEC 25010)

### 7.1 Functional Suitability
Covered by Section 4 functional requirements and their acceptance criteria in the PRD.

### 7.2 Performance Efficiency

| Metric | Target |
|---|---|
| Verification request latency | p50 < 1.5s, p95 < 3s, p99 < 5s at 500 concurrent requests |
| Registration end-to-end (excluding on-chain finality wait) | p95 < 5s |
| On-chain confirmation wait (UX-surfaced as "Pending") | Typically sub-second to a few seconds at "confirmed" commitment level, displayed asynchronously, not blocking the UI |
| Dashboard search response | p95 < 2s for result sets up to 10,000 rows with pagination |
| Throughput | Sustain 100,000 document registrations/day at GA scale without horizontal scale-out beyond the architecture defined in the SDD |

### 7.3 Compatibility
REST API versioned (`/v1/`); QR verification page must render on browsers supporting evergreen web standards from the last 2 major versions of Chrome, Safari, Firefox, Edge, and on Android/iOS default browsers.

### 7.4 Usability
WCAG 2.1 AA minimum for citizen-facing surfaces; verification result page must communicate status (Authentic / Modified / Pending) within 2 seconds of page load without requiring the user to interpret blockchain terminology.

### 7.5 Reliability
- Availability: 99.9% for the verification path, 99.5% for registration (allows for planned maintenance windows on the heavier ingestion path).
- Recovery Time Objective (RTO): 1 hour for the off-chain platform (the on-chain ledger itself does not require "recovery" — it is independently persisted by the Solana network).
- Recovery Point Objective (RPO): 5 minutes for off-chain database (continuous WAL shipping/point-in-time recovery).

### 7.6 Security
- Encryption in transit: TLS 1.2 minimum, TLS 1.3 preferred, for all client-server and server-server communication.
- Encryption at rest: AES-256 for database and object storage volumes.
- Authentication: per FR-11.x.
- Key management: notary/DSC private keys never touch LTN infrastructure; document encryption keys (F-08) managed via a dedicated key-management service (KMS), never stored alongside the encrypted blob.
- The system shall undergo an independent security assessment (including the Anchor program) before any mainnet-beta deployment, per the Implementation Plan.

### 7.7 Maintainability
Backend services organized as independently deployable modules (Document, Verification, QR, Notary, Fraud, Notification) per the SDD component design, each with isolated test suites and ≥ 80% unit test coverage target.

### 7.8 Portability
Containerized services (Docker) deployable across at minimum one cloud provider with a documented migration path; Solana program logic is cluster-agnostic (devnet/testnet/mainnet-beta) by configuration only.

---

## 8. Other Requirements — Legal & Regulatory

| Requirement | Basis |
|---|---|
| No PII or document content stored on-chain | Privacy-by-design; supports DPDP Act 2023 data-minimization expectations |
| Notary signature must use CCA-licensed Class 3 DSC | IT Act, 2000 framework for legally recognized digital signatures; CCA discontinued Class 2 DSC issuance, leaving Class 3 as the applicable individual-assurance class |
| Section 65B-aligned certificate availability | Indian Evidence Act, 1872 — courts have held (e.g., in subsequent interpretations following *Anvar P.V. v. P.K. Basheer* and *Arjun Panditrao Khotkar v. Kailash Kushanrao Goratyal*) that a certificate is generally required to admit electronic record evidence; LTN supports but does not guarantee admissibility |
| Data residency in India | Anticipated DPDP Act 2023 and sectoral (e.g., RBI) data-localization expectations for financial-sector counterparties |

> All items in this section require confirmation by qualified legal counsel prior to go-live; this SRS records the *engineering requirement to design for* these constraints, not a legal compliance certification.

---

## 9. Appendix A — Requirement Traceability Matrix

| PRD Feature | SRS Requirements | SDD Component | Implementation Plan Reference |
|---|---|---|---|
| F-01 | FR-01.1–FR-01.5 | COMP-03 (Blockchain Service), Solana Program | Phase 1 (MVP) |
| F-02 | FR-02.1–FR-02.5 | COMP-01 (Document Service) | Phase 1 (MVP) |
| F-03 | FR-03.1–FR-03.4 | COMP-04 (QR Service) | Phase 1 (MVP) |
| F-04 | FR-04.1–FR-04.4 | COMP-05 (Notary Service) | Phase 1 (MVP) |
| F-05 | FR-05.1–FR-05.4 | COMP-02 (Verification Service) | Phase 1 (MVP) |
| F-06 | FR-06.1–FR-06.3 | COMP-02, COMP-08 (Audit Service) | Phase 1 (MVP) |
| F-07 | FR-07.1–FR-07.3 | COMP-06 (Dashboard/API Gateway) | Phase 1 (MVP) |
| F-08 | FR-08.1–FR-08.3 | COMP-07 (Storage Service) | Phase 2 (Pilot) |
| F-09 | FR-09.1–FR-09.3 | COMP-09 (Fraud Engine) | Phase 2 (Pilot) |
| F-10 | FR-10.1–FR-10.3 | COMP-05 (Notary/Signature Service) | Phase 2 (Pilot) |
| F-11 | FR-11.1–FR-11.4 | COMP-10 (Auth Service) | Phase 1 (MVP) |
| F-12 | FR-12.1–FR-12.2 | COMP-11 (Notification Service) | Phase 2 (Pilot) |
| F-13 | FR-13.1–FR-13.2 | COMP-08 (Audit Service) | Phase 2 (Pilot) |
| F-14 | FR-14.1–FR-14.2 | COMP-06 (API Gateway) | Phase 3 (Beta) |
| F-15 | FR-15.1–FR-15.2 | COMP-12 (Legal Document Generator) | Phase 2 (Pilot) |

---

## 10. Appendix B — Glossary & Acronyms

See PRD Appendix A for the master glossary. Additional engineering acronyms used here: **WAL** (Write-Ahead Log), **MFA** (Multi-Factor Authentication), **KMS** (Key Management Service), **SQuaRE** (Software product Quality Requirements and Evaluation, ISO/IEC 25010's parent series).
