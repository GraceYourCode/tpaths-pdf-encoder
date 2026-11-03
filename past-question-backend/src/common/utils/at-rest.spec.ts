import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  AtRestError,
  decryptAtRest,
  developmentKeyring,
  encryptAtRest,
  keyVersionOf,
  parseMasterKeyring,
} from './at-rest.js';

const k = () => randomBytes(32).toString('base64');

describe('at-rest envelope encryption', () => {
  const ring = parseMasterKeyring(`1:${k()},2:${k()}`, 2);
  const pdf = randomBytes(50_000);

  it('round-trips and records the active key version', () => {
    const blob = encryptAtRest(pdf, ring);
    expect(decryptAtRest(blob, ring)).toEqual(pdf);
    expect(keyVersionOf(blob)).toBe(2);
  });

  it('stores no plaintext', () => {
    expect(encryptAtRest(pdf, ring).indexOf(pdf.subarray(100, 140))).toBe(-1);
  });

  it('uses fresh data keys and IVs per object', () => {
    expect(encryptAtRest(pdf, ring)).not.toEqual(encryptAtRest(pdf, ring));
  });

  it('reads objects written under a retired key version', () => {
    const old = parseMasterKeyring(`1:${k()}`, 1);
    const blob = encryptAtRest(pdf, old);
    const rotated = parseMasterKeyring(`1:${[...old.keys.values()][0].toString('base64')},2:${k()}`, 2);
    expect(decryptAtRest(blob, rotated)).toEqual(pdf);
  });

  it.each([
    ['magic', 0],
    ['format', 5],
    ['key version', 6],
    ['wrap IV', 10],
    ['wrapped DEK', 30],
    ['wrap tag', 60],
    ['data IV', 70],
    ['data tag', 85],
    ['ciphertext', 200],
  ])('rejects tampering with %s', (_name, offset) => {
    const blob = Buffer.from(encryptAtRest(pdf, ring));
    blob[offset] ^= 1;
    expect(() => decryptAtRest(blob, ring)).toThrow();
  });

  it('rejects unknown key versions and wrong keys', () => {
    const blob = encryptAtRest(pdf, ring);
    expect(() => decryptAtRest(blob, parseMasterKeyring(`1:${k()}`, 1))).toThrow(/not configured/);
    expect(() => decryptAtRest(blob, parseMasterKeyring(`2:${k()}`, 2))).toThrow();
  });

  it('rejects legacy plaintext and truncated objects', () => {
    expect(() => decryptAtRest(pdf, ring)).toThrow(/not in the encrypted/);
    expect(() => decryptAtRest(encryptAtRest(pdf, ring).subarray(0, 50), ring)).toThrow(/truncated/);
  });

  it('validates keyring configuration', () => {
    expect(() => parseMasterKeyring(`1:${randomBytes(16).toString('base64')}`, 1)).toThrow(AtRestError);
    expect(() => parseMasterKeyring(`1:${k()}`, 3)).toThrow(/not present/);
    expect(() => parseMasterKeyring(`1:${k()},1:${k()}`, 1)).toThrow(/Duplicate/);
    expect(() => parseMasterKeyring('', 1)).toThrow();
  });

  it('development keyring round-trips', () => {
    const d = developmentKeyring();
    expect(decryptAtRest(encryptAtRest(pdf, d), d)).toEqual(pdf);
  });
});
