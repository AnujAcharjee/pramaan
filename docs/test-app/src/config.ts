import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const PORT = Number(process.env.PORT ?? 3000);

export const CLIENT_URI = requireEnv('CLIENT_URI');
export const PRAMAAN_SERVER = requireEnv('PRAMAAN_SERVER');

export const CLIENT_ID = requireEnv('CLIENT_ID');
export const CLIENT_SECRET = requireEnv('CLIENT_SECRET');

export const CALLBACK_URL = `${CLIENT_URI}/oauth/callback`;
export const IS_HTTPS = CLIENT_URI.startsWith('https://');
