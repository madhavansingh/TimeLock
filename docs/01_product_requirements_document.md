# Legal TimeLock Network
## Product Requirements Document (PRD)

### Document Control

| Field | Value |
|---|---|
| Document Title | Product Requirements Document — Legal TimeLock Network (LTN) |
| Version | 2.0 — Industry Release |
| Status | Draft for Stakeholder Review |
| Owner | Product Management |
| Audience | Engineering, Design, Legal & Compliance, Notary Partnerships, Banking Partners, Judiciary Liaison, Executive Sponsors |
| Related Documents | `02_software_requirements_specification.md`, `03_system_design_document.md`, `04_implementation_plan.md` |
| Classification | Internal — Confidential |

### Revision History

| Version | Description |
|---|---|
| 0.1 | Hackathon concept note (KLEOS Hackathon 2026) — feature brainstorm |
| 1.0 | Hackathon MVP scope freeze — 7 core + 3 bonus features |
| 2.0 | Industry-grade expansion: personas, traceable requirements, KPIs, compliance mapping, phased roadmap, risk framework |

> **Note on legal content:** Sections referencing the Indian Evidence Act, IT Act 2000, DPDP Act 2023, and Controller of Certifying Authorities (CCA) rules describe the *regulatory context the product must design around*. They are not legal advice. Every compliance-sensitive feature must receive sign-off from qualified legal counsel before release.

---

## Table of Contents

1. Purpose of this Document
2. Executive Summary
3. Background & Problem Statement
4. Product Vision & Strategic Fit
5. Goals, Objectives & Non-Goals
6. Target Users & Personas
7. Core User Journeys
8. Functional Scope Overview
9. Detailed Feature Specifications
10. Non-Functional Requirements (Summary)
11. Success Metrics & KPIs
12. Assumptions & Dependencies
13. Risks & Mitigations
14. Release Strategy & Phasing
15. Open Questions & Future Considerations
16. Appendix A — Glossary
17. Appendix B — Requirement Traceability Index

---

## 1. Purpose of this Document

This PRD defines **what** Legal TimeLock Network (LTN) must do and **why**, for every audience that has to build, fund, regulate, or adopt it. It is the single source of truth that the Software Requirements Specification (SRS) decomposes into testable requirements, that the System Design Document (SDD) implements architecturally, and that the Implementation Plan schedules into delivery phases. Every feature in this document carries a unique ID (`F-xx`) that is traced through the other three documents so that a reviewer can follow a single capability from business intent to shipped code.

---

## 2. Executive Summary

Legal TimeLock Network is a verification infrastructure layer for physical legal documents — sale deeds, loan agreements, affidavits, powers of attorney, and notarized contracts — that are still executed on paper or as scanned images across India. LTN does not replace the paper instrument or the registration process; it sits alongside the existing legal workflow and produces an independently verifiable, tamper-evident, timestamped digital fingerprint of the document at the moment of execution, anchored on the Solana blockchain.

The product gives four constituencies a capability they do not reliably have today:

- **Citizens** get a way to prove a document existed, unmodified, at a specific point in time, without needing to understand blockchain technology.
- **Notaries** get a digital signing workflow that is cryptographically bound to the document hash rather than a physical stamp that can be forged or reused.
- **Banks** get a fast, auditable way to check whether a mortgage or loan document has been altered after disbursal-time verification.
- **Courts** get an independent, third-party timestamp that can support — though not replace — the certificate required under Section 65B of the Indian Evidence Act, 1872, when electronic records are tendered as evidence.

LTN is being built first as a hackathon MVP for KLEOS Hackathon 2026 and is specified here at the depth required to progress from prototype to a regulated, multi-stakeholder production system.

---

## 3. Background & Problem Statement

### 3.1 Current State

Legal document execution in India today typically depends on:

- Physical (or e-Stamp) stamp paper issued through Stock Holding Corporation of India (SHCIL) or state treasuries.
- Wet-ink or, increasingly, Aadhaar-based e-sign for digital execution.
- A notary or sub-registrar affixing a physical stamp and signature, or registration at a Sub-Registrar Office under the Registration Act, 1908.
- Paper or scanned-PDF storage with no independent, third-party record of *when* the document content was finalized.

### 3.2 The Trust Gap

None of these steps independently prove **when** a document's content was actually fixed. A stamp paper's purchase date is not proof that the printed terms above the signatures were finalized on that date. A notary's register can be back-filled. A scanned PDF's metadata can be edited with common tools. This creates four recurring failure modes:

| Failure Mode | Description | Affected Party |
|---|---|---|
| Backdating | Document content altered, then presented as if executed earlier | Banks, Courts |
| Silent tampering | Pages or clauses modified after signing, before submission | Buyers/Sellers, Banks |
| Notary fraud | Stamps or signatures forged or reused without the notary's knowledge | Citizens, Regulators |
| Disputed timeline | No reliable record of who touched the document and when | Courts, Litigants |

### 3.3 Why Existing Systems Don't Close the Gap

e-Stamping (SHCIL) timestamps the **stamp paper purchase**, not the document content. Aadhaar e-sign timestamps a **signature event**, not necessarily the final agreed text if the underlying PDF is re-generated. Physical notary registers are **append-only by convention, not by mechanism** — they can still be edited. None of these create a cryptographically verifiable, independently auditable record of document content tied to a timestamp that no single party (including LTN's own operator) can quietly alter after the fact. That gap is what a public blockchain timestamp closes.

---

## 4. Product Vision & Strategic Fit

**Vision statement:** *Every legal document in India should be able to prove, in under three seconds, exactly when it was created and whether it has been touched since.*

LTN is positioned as **verification infrastructure**, not a registration replacement and not a law firm. It is intentionally designed to plug into the existing notarization and registration workflow rather than compete with it, which lowers the regulatory and behavior-change burden required for adoption. Long-term, LTN aims to become to legal document integrity what SSL/TLS certificates became to website trust — an invisible, default-on layer that institutions simply require.

---

## 5. Goals, Objectives & Non-Goals

### 5.1 Business Goals

- Establish LTN as a trusted, independently verifiable timestamping layer recognized by at least one banking partner and one notary association within the first two pilot phases.
- Build defensible technical moat through chain-of-custody data that compounds in value as more documents and verification events accumulate.
- Create a sustainable B2B2C revenue model (per-document registration fee, institutional API access) without requiring citizens to understand or hold cryptocurrency.

### 5.2 User Goals

| Goal | Primary Beneficiary |
|---|---|
| Prove a document's existence and content at a specific time | Citizen, Lawyer |
| Detect any post-execution modification instantly | Bank, Court |
| Digitally sign with non-repudiable, audit-bound notarization | Notary |
| Verify a document in under 3 seconds without blockchain expertise | Bank Officer, Court Officer |
| Produce an evidence-ready audit trail for litigation or audit | Court, Compliance Officer |

### 5.3 Non-Goals (Explicitly Out of Scope for V1)

- LTN does **not** perform legal registration under the Registration Act, 1908, and does not replace Sub-Registrar Office filing.
- LTN does **not** issue stamp paper or collect stamp duty; it integrates alongside e-Stamping, not in place of it.
- LTN does **not** hold cryptocurrency on behalf of users; citizens and notaries never see a wallet, seed phrase, or gas fee.
- LTN does **not** store full document content on-chain (legal and privacy constraint, see Section 9, F-01).
- LTN does **not**, in V1, provide legal advice, contract drafting, or AI-based clause review.

---

## 6. Target Users & Personas

### Persona 1 — Citizen Executant ("Priya")
Age 30–55, executing a property sale deed or loan agreement once every few years. Not technical. Primary need: a simple way to prove "I signed this on this date, and it hasn't changed," with zero blockchain jargon. Interacts via mobile web or the citizen app; authenticates via OTP.

### Persona 2 — Independent Notary ("Advocate Rao")
A licensed notary or oath commissioner handling 5–40 documents per week. Needs a fast digital signing flow that integrates with the Class 3 Digital Signature Certificate (DSC) hardware token they already use for other e-filings, and a way to prove their signature wasn't forged or reused.

### Persona 3 — Bank Credit/Risk Officer ("Anjali")
Works at a scheduled commercial bank's loan processing desk. Verifies 10–200 mortgage or loan documents weekly. Needs a dashboard view, not a blockchain explorer, and an audit-exportable record for RBI/internal audit purposes.

### Persona 4 — Court Clerk / Judicial Officer ("Justice Mehta's registry")
Handles documents tendered as evidence. Needs independent timestamp verification that can support — alongside a Section 65B certificate — a party's claim about when a document was created, and a tamper-detection result that can be cited in proceedings.

### Persona 5 — Lawyer / Legal Counsel ("Adv. Singh")
Advises clients executing high-value agreements. Needs to recommend LTN registration as part of standard execution practice and retrieve verification reports for case files.

### Persona 6 — System / Compliance Administrator ("LTN Ops")
Internal role managing notary onboarding/offboarding, institutional API keys, fraud-score rule tuning, and regulatory reporting.

---

## 7. Core User Journeys

**Journey A — Citizen registers a sale deed.**
Priya signs a property sale deed on paper, scans it, uploads it via the LTN app, receives a QR code, and prints/affixes it to the document within minutes — no wallet, no gas fee, no jargon.

**Journey B — Notary signs and verifies.**
Advocate Rao receives a signing request, plugs in his DSC USB token, reviews the document hash and metadata, and signs — the signature is cryptographically bound to the exact hash, not just a generic "approved" click.

**Journey C — Bank verifies before loan disbursal.**
Anjali scans the QR code on a loan agreement, instantly sees status, timestamp, notary details, and chain-of-custody, and exports a verification report to the loan file.

**Journey D — Tamper detected.**
A party attempts to re-submit a modified version of a previously registered document. The hash mismatch is detected immediately and flagged, with the full prior chain of custody preserved as evidence of what changed and when the mismatch was caught.

**Journey E — Court requests verification for evidence.**
A litigant's counsel exports an LTN verification report, including a generated Section 65B-aligned certificate of authenticity for the electronic record, to accompany the physical document.

---

## 8. Functional Scope Overview

| ID | Feature | Category | Priority (MoSCoW) | Target Phase |
|---|---|---|---|---|
| F-01 | Immutable Blockchain Timestamp | Core | Must | MVP |
| F-02 | SHA-256 Document Hashing | Core | Must | MVP |
| F-03 | QR-Based Verification | Core | Must | MVP |
| F-04 | Digital Notary Signature | Core | Must | MVP |
| F-05 | Tamper Detection Engine | Core | Must | MVP |
| F-06 | Chain of Custody Timeline | Core | Must | MVP |
| F-07 | Court & Bank Verification Dashboard | Core | Must | MVP |
| F-08 | IPFS-Based Secure Storage | Bonus | Should | Pilot |
| F-09 | Fraud Risk Score Engine | Bonus | Should | Pilot |
| F-10 | Multi-Signature Approval | Bonus | Should | Pilot |
| F-11 | Identity & Access (OTP, DSC, RBAC) | Platform | Must | MVP |
| F-12 | Notification & Alerts Engine | Platform | Should | Pilot |
| F-13 | Audit Log & Compliance Reporting | Platform | Must | Pilot |
| F-14 | Public Verification API / Developer Portal | Platform | Could | Beta |
| F-15 | Section 65B Certificate Generator | Legal | Should | Pilot |

---

## 9. Detailed Feature Specifications

### F-01 — Immutable Blockchain Timestamp
**Description:** On successful upload, the system commits a record containing the document hash, a UTC timestamp, and an initial verification status to a Solana program account, producing a record that cannot be altered or deleted by LTN, the citizen, or the notary after confirmation.

**User Stories:**
- As a citizen, I want my document's existence timestamped on a tamper-proof ledger so that no one — including the platform operator — can later claim it was created on a different date.
- As a bank officer, I want to trust the timestamp without needing to understand Solana, PDAs, or transaction signatures.

**Acceptance Criteria:**
- Given a successfully hashed document, when the system submits the on-chain transaction, then a confirmed transaction signature and slot number are stored against the document record within the performance budget defined in the SRS.
- Given a confirmed on-chain record, then no API, admin console action, or database operation can alter the stored hash or timestamp without the change being visible as a hash mismatch.
- Given an RPC outage, then the system queues the transaction for retry without losing the original client-side upload timestamp, and surfaces a "pending on-chain confirmation" state to the user.

**Edge Cases:** RPC node downtime; transaction dropped/not confirmed; duplicate hash submitted twice (must resolve to the *first* confirmed timestamp, with the second submission flagged, not silently overwritten).

**Dependencies:** F-02 (hash must exist first); SDD §Solana Program Design.

---

### F-02 — SHA-256 Document Hashing
**Description:** Every uploaded document (PDF, JPG, PNG) is reduced to a 256-bit SHA-256 fingerprint, computed client-side where feasible to avoid transmitting an extra unhashed copy unnecessarily, and re-verified server-side before on-chain submission.

**User Stories:**
- As a citizen, I want any single-byte change to my document to produce a completely different fingerprint, so tampering is mathematically detectable.

**Acceptance Criteria:**
- Given identical document bytes, the hash is identical regardless of filename, upload time, or device.
- Given a single-bit change anywhere in the file, the resulting hash differs from the original (standard SHA-256 avalanche property).
- Multi-page or multi-file submissions produce both per-page hashes and a single composite Merkle root hash, so a single altered page can be pinpointed without invalidating the whole document's proof.

**Edge Cases:** Re-saved/re-scanned PDFs that are visually identical but byte-different (must be explained to the user as "different file, not necessarily tampering" — see F-09 fraud scoring for nuance); image compression artifacts altering hash on re-upload of the "same" photo.

---

### F-03 — QR-Based Verification System
**Description:** Upon successful registration, the system generates a QR code encoding a document ID and a signed, expiring verification token (not the raw hash, to prevent pre-image probing) resolving to a public verification URL.

**Acceptance Criteria:**
- Scanning the QR from any smartphone camera resolves to a mobile-responsive verification page without requiring app installation.
- The verification page displays status, timestamp, and notary details without exposing personally identifiable information to an anonymous scanner beyond what the document owner has marked public.
- QR codes are printable at a minimum size that remains scannable after standard photocopying (tested per SRS NFR).

**Edge Cases:** QR physically damaged/partially obscured (must degrade gracefully via standard QR error correction); verification URL accessed after document is later marked disputed or revoked (must show that status prominently, not the original "verified" cached state).

---

### F-04 — Digital Notary Signature
**Description:** Onboarded notaries sign the document hash using a Controller of Certifying Authorities (CCA)-compliant Class 3 Digital Signature Certificate held on a hardware (USB/PKCS#11) token. The private key never leaves the token or touches LTN servers; only the resulting signature is transmitted.

**Acceptance Criteria:**
- Signing requires the notary's DSC token to be physically present and PIN-authenticated at signing time.
- The signature is cryptographically bound to the exact document hash and timestamp pair, not to a generic "approved" action — any later hash mismatch invalidates the signature's relevance to that document.
- Public verification confirms the signature against the notary's published public key/certificate chain without requiring the verifier to trust LTN's say-so alone.

**Edge Cases:** Notary's DSC expired or revoked between signing and later verification (system must record the certificate's validity status *at signing time*, not at verification time); notary onboarding without a DSC (not permitted for production signing — DSC is a hard MVP requirement per F-11).

---

### F-05 — Tamper Detection Engine
**Description:** Re-hashes any document submitted for verification and compares it against the on-chain hash for that document ID.

**Acceptance Criteria:**
- A byte-identical re-upload returns "Authentic — Unmodified" with the original timestamp and notary chain intact.
- Any byte difference returns "Modified — Hash Mismatch," timestamped at detection time, without altering or deleting the original on-chain record.
- The result, whichever it is, is itself logged as a new chain-of-custody event (F-06), so repeated verification attempts are themselves auditable.

---

### F-06 — Chain of Custody Timeline
**Description:** An append-only, time-ordered log of every event touching a document: registration, hash confirmation, notary signature(s), each verification attempt (success or failure), status changes, and disputes.

**Acceptance Criteria:**
- Every event records actor identity (or "anonymous verifier" for public QR scans), event type, timestamp, and a reference to the relevant on-chain transaction where applicable.
- The timeline is immutable from the application layer — events can only be appended, never edited or deleted, enforced at the database constraint level, not just application logic.

---

### F-07 — Court & Bank Verification Dashboard
**Description:** An institutional web portal giving authenticated bank/court/lawyer users hash status, timestamp, notary detail, full chain of custody, and export-to-PDF/CSV for case files or audit trails.

**Acceptance Criteria:**
- Institutional users see a bulk-search/filter view (by document ID, date range, status) in addition to single-document lookup.
- Every dashboard view that surfaces document data logs an access event into the chain of custody (so "who looked at this and when" is itself auditable — relevant for evidentiary chain-of-custody standards).

---

### F-08 — IPFS-Based Secure Storage *(Bonus — Pilot phase)*
**Description:** Optionally stores an encrypted copy of the document on IPFS, with only the Content Identifier (CID) and an encryption-key reference (not the key itself) stored in LTN's database; the raw decryption key is never stored unencrypted server-side.

**Acceptance Criteria:** Document retrieval from IPFS requires both the CID and an authorized decryption request through LTN's key-management flow — IPFS alone, without LTN authorization, yields ciphertext only.

---

### F-09 — Fraud Risk Score Engine *(Bonus — Pilot phase)*
**Description:** A rules- and heuristics-based score (0–100) combining signals such as timestamp/metadata inconsistency (e.g., embedded PDF creation date predating registration by an implausible margin), missing or expired notary certificates, repeated failed verification attempts, and unusual chain-of-custody patterns (e.g., many disputes from the same uploader).

**Acceptance Criteria:** Score and the specific contributing signals are both shown to institutional users — never a bare number with no explanation, to avoid unaccountable "black box" fraud decisions. Score updates are themselves logged as chain-of-custody events.

---

### F-10 — Multi-Signature Approval System *(Bonus — Pilot phase)*
**Description:** Supports requiring N-of-M signatures (e.g., buyer + seller + notary, 3-of-3) before a document is marked "Fully Executed," with partial-signature states visible in the dashboard.

**Acceptance Criteria:** A document cannot reach "Active/Verified" status until the configured signature threshold is met; the system clearly differentiates "Pending Signatures (1/3)" from "Verified (3/3)" in every surface, including the public QR page.

---

### F-11 — Identity & Access Management (RBAC)
**Description:** OTP-based mobile authentication for citizens; Class 3 DSC-based authentication for notaries; institutional SSO/credential + MFA for bank and court accounts; role-based access control gating which actions and data each role can see.

**Acceptance Criteria:** OTP expires within 5 minutes and allows a maximum of 3 attempts before lockout with cool-down; institutional sessions enforce idle timeout; every role's permitted action set is enforced server-side, not only hidden in the UI.

---

### F-12 — Notification & Alerts Engine *(Pilot phase)*
**Description:** SMS/email/push notifications for signature requests, registration confirmation, tamper-detection alerts, and status changes.

**Acceptance Criteria:** A tamper-detection event triggers an alert to the document's registered owner and, where applicable, the institutional party that last verified it — within the latency budget defined in the SRS.

---

### F-13 — Audit Log & Compliance Reporting
**Description:** An internal, append-only operational audit log (distinct from the user-facing chain of custody) capturing administrative actions — notary onboarding/offboarding, API key issuance, fraud-rule changes — for internal governance and regulator requests.

**Acceptance Criteria:** Audit log entries are exportable in a regulator-friendly format and cannot be deleted by any role, including system administrators, through the application layer.

---

### F-14 — Public Verification API / Developer Portal *(Beta phase)*
**Description:** A documented REST API and API-key issuance flow letting banks/courts integrate hash verification directly into their own loan-origination or case-management systems rather than using the LTN dashboard manually.

---

### F-15 — Section 65B Certificate Generator
**Description:** Generates a certificate, in the form contemplated by Section 65B(4) of the Indian Evidence Act, 1872, describing how the electronic record (the LTN verification record) was produced and certifying the identity of the person responsible for the relevant device/process — intended to accompany, not replace, the verification report when a party seeks to tender it in judicial proceedings.

**Acceptance Criteria:** The generated certificate is reviewed and templated in consultation with legal counsel before release; the feature is explicitly labeled in-product as "a generated certificate to support admissibility — consult your legal counsel," to avoid the product appearing to offer legal certification of admissibility itself.

---

## 10. Non-Functional Requirements (Summary)

Full detail lives in the SRS (`02_software_requirements_specification.md`, ISO/IEC 25010-aligned). Summary targets:

| Category | Target |
|---|---|
| Verification latency | p95 < 3s, p99 < 5s at 500 concurrent requests |
| Registration latency | p95 < 5s end-to-end including on-chain confirmation queueing |
| Availability | 99.9% for verification path; 99.5% for registration path |
| Hash/tamper-detection accuracy | 100% (deterministic, not probabilistic) |
| Data residency | Document content and PII stored in AWS Mumbai (ap-south-1) region only |
| On-chain data minimization | No document content, no PII, on-chain — hash + timestamp + status only |

---

## 11. Success Metrics & KPIs

**North Star Metric:** Number of documents with at least one successful third-party verification event (a proxy for the system actually being *used* to resolve trust, not just registered and forgotten).

| Metric Type | Metric | Illustrative Target (Pilot) |
|---|---|---|
| Activation | % of registered documents that receive ≥1 verification within 30 days | ≥ 40% |
| Trust | Tamper-detection false-positive rate | < 0.1% |
| Adoption | Notaries actively signing monthly | ≥ 50 by end of Pilot |
| Institutional | Banks/courts with ≥1 active integration | ≥ 2 by end of Beta |
| Reliability | Verification success rate (no system error) | ≥ 99.5% |
| Performance | QR scan-to-result time | < 3s p95 |

*(Targets above are planning goals for prioritization, not measured results.)*

---

## 12. Assumptions & Dependencies

- Notaries are willing to adopt DSC-based digital signing as part of their existing workflow.
- At least one banking or NBFC partner is available for pilot integration feedback.
- Solana devnet/testnet access is sufficient through MVP and Pilot; mainnet-beta migration is gated on a smart-contract security audit (see Implementation Plan).
- DPDP Act 2023 rules applicable to the company's data-fiduciary obligations are finalized/stable enough to design against by Pilot phase; compliance scope will be revisited if rules change materially.

## 13. Risks & Mitigations (Strategic)

| Risk | Mitigation |
|---|---|
| Courts/regulators do not formally recognize blockchain timestamps as evidence | Position as supporting evidence alongside Section 65B certificate (F-15), not as sole proof; engage legal counsel early |
| Low notary adoption due to DSC friction | Provide DSC-onboarding support and a clear UX migration path; consider notary-side incentive in pilot |
| Public blockchain fee/latency volatility | Abstract gas/fees entirely from end users; maintain a fee-paying relayer wallet with monitoring and top-up alerts |
| Citizen distrust of "blockchain" branding | Lead all user-facing UX with QR + verification status, not blockchain jargon |

*(Operational/delivery risks are tracked in detail in the Implementation Plan risk register.)*

---

## 14. Release Strategy & Phasing

| Phase | Scope | Approx. Duration |
|---|---|---|
| MVP (Hackathon) | F-01–F-07, F-11 on Solana devnet | 2 weeks |
| Closed Pilot | + F-08, F-09, F-10, F-13, F-15; testnet | 3 months |
| Beta | + F-12, F-14; security audit; limited mainnet-beta | 3 months |
| GA | Full mainnet-beta production, multi-bank/court onboarding | 3+ months |

---

## 15. Open Questions & Future Considerations

- Should LTN pursue formal empanelment with state IGR (Inspector General of Registration) offices, or remain a voluntary layer alongside registration?
- Should fee-paying for on-chain transactions be borne by LTN (subsidized) or passed through per-document at GA?
- Should the program's upgrade authority be transferred to a multisig/DAO-style governance structure post-audit, and on what timeline?
- Is a dedicated mobile app (React Native, per original tech stack) required for MVP, or can a mobile-responsive web app suffice through Pilot?

---

## 16. Appendix A — Glossary

| Term | Definition |
|---|---|
| LTN | Legal TimeLock Network |
| PDA | Program Derived Address — a deterministic Solana account address derived from seeds, used in lieu of a private-key-controlled address |
| DSC | Digital Signature Certificate, issued under India's IT Act 2000 framework via a CCA-licensed Certifying Authority |
| CCA | Controller of Certifying Authorities (India) |
| IPFS | InterPlanetary File System — content-addressed distributed storage |
| Chain of Custody | The ordered record of every event/actor that has touched a piece of evidence or document |
| Section 65B | Section 65B, Indian Evidence Act, 1872 — governs admissibility of electronic records as evidence |

## 17. Appendix B — Requirement Traceability Index

Each Feature ID above (`F-xx`) is decomposed into Functional Requirements in the SRS (`FR-xx.y`), implemented by components defined in the SDD (`COMP-xx`), and scheduled in the Implementation Plan (`WBS` items). See the Traceability Matrix in `02_software_requirements_specification.md`, Appendix A, for the full cross-reference.
