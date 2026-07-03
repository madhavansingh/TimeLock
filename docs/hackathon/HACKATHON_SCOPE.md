# Hackathon Scope - Legal TimeLock Network (LTN)

This document freezes the scope of the Legal TimeLock Network (LTN) MVP for our 24-hour hackathon. By stripping away production complexity, we ensure the 4-member team can build a fully functional, bug-free, and high-impact demo.

---

## 1. Scope Matrix

| MUST BUILD (High Impact, Core Flow) | SHOULD BUILD (Improves Demo Flow) | NICE TO HAVE (Flex Goals) | OUT OF SCOPE (Production Only) |
|---|---|---|---|
| **SHA-256 Client Hashing**: Generate file checksum in browser (Priya uploads file) | **IPFS Pinata Mock**: Simulated upload returning a valid CID to avoid network lag | **PDF Verification Certificate**: Next.js/Browser printable PDF printout of status | **Redis Caching**: All status checks hit the DB directly (low traffic) |
| **Solana Anchor PDA Anchor**: Record (hash, timestamp) in derived Program Derived Address | **Dynamic Fraud Score**: Rule-based risk score (mismatch=100, missing notary=80) | **Explorer Transaction Link**: Real clickable link to Solana Devnet explorer | **Event Buses & Indexers**: The backend queries the blockchain/DB directly |
| **QR Code Generation**: Create a scannable QR resolving to the verification page | **Notary Dashboard**: Simple queue showing pending files for sign-off | **OTP Simulation Mode**: Bypass SMS fees; clicking "Send OTP" fills `123456` | **MFA & SSO**: Session security is handled by simple login status |
| **Verification Page**: File drop-zone that re-hashes and checks for tampering | **Notary DSC Signing**: Workstation key signing simulated with local Keypair | **Multi-Signature Loop**: Multi-party signing (Buyer + Seller + Notary) | **Microservices**: Monolithic Express server hosting all endpoints |
| **Timeline Custody Trail**: Simple vertical list of registration & sign events | | | **SMS/Email gateways**: No real SMS/Email dispatch |

---

## 2. Feature Definitions & Implementation Targets

### MUST BUILD (Core Demo Loop)
* **On-Chain Document Registry**: A Solana program on Devnet allowing a relayer wallet to commit a document hash and timestamp, locking the creation record.
* **Tamper Detection**: An upload area on the frontend that hashes a file, sends the hash to the backend, and compares it to the registered Solana hash.
* **Scan Verification Link (QR)**: Generating a QR code containing the verification URL. Scanning this URL on any smartphone immediately opens the public verification page.
* **Chain of Custody History**: A visual timeline list of events mapping when the file was registered, when the notary signed, and when verification checks occurred.

### SHOULD BUILD (Interactive Elements)
* **Simulated Notary Workstation**: A simple notary console where a user logs in as "Advocate Rao", views a queue of documents, and clicks "Sign" (simulating a Class 3 DSC token challenge by executing a cryptographic signature with a pre-loaded local key).
* **Rule-Based Fraud Heuristics**: An algorithm calculating risk (0 to 100) based on simple parameters:
  * Hash mismatch -> 100 risk score
  * Unanchored document (missing Solana Tx) -> 90 risk score
  * Unnotarized document -> 80 risk score

### OUT OF SCOPE (Remove to Avoid Delays)
* **Relational Database Sharding / Partitioning**: Single-table PostgreSQL is sufficient.
* **Real SMS Gateway Integration**: Avoid standard gateway account setups and credit card registration delays. Use simulated OTP.
* **Real Hardware Token Binding**: Standard DSC PKCS#11 local driver installations will fail on judges' computers. Simulate token presence in browser session.
