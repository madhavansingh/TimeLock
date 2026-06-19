# Development Workflow & Guidelines - Legal TimeLock Network (LTN)

This document establishes the collaboration guidelines, team boundaries, code review rules, and mandatory checkpoints for the Legal TimeLock Network (LTN) project.

---

## 1. Team Folder Ownership Rules

To prevent merge conflicts and allow teams to move independently, folder ownership is strictly enforced:

| Role | Directory Ownership | Permissions & Boundaries |
|---|---|---|
| **Frontend Developer** | `/frontend` | Complete ownership. Communicates strictly via APIs, never imports blockchain modules or references Solana keypairs directly. |
| **Backend Developer** | `/backend` | Complete ownership. Implements API contracts, database, hash checks, and coordinates blockchain and IPFS integration services. |
| **Blockchain Developer** | `/blockchain` | Complete ownership. Manages Solana transactions, PDA seed structures, and Anchor instructions. |
| **Product / Research Lead** | `/docs`, `/architecture`, `/shared` | Owns project documentation, shared constants, API endpoints contracts, testing coordination, and presentation rehearsals. |

*Note: Changes to the `/shared` folder must be approved by the Product/Research Lead and all developers before merging, to prevent breaking API contracts.*

---

## 2. Git Branch Strategy & Merge Process

The project uses a structured Git Flow to keep code stable:

### Branch Names
* `main`: Represents production-ready code. Gated by Phase release criteria.
* `develop`: Integration branch where developers merge their features.
* Feature branches: Named per role to isolate modifications:
  * `feature/frontend/*` (Frontend changes)
  * `feature/backend/*` (Backend changes)
  * `feature/blockchain/*` (Blockchain changes)
  * `feature/shared/*` (Shared type or documentation updates)

### Pull Request & Merge Rules
1. **Branch Targets**: All feature branches must target `develop`. Direct pushes to `develop` or `main` are strictly prohibited.
2. **Reviewers**: Every Pull Request requires review and approval from at least one other role.
3. **Build Gates**: PRs must compile cleanly without errors (`npm run build` or `tsc --noEmit` must pass across all modules).
4. **Prisma Schema Check**: Backend database migrations must be applied successfully to test containers before merging.

---

## 3. Integration Checkpoints

We enforce five integration checkpoints to validate systems alignment step-by-step:

### Checkpoint 1: API Contracts Finalized
* **Criterion**: The Product/Research Lead and Backend/Frontend Developers sign off on `/shared/api-endpoints.md` and `/shared/api-contracts.ts`.
* **Goal**: Guarantees that the frontend and backend teams can build and test their modules independently in parallel using mock responses.

### Checkpoint 2: Backend ↔ Blockchain Integration
* **Criterion**: Blockchain Developer delivers the compiled `/blockchain` NPM package, and the Backend Developer verifies that `BlockchainService` can initialize documents and record signatures on Solana localnet or Devnet.
* **Goal**: Confirms relayer wallet operations, PDA derivation logic, and transaction speed latency budget.

### Checkpoint 3: Frontend ↔ Backend Integration
* **Criterion**: Frontend Client connects to the Express API. Endpoints for OTP request, file upload, status check, and QR generation are successfully called and rendered in Next.js views.
* **Goal**: Eliminates data format mismatches and cors issues.

### Checkpoint 4: Full System Testing
* **Criterion**: Runs automated and manual verification check sheets. Simulates document alterations to confirm risk scoring (risk=100) and dispute triggers.
* **Goal**: Ensures reliability under high-load concurrency and validates error logging.

### Checkpoint 5: Demo Rehearsal
* **Criterion**: Running through the complete 11-step hackathon script in `DEMO_FLOW.md` on Solana Devnet twice in a row without a single error.
* **Goal**: Prepares the team for presentation readiness.

---

## 4. Coding Standards

* **TypeScript**: Enforce strict types. Do not use `any`. Define interfaces in `/shared/types.ts`.
* **Linting & Formatting**: Follow Prettier configurations.
* **Error Handling**: Express routes must pass errors to `next(err)` to ensure they are captured by the global `errorMiddleware` and returned as standard API envelopes.
* **Security Constraints**: Never log or print user phone numbers or emails in plain text. Always generate and store cryptographic SHA-256 hashes of PII at rest.
