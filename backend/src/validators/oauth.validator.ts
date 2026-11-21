import { z } from 'zod';
import { CRYPTO_ALGORITHMS, type CryptoAlgorithm } from '../utils/constant.js';

export class OAuthZSchema {
  static authorizeSchema = z.object({
    query: z.object({
      response_type: z.literal('code', {
        message: 'Unsupported response_type. Only "code" is allowed.',
      }),
      client_id: z
        .string({
          message: 'client_id must be a string.',
        })
        .min(1, 'client_id is required.'),
      redirect_uri: z.url('redirect_uri must be a valid absolute URL.'),
      scope: z.string({ message: 'scope must be a string.' }).min(1, 'scope is required'),
      state: z.string().optional(),
      nonce: z.string().optional(),
      code_challenge: z
        .string()
        .min(43, 'code_challenge must be at least 43 characters (PKCE spec).')
        .optional(),
      code_challenge_method: z.enum(['S256', 'plain']).optional(),
      code_challenge_algo: z
        .enum(Object.values(CRYPTO_ALGORITHMS) as [CryptoAlgorithm, ...CryptoAlgorithm[]], {
          message: 'Invalid code_challenge_method.',
        })
        .optional(),
    }),
  });

  static consentSchema = z.object({
    body: z.object({
      request_id: z.string().min(1, 'request_id is required'),
      decision: z.enum(['approve', 'deny']),
    }),
  });

  static issueTokensSchema = z.object({
    body: z.object({
      grant_type: z.literal('authorization_code', {
        message: 'unsupported_grant_type: Only "authorization_code" grant_type is supported.',
      }),
      code: z
        .string({ message: 'authorization code must be a string' })
        .min(1, 'authorization code is required'),
      client_id: z.string({ message: 'client_id must be a string' }).min(1, 'client_id is required'),
      code_verifier: z
        .string({ message: 'code_verifier must be a string' })
        .min(43, 'code_verifier must be at least 43 characters.')
        .max(128, 'invalid_request: code_verifier must not exceed 128 characters (PKCE spec).')
        .optional(),
    }),
  });
}
