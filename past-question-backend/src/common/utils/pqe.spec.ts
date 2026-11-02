// TPQE v1 protocol tests. See docs/pqe-artifact-protocol.md.
import { it } from 'vitest';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, randomBytes } from 'node:crypto';
import {
  encodePqeArtifact, decodePqeArtifact, parsePqeArtifact, parseP256PublicKeyDer,
  decodeDevicePublicKeyBase64, PQE_HEADER_LEN, PqeError,
} from './pqe.js';

const dev = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const devPubDer = Buffer.from(dev.publicKey.export({ format: 'der', type: 'spki' }));
const devId = randomUUID();
const pdf = randomBytes(10_000);
const input = { pdf, artifactId: randomUUID(), documentId: randomUUID(), deviceId: devId, devicePublicKeyDer: devPubDer };
const enc = () => encodePqeArtifact(input);

const t = (name: string, fn: () => void) => it(name, fn);

t('round-trip recovers exact PDF bytes', () => {
  const a = enc();
  assert.deepEqual(decodePqeArtifact(a, dev.privateKey, devPubDer), pdf);
  const p = parsePqeArtifact(a);
  assert.equal(p.deviceId, devId); assert.equal(p.version, 1); assert.equal(p.suite, 1);
  assert.equal(a.length, PQE_HEADER_LEN + pdf.length);
});

t('fresh keys/nonces per artifact (different ciphertext for same input)', () => {
  const a = enc(), b = enc();
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(parsePqeArtifact(a).ephemeralPoint, parsePqeArtifact(b).ephemeralPoint);
  assert.notDeepEqual(parsePqeArtifact(a).pdfIv, parsePqeArtifact(b).pdfIv);
  assert.notDeepEqual(parsePqeArtifact(a).hkdfSalt, parsePqeArtifact(b).hkdfSalt);
});

t('wrong device private key cannot decrypt', () => {
  const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  assert.throws(() => decodePqeArtifact(enc(), other.privateKey, devPubDer));
});

t('wrong device public-key binding fails (key-binding in HKDF info)', () => {
  const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const otherDer = Buffer.from(other.publicKey.export({ format: 'der', type: 'spki' }));
  assert.throws(() => decodePqeArtifact(enc(), dev.privateKey, otherDer));
});

// Flip one byte in every header field and in the ciphertext; each must fail closed.
const a0 = enc();
const regions: [string, number][] = [
  ['artifactId', 8], ['documentId', 24], ['deviceId', 40], ['ephemeralPoint', 60],
  ['hkdfSalt', 130], ['wrapIv', 155], ['wrappedDek', 170], ['wrapTag', 200],
  ['pdfIv', 215], ['ciphertextLen', 228], ['pdfTag', 240], ['ciphertext', PQE_HEADER_LEN + 100],
];
for (const [name, off] of regions) {
  t(`tamper ${name} is rejected`, () => {
    const bad = Buffer.from(a0); bad[off] ^= 0x01;
    assert.throws(() => decodePqeArtifact(bad, dev.privateKey, devPubDer));
  });
}

t('truncated artifact rejected', () => assert.throws(() => decodePqeArtifact(a0.subarray(0, 100), dev.privateKey, devPubDer), PqeError));
t('trailing bytes rejected (length mismatch)', () => assert.throws(() => decodePqeArtifact(Buffer.concat([a0, Buffer.from([0])]), dev.privateKey, devPubDer), PqeError));
t('bad magic rejected', () => { const b = Buffer.from(a0); b[0] = 0x00; assert.throws(() => parsePqeArtifact(b), /magic/); });
t('unsupported version rejected', () => { const b = Buffer.from(a0); b[4] = 2; assert.throws(() => parsePqeArtifact(b), /version/); });
t('unsupported suite rejected', () => { const b = Buffer.from(a0); b[5] = 9; assert.throws(() => parsePqeArtifact(b), /suite/); });
t('nonzero reserved bytes rejected', () => { const b = Buffer.from(a0); b[6] = 1; assert.throws(() => parsePqeArtifact(b), /Reserved/); });

t('public key: valid P-256 SPKI accepted', () => {
  const b64 = devPubDer.toString('base64');
  assert.deepEqual(decodeDevicePublicKeyBase64(b64), devPubDer);
});
t('public key: RSA key rejected', () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const der = Buffer.from(rsa.publicKey.export({ format: 'der', type: 'spki' }));
  assert.throws(() => decodeDevicePublicKeyBase64(der.toString('base64')), PqeError);
});
t('public key: P-384 key rejected', () => {
  const p384 = generateKeyPairSync('ec', { namedCurve: 'P-384' });
  const der = Buffer.from(p384.publicKey.export({ format: 'der', type: 'spki' }));
  assert.throws(() => decodeDevicePublicKeyBase64(der.toString('base64')), PqeError);
});
t('public key: off-curve point rejected', () => {
  const bad = Buffer.from(devPubDer); bad[bad.length - 1] ^= 0x01;
  assert.throws(() => parseP256PublicKeyDer(bad), PqeError);
});
t('public key: non-base64 garbage rejected', () => assert.throws(() => decodeDevicePublicKeyBase64('not base64!!'), PqeError));
t('encode rejects non-UUID device id', () => assert.throws(() => encodePqeArtifact({ ...input, deviceId: 'abc' }), PqeError));
t('encode rejects empty PDF', () => assert.throws(() => encodePqeArtifact({ ...input, pdf: Buffer.alloc(0) }), PqeError));

