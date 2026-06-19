# Task Assignments & Role Checklist - Legal TimeLock Network (LTN)

This document splits hackathon tasks into clear checklists based on team role ownership.

---

## 1. Frontend Developer (Ownership: `/frontend` only)

* [ ] **Environment Setup**
  * [ ] Copy `.env.local` pointing `NEXT_PUBLIC_API_URL` to `http://localhost:5000/v1`.
* [ ] **Landing Page (`/frontend/src/app/page.tsx`)**
  * [ ] Implement responsive landing view with Hero, CTA buttons (Verify, Register), and core feature cards.
* [ ] **Document Registration Page (`/frontend/src/app/register/page.tsx`)**
  * [ ] Create title, type dropdown, and notary selector inputs.
  * [ ] Build drag-and-drop file upload.
  * [ ] Render success box showing generated Document ID, hash, and printable QR code image.
* [ ] **Document Verification Page (`/frontend/src/app/verify/page.tsx`)**
  * [ ] Implement verification panel taking a Document ID and file.
  * [ ] Display visual status cards (Verified vs. Tampered) with expected/submitted hashes.
  * [ ] Display Fraud Risk badges.
* [ ] **Document Details Page (`/frontend/src/app/document/[id]/page.tsx`)**
  * [ ] Display title, type, and registered timestamp metadata.
  * [ ] Render Solana Devnet tx signature linking to Solana Explorer.
  * [ ] Display notary name, signature, and DSC certificate details.
  * [ ] Embed custom `CustodyTimeline` showing registration and verification histories.
  * [ ] Create "Download Verification Certificate" button triggering PDF download.
* [ ] **Components & API Client**
  * [ ] Implement `ApiService` HTTP fetch wrapper supporting form data uploads.
  * [ ] Create shared UI components (buttons, badges, cards, tables).

---

## 2. Backend Developer (Ownership: `/backend` only)

* [ ] **Environment & Prisma Configuration**
  * [ ] Set up local Postgres database.
  * [ ] Define models in `prisma/schema.prisma` and execute migrations (`npx prisma migrate dev`).
* [ ] **Centralized Hash Service (`/backend/src/services/hash.service.ts`)**
  * [ ] Implement file buffer SHA-256 fingerprint generation.
  * [ ] Create secure constant-time hash comparison function.
  * [ ] Build cryptographic notary signature validation using public key PEM certificates.
* [ ] **Centralized QR Service (`/backend/src/services/qr.service.ts`)**
  * [ ] Implement JWT signed verification link generator.
  * [ ] Build base64 QR code image generator with custom branding.
* [ ] **Centralized Fraud Scoring Service (`/backend/src/services/fraud.service.ts`)**
  * [ ] Implement rule-based scoring logic (mismatch = 100, missing blockchain = 90, missing notary = 80).
* [ ] **Controllers, Routes, and Middleware**
  * [ ] Create JWT session middleware (`authMiddleware`) and RBAC checks (`rbacMiddleware`).
  * [ ] Implement global JSON error mapping (`errorMiddleware`).
  * [ ] Build routes for OTP auth request/verify, onboarding notaries, document upload, verification check, signature submission, custody timeline search, and fraud details.
* [ ] **Verification Certificate PDF Generator (`/backend/src/services/document.service.ts`)**
  * [ ] Code PDFKit document builder layout returning Base64 binary.

---

## 3. Blockchain Developer (Ownership: `/blockchain` only)

* [ ] **Environment & Client Configuration**
  * [ ] Configure Solana connection wrapper pointing to devnet or localnet RPC.
  * [ ] Implement relayer Keypair parser supporting Base58 and JSON arrays.
* [ ] **Anchor Program Client (`/blockchain/src/document-program.ts`)**
  * [ ] Code deterministic PDA seed builder for `DocumentRecord` based on hashed Document ID.
  * [ ] Code deterministic PDA seed builder for `SignatureRecord` based on Document PDA and role.
  * [ ] Implement instruction serializations for `initializeDocument` (initialize hash and required signers).
  * [ ] Implement instruction serializations for `recordSignature` (submit notary/party signature).
  * [ ] Implement instruction serializations for `updateStatus` (modify status byte).
  * [ ] Bundle and export the compiled package APIs.

---

## 4. Product / Research Lead (Ownership: `/docs`, `/architecture`, `/shared`)

* [ ] **Scaffold Shared Code Contracts**
  * [ ] Create `/shared/enums.ts` detailing statuses and roles.
  * [ ] Create `/shared/types.ts` documenting TS structures.
  * [ ] Create `/shared/validation.ts` defining Zod payload schemes.
  * [ ] Create `/shared/api-endpoints.md` providing detailed endpoint documentation.
* [ ] **Define Architecture & Context**
  * [ ] Deliver system context and boundary diagrams.
  * [ ] Document step-by-step user flows.
  * [ ] Create sequence diagrams.
* [ ] **Testing, Verification, & Presentation**
  * [ ] Run integration compile validations.
  * [ ] Coordinate full system testing checks.
  * [ ] Supervise the 11-step hackathon script and lead demo rehearsals.
