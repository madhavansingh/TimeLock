# MVP Feature Mapping - Legal TimeLock Network (LTN)

This reference sheet maps each active hackathon feature to its corresponding Product Requirement (PRD), Software Requirement (SRS), and System Design Component (SDD) identifiers. This simplifies technical auditing by the judges during the evaluation rounds.

---

## Feature Mapping Reference Matrix

| Hackathon Feature | PRD Feature ID | SRS Requirement ID | SDD Component | Execution Status |
|---|---|---|---|---|
| **On-Chain Document PDA** | `F-01` (Blockchain Timestamp) | `FR-01.1` - `FR-01.5` | `COMP-03` (Blockchain Service) | Fully Implemented on Devnet |
| **SHA-256 Hashing** | `F-02` (SHA-256 Hashing) | `FR-02.1` - `FR-02.5` | `COMP-01` (Document Service) | Browser & Server Hashing active |
| **Tamper Detection Engine** | `F-05` (Tamper Engine) | `FR-05.1` - `FR-05.4` | `COMP-02` (Verification Service) | Auto-disputes mismatching hashes |
| **Notary Workstation Sign** | `F-04` (Digital Notary) | `FR-04.1` - `FR-04.4` | `COMP-05` (Notary Service) | Simulated DSC signing active |
| **Custody Trail Timeline** | `F-06` (Chain of Custody) | `FR-06.1` - `FR-06.3` | `COMP-08` (Audit Service) | Append-only event timeline |
| **Dynamic Risk Analysis** | `F-09` (Fraud Scoring) | `FR-09.1` - `FR-09.3` | `COMP-09` (Fraud Score Engine) | Rule-based scoring (0-100) |
| **Verification Certificate** | `F-15` (65B Certificate) | `FR-15.1` - `FR-15.2` | `COMP-12` (Legal Document Gen) | Downloadable PDFKit Certificate |

---

## Architectural Simplifications for Hackathon MVP
To guarantee stability during the 24-hour hackathon, the following enterprise components have been simplified:
* **`COMP-07` (Storage Service)**: Replaced S3 volumes and Pinata uploads with local storage mocks, returning static CIDs to ensure upload speed.
* **`COMP-10` (Auth Service)**: Swapped SMS gateways for OTP with a simulated verification code (`123456`), bypassing network configuration delays.
* **`COMP-13` (Off-chain Indexer)**: Replaced Solana RPC subscriptions with a synchronous Postgres write path, ensuring that dashboard lists load instantly.
