# Team Tasks & Responsibilities - Legal TimeLock Network (LTN)

This document organizes the 24-hour hackathon task lists, boundaries, and priorities for our 4-member team.

---

## 1. Frontend Developer

* **Files Owned**: `/frontend` (All views, components, and client-side code).
* **Responsibilities**: Build a clean, responsive, and trustworthy Next.js UI using Tailwind and lucide icons. Consume the backend REST API exclusively. Do not import blockchain libraries.
* **Priority Order**:
  1. **Landing & Layouts** (`/frontend/src/app/layout.tsx` & `page.tsx`): Establish Inter typography and Royal Blue colors.
  2. **Verify Check Dropzone** (`/frontend/src/app/verify/page.tsx`): Drag-and-drop file upload interface that calls the re-hash API.
  3. **Register Form** (`/frontend/src/app/register/page.tsx`): Form for document properties, sending payload to backend, and showing success with generated QR codes.
  4. **Document Details & Timeline** (`/frontend/src/app/document/[id]/page.tsx`): Show on-chain hashes, notary signature details, and the custom `CustodyTimeline` component.
  5. **Quick Verification Widget** (`/frontend/src/components/quick-verify-widget.tsx`): Embeddable sidebar lookup panel for dashboard and home.

---

## 2. Backend Developer

* **Files Owned**: `/backend` (Express services, controllers, routes, and database schemas).
* **Responsibilities**: Expose API endpoints matching `API_LOCK.md`. centralize hashing checks, implement rule-based fraud heuristics, mock storage/OTP flows, and package the compiled code.
* **Priority Order**:
  1. **Prisma Schema & Database init** (`/backend/prisma/schema.prisma`): Run migrations (`npx prisma migrate dev`) to mount tables for users, documents, signatures, and timeline events.
  2. **Centralized Hashing Service** (`/backend/src/services/hash.service.ts`): Implement SHA-256 generation, comparison, and DSC verification algorithms.
  3. **Express Routing & Middlewares** (`/backend/src/routes/*` & `app.ts`): Write controller request mappings and mount JWT verification hooks.
  4. **Verification Certificate Builder** (`/backend/src/services/document.service.ts`): Code dynamic PDFKit certificate generator.
  5. **Rule-Based Fraud Engine** (`/backend/src/services/fraud.service.ts`): Calculate risk scores (0-100) using deterministic violation mappings.

---

## 3. Blockchain Developer

* **Files Owned**: `/blockchain` (Solana Web3 transaction builder, program interactions, relayer settings).
* **Responsibilities**: Manage connections to Solana Devnet/Localnet, write derived PDA seed builders, compile instructions for document initialization and notary signatures, and export helper APIs.
* **Priority Order**:
  1. **Relayer Configuration** (`/blockchain/src/solana-client.ts`): Load keypairs, connect to RPC endpoint, and implement transaction fee payment.
  2. **Derived PDA Seed Builder** (`/blockchain/src/document-program.ts`): Build seed derivations sync:
     * `DocumentRecord PDA` = `["document", hash(documentId)]`
     * `SignatureRecord PDA` = `["signature", docPda, role]`
  3. **Instruction Builders**: Construct Solana transaction instructions for initializing document accounts and recording notary signatures.
  4. **Mock Failover Fallback**: Write try-catch wrappers so if the Devnet connection goes offline, the backend receives simulated mock transaction signatures, keeping the demo functional.
  5. **Package Compilation**: Compile TypeScript code into JavaScript (`dist/`) so the backend can link it.

---

## 4. Product / Research Lead

* **Files Owned**: `/docs`, `/architecture`, `/shared`, and pitch materials.
* **Responsibilities**: Direct shared constants and enums, manage API documentation, coordinate integration checkpoints, verify system tests, and structure the 3-minute presentation slides and pitch narration.
* **Priority Order**:
  1. **Shared Specifications** (`/shared/*`): Maintain Zod schemas and API interfaces to prevent dev teams from deviating.
  2. **Architecture Diagram Mapping**: Render Mermaid diagrams and context boundaries to explain system concepts in the slide deck.
  3. **Judging Q&A Preparation** (`/JUDGE_QNA.md`): Review blockchain objections, docu-sign comparisons, and legal Evidence Act contexts.
  4. **Slide Deck & Pitch Structuring** (`/PITCH.md`): Prepare the 3-minute voiceover scripts.
  5. **Live Test Validation**: Supervise the 11-step demo script in `DEMO_FLOW.md` before judging rounds.
