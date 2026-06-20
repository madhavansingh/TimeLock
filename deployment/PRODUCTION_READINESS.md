# TimeLock Network (LTN) — Production Readiness & Operations Playbook

This handbook provides instructions for launching, monitoring, and operating the Legal TimeLock Network (LTN) in production-grade environments.

---

## 1. High Availability Architecture & Containerisation

All components are configured for orchestration via `docker-compose` or Kubernetes.

### Multi-Container Deployment

Run the complete pipeline (PostgreSQL, Express Node API, Next.js UI) using Docker Compose:

```bash
# Build and spin up the multi-container environment
docker-compose up --build -d

# Verify all services are healthy
docker-compose ps
```

---

## 2. Database Hardening & Schema Migrations

Production indexing has been applied to query fields in the PostgreSQL database to support rapid searching under load.

### Applying Migrations

If deploying outside of Docker or running manual database migrations:

```bash
# Execute schema synchronisation and Client generation
pnpm exec prisma db push
```

---

## 3. Strict Reliability Policies & Error Handling

To satisfy security audit compliance, all mock fallbacks have been disabled. If a downstream provider (Solana devnet, Pinata IPFS gateways, or NVIDIA Nemotron) fails, the API throws explicit typed errors:

- **`BlockchainError`**: Raised on Solana signature or anchoring failures. Enforces exponential backoff retries.
- **`StorageError`**: Raised when Pinata gateway responds with non-200 limits. Enforces validation checks.
- **`AIServiceError`**: Raised when NVIDIA Nemotron credentials fail or when latency bounds are exceeded.

---

## 4. Operational Monitoring & Observability

### Context Log Correlation

Every incoming API request is tagged with a unique `X-Request-Id` header (automatically generated or passed by client). All backend logs map this context using `AsyncLocalStorage`, allowing developers to trace request lifecycles across downstream services.

### Health Probes

Monitors the state of connected downstream services:

- **Database Health Probe**: `GET /health/database`
- **Solana Devnet Health Probe**: `GET /health/blockchain`
- **NVIDIA Nemotron AI Health Probe**: `GET /health/ai`
- **Pinata Storage Health Probe**: `GET /health/storage`

---

## 5. Security Policies & Rate Limiting

In-memory rate limiters protect key transactional paths:

1. **Authentication OTP request**: Enforced limit of 10 requests per 15 minutes.
2. **Public Verification scan**: Enforced limit of 20 requests per minute.
3. **AI Copilot Regenerations**: Enforced limit of 5 requests per minute.
