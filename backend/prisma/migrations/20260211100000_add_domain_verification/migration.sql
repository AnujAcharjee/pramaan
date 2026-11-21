-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'VERIFIED');

-- AlterTable
ALTER TABLE "OAuthClient" ADD COLUMN     "domainStatus" "DomainStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "domainVerificationMethod" VARCHAR(30) NOT NULL DEFAULT 'DNS_TXT',
ADD COLUMN     "domainVerificationToken" VARCHAR(255),
ADD COLUMN     "domainVerifiedAt" TIMESTAMP(3);
