-- CreateEnum
CREATE TYPE "OAuthClientEnvironment" AS ENUM ('development', 'production');

-- AlterTable
ALTER TABLE "OAuthClient" ADD COLUMN     "environment" "OAuthClientEnvironment" NOT NULL DEFAULT 'development';
