import * as jose from 'jose';
import prisma from '../config/database.js';
import { joseService, type EncryptedPrivateKey } from '../services/jose.service.js';
import { logger } from '../config/logger.js';
import { Prisma } from '../../generated/prisma/client.js';

async function main() {
  console.log('\n============================================================');
  console.log('   PRAMAAN: ENVELOPE ENCRYPTION BACKFILL MIGRATION UTILITY   ');
  console.log('============================================================\n');

  try {
    const allKeys = await prisma.signingKeys.findMany({
      select: {
        id: true,
        kid: true,
        status: true,
        algorithm: true,
        privateKeyEnc: true,
        publicKey: true,
        createdAt: true,
      },
    });

    if (allKeys.length === 0) {
      console.log('ℹ️  No signing keys found in the database. Nothing to migrate.\n');
      return;
    }

    console.log(`Discovered ${allKeys.length} signing key record(s) in database.\n`);

    let alreadyMigrated = 0;
    let upgraded = 0;
    let errors = 0;

    for (const keyRecord of allKeys) {
      const enc = keyRecord.privateKeyEnc as unknown as EncryptedPrivateKey;
      const isEnvelope = Boolean(enc.encryptedDek && enc.dekIv && enc.dekTag && enc.version === 'v2-envelope');

      if (isEnvelope) {
        console.log(`  [OK] Key ID ${keyRecord.id} (kid: ${keyRecord.kid}) is already v2-envelope encrypted.`);
        alreadyMigrated++;
        continue;
      }

      console.log(`  [UPGRADE] Migrating legacy key ID ${keyRecord.id} (kid: ${keyRecord.kid}, status: ${keyRecord.status})...`);

      try {
        // 1. Decrypt raw private key using backward-compatible fallback path
        const decryptedKeyObject = joseService.decryptPrivateKey(enc);

        // 2. Re-encrypt under Two-Tier Envelope Encryption (fresh DEK + wrapped by KEK)
        const newEnvelope = await joseService.encryptPrivateKey(decryptedKeyObject);

        // 3. Cryptographic parity sanity check before persisting
        const testJwt = await new jose.SignJWT({ backfill_test: true })
          .setProtectedHeader({ alg: 'RS256' })
          .setExpirationTime('1m')
          .sign(decryptedKeyObject);
        await jose.jwtVerify(testJwt, keyRecord.publicKey as jose.JWK);

        // 4. Atomically persist updated envelope into database
        await prisma.signingKeys.update({
          where: { id: keyRecord.id },
          data: {
            privateKeyEnc: newEnvelope as unknown as Prisma.InputJsonValue,
          },
        });

        // 5. Post-migration verification from updated envelope
        const verifiedKey = joseService.decryptPrivateKey(newEnvelope);
        const recheckJwt = await new jose.SignJWT({ backfill_verified: true })
          .setProtectedHeader({ alg: 'RS256' })
          .setExpirationTime('1m')
          .sign(verifiedKey);
        await jose.jwtVerify(recheckJwt, keyRecord.publicKey as jose.JWK);

        console.log(`    ✅ Successfully upgraded to v2-envelope format.`);
        upgraded++;
      } catch (err) {
        console.error(`    ❌ Failed to migrate key ${keyRecord.id}:`, err);
        errors++;
      }
    }

    console.log('\n------------------------------------------------------------');
    console.log('MIGRATION SUMMARY:');
    console.log(`  Total Keys Evaluated:  ${allKeys.length}`);
    console.log(`  Already v2-envelope:   ${alreadyMigrated}`);
    console.log(`  Successfully Upgraded: ${upgraded}`);
    console.log(`  Errors:                ${errors}`);
    console.log('------------------------------------------------------------\n');

    if (errors === 0) {
      console.log('🎉 100% of signing keys in the database are now protected by Two-Tier Envelope Encryption!\n');
    } else {
      console.log('⚠️  Migration completed with errors. Please check the logs above.\n');
      process.exitCode = 1;
    }
  } catch (error) {
    logger.error('Fatal error during envelope migration:', error);
    console.error('\n❌ Fatal migration error:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
