-- AlterEnum
ALTER TYPE "DbUserRole" ADD VALUE 'ADVOCATE';
ALTER TYPE "DbUserRole" ADD VALUE 'JUDGE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" TEXT,
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "password_hash" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "phone_hash" SET DEFAULT '',
ALTER COLUMN "email_hash" SET DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
