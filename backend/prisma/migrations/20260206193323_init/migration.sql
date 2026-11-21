-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('DEFAULT', 'GOOGLE', 'GITHUB');

-- CreateEnum
CREATE TYPE "OAuthClientType" AS ENUM ('PUBLIC', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('ACTIVE', 'RETIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "KeyUse" AS ENUM ('SIG', 'ENC');

-- CreateEnum
CREATE TYPE "KeyAlgorithm" AS ENUM ('RS256', 'ES256');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(99) NOT NULL,
    "email" VARCHAR(99) NOT NULL,
    "roles" "UserRole"[],
    "avatar" TEXT,
    "gender" "Gender" NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "provider" "AuthProvider" NOT NULL DEFAULT 'DEFAULT',
    "password" VARCHAR(100),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentitySession" (
    "token" CHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IdentitySession_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(99) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "clientSecretHash" VARCHAR(255),
    "clientType" "OAuthClientType" NOT NULL DEFAULT 'CONFIDENTIAL',
    "enforcePKCE" BOOLEAN NOT NULL DEFAULT true,
    "redirectURIs" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SigningKeys" (
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "use" "KeyUse" NOT NULL,
    "algorithm" "KeyAlgorithm" NOT NULL,
    "privateKeyEnc" JSONB NOT NULL,
    "publicKey" JSONB NOT NULL,
    "status" "KeyStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SigningKeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "IdentitySession_userId_revoked_expiresAt_idx" ON "IdentitySession"("userId", "revoked", "expiresAt");

-- CreateIndex
CREATE INDEX "IdentitySession_expiresAt_idx" ON "IdentitySession"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthClient_userId_idx" ON "OAuthClient"("userId");

-- CreateIndex
CREATE INDEX "OAuthClient_domain_idx" ON "OAuthClient"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "SigningKeys_kid_key" ON "SigningKeys"("kid");

-- CreateIndex
CREATE INDEX "OAuthConsent_clientId_idx" ON "OAuthConsent"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConsent_userId_clientId_key" ON "OAuthConsent"("userId", "clientId");

-- AddForeignKey
ALTER TABLE "IdentitySession" ADD CONSTRAINT "IdentitySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
