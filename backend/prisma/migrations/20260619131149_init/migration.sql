-- CreateEnum
CREATE TYPE "DbUserRole" AS ENUM ('CITIZEN', 'NOTARY', 'BANK_OFFICER', 'COURT_CLERK', 'ADMIN');

-- CreateEnum
CREATE TYPE "DbDocumentStatus" AS ENUM ('PENDING', 'ONCHAIN_CONFIRMED', 'NOTARY_SIGNED', 'FULLY_EXECUTED', 'DISPUTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DbSignerRole" AS ENUM ('NOTARY', 'BUYER', 'SELLER', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "role" "DbUserRole" NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "email_hash" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "document_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "merkle_root" TEXT,
    "status" "DbDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "onchain_tx_signature" TEXT,
    "onchain_pda" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "required_signers" INTEGER NOT NULL DEFAULT 1,
    "signer_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "notaries" (
    "notary_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dsc_certificate_serial" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "cert_status" TEXT NOT NULL,

    CONSTRAINT "notaries_pkey" PRIMARY KEY ("notary_id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "signature_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "notary_id" TEXT NOT NULL,
    "signer_role" "DbSignerRole" NOT NULL,
    "signature_bytes" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("signature_id")
);

-- CreateTable
CREATE TABLE "verification_events" (
    "event_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_label" TEXT NOT NULL,
    "onchain_tx_ref" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "fraud_scores" (
    "document_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "signals" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_scores_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "ipfs_references" (
    "document_id" TEXT NOT NULL,
    "cid" TEXT NOT NULL,
    "key_reference" TEXT NOT NULL,

    CONSTRAINT "ipfs_references_pkey" PRIMARY KEY ("document_id")
);

-- CreateIndex
CREATE INDEX "documents_status_created_at_idx" ON "documents"("status", "created_at");

-- CreateIndex
CREATE INDEX "documents_owner_user_id_idx" ON "documents"("owner_user_id");

-- CreateIndex
CREATE INDEX "verification_events_document_id_occurred_at_idx" ON "verification_events"("document_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_notary_id_fkey" FOREIGN KEY ("notary_id") REFERENCES "notaries"("notary_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_scores" ADD CONSTRAINT "fraud_scores_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipfs_references" ADD CONSTRAINT "ipfs_references_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE RESTRICT ON UPDATE CASCADE;
