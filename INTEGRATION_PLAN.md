# 24-Hour Hackathon Integration Plan - Legal TimeLock Network (LTN)

This plan schedules the 24-hour sprint into 6 distinct phases with clear deliverables, deadlines, and checkpoints.

---

## 1. 24-Hour Hackathon Timeline

### Hour 0 - 2: Setup & API Lock (Planning & Contracts)
* **Goal**: Align team on scope, configure folders, freeze interfaces.
* **Developer Tasks**:
  * **Product Lead**: Create `/shared` configurations and freeze endpoints in `API_LOCK.md`.
  * **Backend Dev**: Initialize local PostgreSQL database and generate Prisma client.
  * **Blockchain Dev**: Generate relayer wallet and test connection to Solana Devnet.
  * **Frontend Dev**: Set up Next.js skeleton and install styles.
* **Checkpoint 1 (Hour 2)**: All developers can run `npm install` and build their empty frameworks without errors. API paths are frozen.

### Hour 2 - 8: Parallel Coding (The Core Build)
* **Goal**: Write independent logic.
* **Developer Tasks**:
  * **Frontend Dev**: Implement landing page, registration form upload layout, and verify drop-zone view using mock APIs.
  * **Backend Dev**: Code controllers, routers, middlewares, and centralized `HashService`.
  * **Blockchain Dev**: Implement PDA seed derivations and instruction serializations.
  * **Product Lead**: Create slide templates and research legal Q&A.

### Hour 8 - 12: Backend ↔ Blockchain Integration (Checkpoint 2)
* **Goal**: Enable backend to write to Solana Devnet.
* **Developer Tasks**:
  * **Blockchain Dev**: Compile `/blockchain` dist bundle.
  * **Backend Dev**: Install local package and call `BlockchainService.registerDocumentOnChain` in the document controller.
  * **Frontend Dev**: Continue page detailing and timeline styling.
* **Checkpoint 2 (Hour 12)**: Triggering a backend POST request successfully registers a derived PDA on Solana Devnet, returning a transaction signature.

### Hour 12 - 18: Frontend ↔ Backend Integration (Checkpoint 3)
* **Goal**: Connect frontend to Express API endpoints.
* **Developer Tasks**:
  * **Frontend Dev**: Point API URLs to `http://localhost:5000/v1` and implement actual `fetch` requests.
  * **Backend Dev**: Enable CORS, implement Zod validation checks, and verify file uploads work with `multer`.
  * **Product Lead**: Finalize pitch script and prepare answers for Q&A.
* **Checkpoint 3 (Hour 18)**: Priya can upload a document scan on the frontend and receive a printable QR code with registered metadata.

### Hour 18 - 22: Hardening & Tamper Testing (Checkpoint 4)
* **Goal**: Test system checks and build presentation PDF.
* **Developer Tasks**:
  * **Backend Dev**: Verify PDF certificate generator works.
  * **Frontend Dev**: Implement details page showing custody timeline.
  * **Team**: Perform adversarial test (tamper check with altered file).
* **Checkpoint 4 (Hour 22)**: Tampering is successfully detected by the system, displaying a 100 risk score and disputing the document.

### Hour 22 - 24: Demo Rehearsals & Polish (Checkpoint 5)
* **Goal**: Practice pitch and freeze code.
* **Developer Tasks**:
  * **Product Lead**: Run slide presentations.
  * **Team**: Run the 11-step demo script in `DEMO_FLOW.md` on Solana Devnet twice.
* **Checkpoint 5 (Hour 24)**: Pitch and demo execute within the 3-minute limit.
