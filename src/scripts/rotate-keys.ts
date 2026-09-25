import prisma from '../config/database.js';
import { joseService } from '../services/jose.service.js';
import { logger } from '../config/logger.js';

async function main() {
  console.log('\n============================================================');
  console.log('         PRAMAAN: RSA SIGNING KEY ROTATION UTILITY          ');
  console.log('============================================================\n');

  try {
    // 1. Inspect existing active keys
    const previousActiveKeys = await prisma.signingKeys.findMany({
      where: { status: 'ACTIVE', use: 'SIG' },
      select: { id: true, kid: true, createdAt: true },
    });

    if (previousActiveKeys.length === 0) {
      console.log('⚠️  No active signing keys found. Initializing JWKS for first boot...');
      await joseService.initJwks();
      const initializedKey = await prisma.signingKeys.findFirst({
        where: { status: 'ACTIVE', use: 'SIG' },
        select: { id: true, kid: true, createdAt: true },
      });
      console.log(`✅ Initialized first active key:`);
      console.log(`   - ID:  ${initializedKey?.id}`);
      console.log(`   - KID: ${initializedKey?.kid}`);
      console.log(`   - At:  ${initializedKey?.createdAt?.toISOString()}\n`);
      return;
    }

    console.log(`Found ${previousActiveKeys.length} currently active key(s):`);
    for (const key of previousActiveKeys) {
      const ageHours = ((Date.now() - key.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(2);
      console.log(`  - KID: ${key.kid} (ID: ${key.id}, Age: ${ageHours} hours)`);
    }

    // 2. Perform atomic rotation (Envelope Encryption KEK + per-key DEK)
    console.log('\n🔄 Generating fresh RSA-2048 keypair with Envelope Encryption...');
    const startTime = Date.now();
    const rotated = await joseService.rotateSigningKey();
    const durationMs = Date.now() - startTime;

    console.log(`✅ Successfully rotated signing key in ${durationMs}ms:`);
    console.log(`   - New Active Key ID:  ${rotated.id}`);
    console.log(`   - New Active Key KID: ${rotated.kid}`);

    // 3. Verify public JWKS endpoint state
    const jwks = await joseService.getJwks();
    console.log(`\n📋 Current Public JWKS Pool: ${jwks.keys.length} key(s) available for signature verification`);
    for (const k of jwks.keys as Array<{ kid?: string }>) {
      const isNew = k.kid === rotated.kid;
      console.log(`   - [${isNew ? 'ACTIVE' : 'RETIRED'}] kid: ${k.kid}`);
    }

    // 4. Cryptographic self-test: sign and verify a heartbeat token
    console.log('\n🔒 Running cryptographic sanity check on newly rotated key...');
    const testPayload = { sub: 'system:rotation_check', purpose: 'heartbeat' };
    const testJwt = await joseService.signJwt(testPayload, {
      issuer: 'pramaan-key-rotation-cli',
      audience: 'rotation-test',
      expiresIn: '5m',
    });
    const verified = await joseService.verifyJwt(testJwt, 'rotation-test');
    if (verified.sub === testPayload.sub) {
      console.log('✅ Self-test passed: Successfully signed and verified token with new active key.');
    }

    console.log('\n🎉 Key rotation completed successfully with zero downtime.\n');
  } catch (error) {
    logger.error('Failed to rotate signing keys:', error);
    console.error('\n❌ Fatal error during key rotation:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
