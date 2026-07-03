# Final Recommendation - Legal TimeLock Network (LTN)

This document outlines the final recommendation for the 4-member team to execute the Legal TimeLock Network (LTN) MVP in a 24-hour hackathon environment.

---

## 1. What to Build vs. What to Mock

To complete a bug-free, functional prototype within the 24-hour window, the team must selectively build and mock:

### Build Fully
* **React/Next.js Client Hashing**: Real in-browser SHA-256 calculation. This shows technical capability and privacy awareness (the file doesn't leave the browser until it's ready to upload).
* **Solana Devnet Anchor Program**: A simple compiled program. Deriving document PDAs sync and initiating writes is the core proof of technical execution.
* **Tamper Comparison Check**: The backend must run a real SHA-256 comparison between the uploaded scan and the database/Solana registered hash. This is the core "Aha!" moment of the demo.
* **Interactive Timeline Component**: A visual custody trail that renders chronological events.

### Mock/Simulate
* **Class 3 DSC hardware token**: Hardware integrations require local drivers and certificates. Mock the token PIN prompt in the browser session. Let the backend sign the hash using a local Solana Keypair representing Notary Rao.
* **Pinata IPFS file upload**: Network lag during presentation is high-risk. Return a static simulated CID instantly.
* **SMS OTP Gateways**: Do not register DLT sender IDs or spend money on SMS APIs. Mock the SMS dispatch and allow the OTP input box to accept `123456` for any identifier.

---

## 2. What to Highlight Verbally (The Slide Narrative)

* **Legal Context (Section 65B)**: Address how the generated audit certificate supports electronic evidence admissibility. Mention that this acts as the foundation for digital notary transformation under India's IT Act 2000.
* **India-First Data Residency**: Emphasize that all PII and document metadata are stored encrypted in the AWS Mumbai (ap-south-1) region, aligning with DPDP Act 2023 requirements.
* **On-Chain Data Minimization**: Proudly explain that we never write personal details, filenames, or contract terms on the public blockchain. We only anchor the 32-byte hash, protecting privacy and keeping fees under a fraction of a cent.

---

## 3. What Will Impress Judges the Most

1. **The Instant Mismatch Banner**: Nothing is more persuasive than editing a single number in a PDF, re-uploading it, and seeing the screen instantly turn red, flagging: **"Integrity Check Failed: Modified"**. Practice this transition.
2. **Zero Cryptographic Jargon in UX**: Judges are often non-technical business leaders. Avoid showing raw transaction keys or wallet connections in the primary flow. Use standard labels like "Verified," "Signed," and "Tamper Score."
3. **Downloadable PDF Certificate**: Generating a clean certificate containing metadata, QR code, and signatures proves that the project has real-world utility for court litigations.
