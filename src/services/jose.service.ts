import * as jose from 'jose';
import crypto from 'crypto';
import prisma from '../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ENV } from '../config/env.js';
import { KEY_ALGORITHMS, KEY_STATUS, KEY_USE, CRYPTO_ALGORITHMS } from '../utils/constant.js';

export type EncryptedPrivateKey = {
  data: string;
  iv: string;
  tag: string;
  encryptedDek?: string;
  dekIv?: string;
  dekTag?: string;
  version?: string;
};

export class JoseService {
  private readonly ALG = KEY_ALGORITHMS.RS256;
  private readonly ENCRYPTION_KEY = Buffer.from(ENV.KEY_ENC_SECRET, 'hex');

  constructor() {
    if (this.ENCRYPTION_KEY.length !== 32) {
      throw new Error('KEY_ENC_SECRET must be 32 bytes (hex-encoded)');
    }
  }

  // --------------- Generate RSA signing keypair ---------------

  private async generateSigningKey() {
    const { privateKey, publicKey } = await jose.generateKeyPair(this.ALG, {
      modulusLength: 2048,
      extractable: true,
    });

    // Export public JWK
    const publicJwk = await jose.exportJWK(publicKey);

    const kid = crypto
      .createHash(CRYPTO_ALGORITHMS.sha256)
      .update(JSON.stringify(publicJwk))
      .digest('base64url')
      .slice(0, 32);

    publicJwk.kid = kid;
    publicJwk.use = 'sig';
    publicJwk.alg = this.ALG;

    return {
      id: crypto.randomUUID(),
      kid,
      algorithm: this.ALG,
      privateKey,
      publicJwk,
    };
  }

  // --------------- Encrypt private key (Envelope Encryption: AES-256-GCM DEK + KEK) ---------------

  public async encryptPrivateKey(privateKey: CryptoKey | crypto.KeyObject): Promise<EncryptedPrivateKey> {
    const pem = await jose.exportPKCS8(privateKey);

    // 1. Generate unique single-use Data Encryption Key (DEK) - 256-bit AES
    const dek = crypto.randomBytes(32);

    // 2. Encrypt the RSA PKCS#8 PEM payload with DEK using AES-256-GCM
    const dataIv = crypto.randomBytes(12);
    const dataCipher = crypto.createCipheriv('aes-256-gcm', dek, dataIv);
    const encryptedData = Buffer.concat([dataCipher.update(pem, 'utf8'), dataCipher.final()]);
    const dataTag = dataCipher.getAuthTag();

    // 3. Encrypt (wrap) DEK with the Key Encryption Key (KEK / master key) using AES-256-GCM
    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', this.ENCRYPTION_KEY, dekIv);
    const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekTag = dekCipher.getAuthTag();

    return {
      data: encryptedData.toString('base64'),
      iv: dataIv.toString('base64'),
      tag: dataTag.toString('base64'),
      encryptedDek: encryptedDek.toString('base64'),
      dekIv: dekIv.toString('base64'),
      dekTag: dekTag.toString('base64'),
      version: 'v2-envelope',
    };
  }

  // --------------- Decrypt private key (Envelope unwrapping + AES-256-GCM) ---------------

  public decryptPrivateKey(enc: EncryptedPrivateKey): crypto.KeyObject {
    let dek: Buffer;

    if (enc.encryptedDek && enc.dekIv && enc.dekTag) {
      // 1. Unwrap the DEK using the Key Encryption Key (KEK)
      const dekDecipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.ENCRYPTION_KEY,
        Buffer.from(enc.dekIv, 'base64'),
      );
      dekDecipher.setAuthTag(Buffer.from(enc.dekTag, 'base64'));
      dek = Buffer.concat([
        dekDecipher.update(Buffer.from(enc.encryptedDek, 'base64')),
        dekDecipher.final(),
      ]);
    } else {
      // Fallback for legacy single-layer encrypted keys
      dek = this.ENCRYPTION_KEY;
    }

    // 2. Decrypt the RSA private key payload using the unwrapped DEK
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(enc.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(enc.data, 'base64')),
      decipher.final(),
    ]);

    return crypto.createPrivateKey(decrypted.toString('utf8'));
  }

  // ---------------Initialize JWKS (first boot) ---------------

  async initJwks() {
    const keysCount = await prisma.signingKeys.count();
    if (keysCount >= 1) return;

    // start creation
    const key = await this.generateSigningKey();
    const encryptedPrivateKey = await this.encryptPrivateKey(key.privateKey);
    const publicKeyJson = key.publicJwk as Prisma.InputJsonValue;

    // store in DB
    await prisma.signingKeys.create({
      data: {
        id: key.id,
        kid: key.kid,
        use: KEY_USE.SIG,
        algorithm: KEY_ALGORITHMS.RS256,
        privateKeyEnc: encryptedPrivateKey,
        publicKey: publicKeyJson,
        status: KEY_STATUS.ACTIVE,
        createdAt: new Date(),
      },
    });
  }

  // --------------- Get active private signing key ---------------

  private async getActiveSigningKey() {
    const key = await prisma.signingKeys.findFirst({
      where: { status: 'ACTIVE', use: 'SIG' },
    });

    if (!key) {
      throw new Error('No active signing key found');
    }

    const privateKey = this.decryptPrivateKey(key.privateKeyEnc as EncryptedPrivateKey);

    return {
      kid: key.kid,
      privateKey,
    };
  }

  // TODO: Rotate keys in a scheduled manner
  // --------------- Rotate signing keys (safe) ---------------

  async rotateSigningKey() {
    const newKey = await this.generateSigningKey();
    const encryptedPrivateKey = await this.encryptPrivateKey(newKey.privateKey);
    const publicKeyJson = newKey.publicJwk as Prisma.InputJsonValue;

    // retire all old keys
    await prisma.$transaction(async (tx) => {
      await tx.signingKeys.updateMany({
        where: { status: 'ACTIVE', use: 'SIG' },
        data: {
          status: 'RETIRED',
          rotatedAt: new Date(),
        },
      });

      // add the new key as active
      await tx.signingKeys.create({
        data: {
          id: newKey.id,
          kid: newKey.kid,
          use: 'SIG',
          algorithm: KEY_ALGORITHMS.RS256,
          privateKeyEnc: encryptedPrivateKey,
          publicKey: publicKeyJson,
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      });
    });

    return {
      id: newKey.id,
      kid: newKey.kid,
    };
  }

  // --------------- JWKS for public endpoint ---------------

  async getJwks() {
    const keys = await prisma.signingKeys.findMany({
      where: {
        status: { in: ['ACTIVE', 'RETIRED'] },
        use: 'SIG',
      },
      select: {
        publicKey: true,
      },
    });

    return Object.freeze({
      keys: keys.map((k) => k.publicKey),
    });
  }

  // --------------- Sign JWT (Access / ID token) ---------------

  async signJwt(
    payload: Record<string, unknown>,
    options: {
      issuer: string;
      audience: string;
      expiresIn: string;
    },
  ) {
    const { privateKey, kid } = await this.getActiveSigningKey();

    return new jose.SignJWT(payload)
      .setProtectedHeader({ alg: this.ALG, kid })
      .setIssuer(options.issuer)
      .setAudience(options.audience)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn)
      .sign(privateKey);
  }

  // --------------- Verify JWT ---------------

  private resolveSigningKey = async (header: jose.JWTHeaderParameters) => {
    if (!header.kid) throw new Error('Missing kid');

    if (header.alg !== KEY_ALGORITHMS.RS256) {
      throw new Error('Invalid signing algorithm');
    }

    const key = await prisma.signingKeys.findUnique({
      where: { kid: header.kid },
    });

    if (!key || key.status === KEY_STATUS.REVOKED) {
      throw new Error('Invalid signing key');
    }

    return jose.importJWK(key.publicKey as jose.JWK, key.algorithm);
  };

  async verifyJwt(token: string, audience: string) {
    const { payload } = await jose.jwtVerify(token, this.resolveSigningKey, {
      issuer: ENV.AUTH_ISSUER,
      audience,
    });

    return {
      sub: String(payload.sub),
      aud: Array.isArray(payload.aud) ? payload.aud[0] : String(payload.aud),
      scope: typeof payload.scope === 'string' ? payload.scope : '',
      exp: payload.exp,
      iss: payload.iss,
    };
  }
}

export const joseService = new JoseService();
