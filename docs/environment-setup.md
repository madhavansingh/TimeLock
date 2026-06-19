# Environment Setup - Legal TimeLock Network (LTN)

This document provides setup instructions for establishing the Legal TimeLock Network (LTN) development environment on your local system.

## Prerequisites

Ensure the following tools are installed on your workstation:
* **Node.js**: v18 or later (v20+ recommended)
* **npm**: v9 or later (or `bun` v1.0+)
* **PostgreSQL**: v15 or later (running locally or via Docker)
* **Solana CLI Suite**: v1.18 or later (for local validator and wallet generation)
* **Rust & Cargo**: v1.75+ (required if building/testing Solana Anchor programs locally)

---

## 1. Local Database Setup (PostgreSQL)

You can run PostgreSQL locally or via Docker:

### Running via Docker
Run the following command to spin up a local PostgreSQL instance:
```bash
docker run --name lt-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=timelock -p 5432:5432 -d postgres:15
```

### Manual Configuration
If using a native PostgreSQL install:
1. Connect to PostgreSQL using your admin tool (`psql` or pgAdmin).
2. Create a new database named `timelock`:
   ```sql
   CREATE DATABASE timelock;
   ```
3. Update the `DATABASE_URL` in your `.env` file to match your connection parameters:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/timelock?schema=public"
   ```

---

## 2. Pinata IPFS Credentials Setup

To enable document uploads to decentralized storage:
1. Go to [Pinata](https://www.pinata.cloud/) and create a free account.
2. Navigate to the API Keys section under your dashboard.
3. Generate a new API Key with `Admin` permissions.
4. Copy the **API Key** and **API Secret** (or JWT).
5. Add these values to your `.env` file:
   ```env
   PINATA_API_KEY="your_api_key_here"
   PINATA_SECRET="your_api_secret_here"
   ```

---

## 3. Solana Localnet Validator Configuration

For local development and testing, run a local Solana cluster:

1. Spin up the test validator in a separate terminal:
   ```bash
   solana-test-validator
   ```
2. In your working terminal, configure the CLI to target localnet:
   ```bash
   solana config set --url localhost
   ```
3. Create a local testing keypair (this will represent the Relayer authority account):
   ```bash
   solana-keygen new --outfile ~/.config/solana/id.json
   ```
4. Airdrop SOL to your local relayer account:
   ```bash
   solana airdrop 2
   ```
5. Extract the private key for backend configuration:
   * To get the Base58 private key format (needed by `.env`):
     ```bash
     solana address -k ~/.config/solana/id.json
     # Alternatively, read the private key array from ~/.config/solana/id.json
     ```
6. Add the connection and key to your `.env` file:
   ```env
   SOLANA_RPC_URL="http://127.0.0.1:8899"
   SOLANA_RELAYER_PRIVATE_KEY="[your_keygen_array_or_base58_string]"
   ```

---

## 4. Sub-Module Setup

### Setup Shared Folder
The `/shared` folder contains configurations and validation rules imported by both frontend and backend. It requires no separate daemon.

### Setup Blockchain Folder
1. Navigate to the `/blockchain` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the typescript compiler build:
   ```bash
   npm run build
   ```

### Setup Backend Server
1. Navigate to the `/backend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file by copying the template:
   ```bash
   cp ../.env.example .env
   ```
   Modify database URLs, JWT secret, Pinata credentials, and Solana keys as instructed above.
4. Run Prisma database migrations to create the tables:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Start the backend developer server:
   ```bash
   npm run dev
   ```
   The backend will start listening on port `5000` (mapped to `http://localhost:5000/v1`).

### Setup Frontend UI
1. Navigate to the `/frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy/create a `.env.local` pointing to the backend API:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:5000/v1"
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.
