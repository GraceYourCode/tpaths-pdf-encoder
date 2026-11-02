import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      keyLength,
      {
        N: 16384,
        r: 8,
        p: 1,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      },
    );
  });
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scryptAsync(password, Buffer.from(salt, 'hex'), 64)) as Buffer;
  return `scrypt$16384$8$1$${salt}$${key.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = encoded.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const derived = (await scryptAsync(password, Buffer.from(salt, 'hex'), 64)) as Buffer;
  const expected = Buffer.from(key, 'base64url');
  return (
    expected.length === derived.length && timingSafeEqual(expected, derived)
  );
}

function b64(v: string): string {
  return Buffer.from(v).toString('base64url');
}

export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec: number,
): string {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresInSec,
    }),
  );
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyJwt<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): T {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('invalid token');
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest();
  const actual = Buffer.from(s, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error('invalid token');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as T;
  if (
    typeof payload.exp !== 'number' ||
    payload.exp <= Math.floor(Date.now() / 1000)
  )
    throw new Error('expired token');
  return payload;
}
