import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decryptEnvelopeV2, encryptEnvelopeV2 } from './envelope-v2.js';
import { EnvDekWrapper, PROVIDER_ENV } from '../../storage/dek-wrapper.js';
import { parseMasterKeyring } from './at-rest.js';

describe('envelope format 2 (environment wrapper)', () => {
  const ring = parseMasterKeyring(`1:${randomBytes(32).toString('base64')}`, 1);
  const wrapper = new EnvDekWrapper(ring);
  const wrappers = new Map([[PROVIDER_ENV, wrapper]]);
  const pdf = randomBytes(20_000);

  it('round-trips and writes the provider id', async () => {
    const blob = await encryptEnvelopeV2(pdf, wrapper);
    expect(await decryptEnvelopeV2(blob, wrappers)).toEqual(pdf);
    expect(blob.readUInt8(6)).toBe(PROVIDER_ENV);
  });

  it('uses a fresh data key per object', async () => {
    expect(await encryptEnvelopeV2(pdf, wrapper)).not.toEqual(await encryptEnvelopeV2(pdf, wrapper));
  });

  it('rejects tampering with the header or ciphertext', async () => {
    for (const offset of [7, 12, 40, 200]) {
      const blob = Buffer.from(await encryptEnvelopeV2(pdf, wrapper));
      blob[offset] ^= 1;
      await expect(decryptEnvelopeV2(blob, wrappers)).rejects.toThrow();
    }
  });

  it('rejects objects written under an unconfigured provider', async () => {
    const blob = await encryptEnvelopeV2(pdf, wrapper);
    await expect(decryptEnvelopeV2(blob, new Map())).rejects.toThrow(/not configured/);
  });
});
