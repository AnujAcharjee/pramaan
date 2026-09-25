import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import * as jose from 'jose';
import { joseService, type EncryptedPrivateKey } from '../src/services/jose.service.js';
import { ENV } from '../src/config/env.js';

const generateKey = () =>
  jose.generateKeyPair('RS256', { modulusLength: 2048, extractable: true });

describe('RSA Private Key Envelope Encryption (KEK + DEK)', () => {
  it('should encrypt RSA private key into a full two-tier envelope', async () => {
    const { privateKey } = await generateKey();

    const envelope = await joseService.encryptPrivateKey(privateKey);

    assert.ok(envelope.data, 'Envelope must contain payload ciphertext');
    assert.ok(envelope.iv, 'Envelope must contain data IV');
    assert.ok(envelope.tag, 'Envelope must contain data auth tag');
    assert.ok(envelope.encryptedDek, 'Envelope must contain wrapped DEK');
    assert.ok(envelope.dekIv, 'Envelope must contain DEK IV');
    assert.ok(envelope.dekTag, 'Envelope must contain DEK auth tag');
    assert.strictEqual(envelope.version, 'v2-envelope');

    // Check IV lengths (12 bytes base64 is 16 chars)
    assert.strictEqual(Buffer.from(envelope.iv, 'base64').length, 12);
    assert.strictEqual(Buffer.from(envelope.dekIv, 'base64').length, 12);

    // Check Tag lengths (16 bytes GCM auth tag)
    assert.strictEqual(Buffer.from(envelope.tag, 'base64').length, 16);
    assert.strictEqual(Buffer.from(envelope.dekTag, 'base64').length, 16);

    // Check wrapped DEK length (32 bytes AES-256 key ciphertext)
    assert.strictEqual(Buffer.from(envelope.encryptedDek!, 'base64').length, 32);
  });

  it('should unwrap DEK and decrypt private key correctly to sign tokens', async () => {
    const { privateKey, publicKey } = await generateKey();

    const envelope = await joseService.encryptPrivateKey(privateKey);
    const decryptedKeyObject = joseService.decryptPrivateKey(envelope);

    assert.ok(decryptedKeyObject, 'Decrypted key object must exist');
    assert.strictEqual(decryptedKeyObject.type, 'private');
    assert.strictEqual(decryptedKeyObject.asymmetricKeyType, 'rsa');

    // Test functional parity by signing a JWT with decrypted key and verifying with public key
    const jwt = await new jose.SignJWT({ test: 'envelope_encryption' })
      .setProtectedHeader({ alg: 'RS256' })
      .setExpirationTime('5m')
      .sign(decryptedKeyObject);

    const { payload } = await jose.jwtVerify(jwt, publicKey);
    assert.strictEqual(payload.test, 'envelope_encryption');
  });

  it('should generate distinct ephemeral DEKs for separate encryption operations', async () => {
    const { privateKey } = await generateKey();

    const envelope1 = await joseService.encryptPrivateKey(privateKey);
    const envelope2 = await joseService.encryptPrivateKey(privateKey);

    // Both envelopes must have different wrapped DEKs and different IVs
    assert.notStrictEqual(envelope1.encryptedDek, envelope2.encryptedDek);
    assert.notStrictEqual(envelope1.dekIv, envelope2.dekIv);
    assert.notStrictEqual(envelope1.iv, envelope2.iv);
    assert.notStrictEqual(envelope1.data, envelope2.data);

    // Both must decrypt cleanly
    const key1 = joseService.decryptPrivateKey(envelope1);
    const key2 = joseService.decryptPrivateKey(envelope2);
    assert.strictEqual(key1.asymmetricKeyType, 'rsa');
    assert.strictEqual(key2.asymmetricKeyType, 'rsa');
  });

  it('should reject tampered wrapped DEK (AES-GCM authentication failure)', async () => {
    const { privateKey } = await generateKey();
    const envelope = await joseService.encryptPrivateKey(privateKey);

    // Tamper with wrapped DEK bytes
    const dekBuf = Buffer.from(envelope.encryptedDek!, 'base64');
    dekBuf[0] ^= 0xff;
    const tamperedEnvelope: EncryptedPrivateKey = {
      ...envelope,
      encryptedDek: dekBuf.toString('base64'),
    };

    assert.throws(
      () => joseService.decryptPrivateKey(tamperedEnvelope),
      /unable to authenticate data|Unsupported state/i,
    );
  });

  it('should reject tampered DEK auth tag (AES-GCM authentication failure)', async () => {
    const { privateKey } = await generateKey();
    const envelope = await joseService.encryptPrivateKey(privateKey);

    // Tamper with DEK tag
    const tagBuf = Buffer.from(envelope.dekTag!, 'base64');
    tagBuf[0] ^= 0xff;
    const tamperedEnvelope: EncryptedPrivateKey = {
      ...envelope,
      dekTag: tagBuf.toString('base64'),
    };

    assert.throws(
      () => joseService.decryptPrivateKey(tamperedEnvelope),
      /unable to authenticate data|Unsupported state/i,
    );
  });

  it('should reject tampered ciphertext payload (AES-GCM authentication failure)', async () => {
    const { privateKey } = await generateKey();
    const envelope = await joseService.encryptPrivateKey(privateKey);

    // Tamper with payload data
    const dataBuf = Buffer.from(envelope.data, 'base64');
    dataBuf[0] ^= 0xff;
    const tamperedEnvelope: EncryptedPrivateKey = {
      ...envelope,
      data: dataBuf.toString('base64'),
    };

    assert.throws(
      () => joseService.decryptPrivateKey(tamperedEnvelope),
      /unable to authenticate data|Unsupported state/i,
    );
  });

  it('should support backward compatibility with legacy single-layer encrypted keys', async () => {
    const { privateKey, publicKey } = await generateKey();
    const pem = await jose.exportPKCS8(privateKey);

    // Manually create legacy single-layer encryption using KEY_ENC_SECRET directly
    const masterKey = Buffer.from(ENV.KEY_ENC_SECRET, 'hex');
    const legacyIv = crypto.randomBytes(12);
    const legacyCipher = crypto.createCipheriv('aes-256-gcm', masterKey, legacyIv);
    const legacyEncrypted = Buffer.concat([legacyCipher.update(pem, 'utf8'), legacyCipher.final()]);

    const legacyRecord: EncryptedPrivateKey = {
      data: legacyEncrypted.toString('base64'),
      iv: legacyIv.toString('base64'),
      tag: legacyCipher.getAuthTag().toString('base64'),
      // No encryptedDek, dekIv, or dekTag
    };

    const decryptedKeyObject = joseService.decryptPrivateKey(legacyRecord);
    assert.ok(decryptedKeyObject);
    assert.strictEqual(decryptedKeyObject.type, 'private');

    // Functional verification
    const jwt = await new jose.SignJWT({ legacy: true })
      .setProtectedHeader({ alg: 'RS256' })
      .setExpirationTime('5m')
      .sign(decryptedKeyObject);

    const { payload } = await jose.jwtVerify(jwt, publicKey);
    assert.strictEqual(payload.legacy, true);
  });

  it('should migrate a legacy single-layer key to v2-envelope without loss of cryptographic capability', async () => {
    const { privateKey, publicKey } = await generateKey();
    const pem = await jose.exportPKCS8(privateKey);

    // Create legacy record
    const masterKey = Buffer.from(ENV.KEY_ENC_SECRET, 'hex');
    const legacyIv = crypto.randomBytes(12);
    const legacyCipher = crypto.createCipheriv('aes-256-gcm', masterKey, legacyIv);
    const legacyEncrypted = Buffer.concat([legacyCipher.update(pem, 'utf8'), legacyCipher.final()]);

    const legacyRecord: EncryptedPrivateKey = {
      data: legacyEncrypted.toString('base64'),
      iv: legacyIv.toString('base64'),
      tag: legacyCipher.getAuthTag().toString('base64'),
    };

    // 1. Decrypt from legacy record
    const recoveredKey = joseService.decryptPrivateKey(legacyRecord);

    // 2. Re-encrypt under v2-envelope
    const newEnvelope = await joseService.encryptPrivateKey(recoveredKey);

    assert.ok(newEnvelope.encryptedDek, 'Migrated envelope must have encryptedDek');
    assert.ok(newEnvelope.dekIv, 'Migrated envelope must have dekIv');
    assert.ok(newEnvelope.dekTag, 'Migrated envelope must have dekTag');
    assert.strictEqual(newEnvelope.version, 'v2-envelope');

    // 3. Decrypt from new envelope
    const migratedKey = joseService.decryptPrivateKey(newEnvelope);
    assert.ok(migratedKey);

    // 4. Verify functional parity
    const jwt = await new jose.SignJWT({ migrated: true })
      .setProtectedHeader({ alg: 'RS256' })
      .setExpirationTime('5m')
      .sign(migratedKey);

    const { payload } = await jose.jwtVerify(jwt, publicKey);
    assert.strictEqual(payload.migrated, true);
  });
});
