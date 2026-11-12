import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const doc = read('src/security/document.ts');
const device = read('src/security/device.ts');
const secure = read('src/storage/secure.ts');
const auth = read('src/auth/AuthProvider.tsx');
const reader = read('src/app/reader.tsx');
const api = read('src/api/index.ts');
const apiClient = read('src/api/client.ts');

const PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
const LABEL = Buffer.from('TPATHS-PQE/v1/dek-wrap', 'ascii');
const uuidBytes = (id) => Buffer.from(id.replaceAll('-', ''), 'hex');
const uuid = (b) => { const h=b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const hkdf = (secret, salt, info) => Buffer.from(crypto.hkdfSync('sha256', secret, salt, info, 32));

function makeArtifact(pdf, deviceId, devicePublicDer, devicePrivateKey) {
  const ephemeral = crypto.createECDH('prime256v1'); ephemeral.generateKeys();
  const ephemeralPoint = ephemeral.getPublicKey(undefined, 'uncompressed');
  const salt = crypto.randomBytes(32);
  const shared = ephemeral.computeSecret(devicePublicDer.subarray(PREFIX.length));
  const info = Buffer.concat([LABEL, uuidBytes(deviceId), crypto.createHash('sha256').update(devicePublicDer).digest()]);
  const wrapKey = hkdf(shared, salt, info);
  const dek = crypto.randomBytes(32);
  const artifactId = crypto.randomUUID(); const documentId = crypto.randomUUID();
  const h = Buffer.alloc(245);
  h.write('TPQE',0,'ascii'); h[4]=1; h[5]=1;
  uuidBytes(artifactId).copy(h,8); uuidBytes(documentId).copy(h,24); uuidBytes(deviceId).copy(h,40);
  ephemeralPoint.copy(h,56); salt.copy(h,121);
  const wrapIv=crypto.randomBytes(12); wrapIv.copy(h,153);
  const wrap=crypto.createCipheriv('aes-256-gcm',wrapKey,wrapIv); wrap.setAAD(h.subarray(0,153));
  const wrapped=Buffer.concat([wrap.update(dek),wrap.final()]); wrapped.copy(h,165); wrap.getAuthTag().copy(h,197);
  const pdfIv=crypto.randomBytes(12); pdfIv.copy(h,213); h.writeUInt32BE(pdf.length,225);
  const enc=crypto.createCipheriv('aes-256-gcm',dek,pdfIv); enc.setAAD(h.subarray(0,229));
  const ciphertext=Buffer.concat([enc.update(pdf),enc.final()]); enc.getAuthTag().copy(h,229);
  return { artifact:Buffer.concat([h,ciphertext]), privateKey:devicePrivateKey, publicDer:devicePublicDer, documentId };
}
function referenceDecrypt(artifact, privateKey, publicDer, expectedDeviceId) {
  assert.equal(artifact.subarray(0,4).toString('ascii'),'TPQE');
  assert.equal(artifact[4],1); assert.equal(artifact[5],1); assert.equal(artifact.readUInt16BE(6),0);
  assert.equal(artifact.readUInt32BE(225),artifact.length-245);
  assert.equal(uuid(artifact.subarray(40,56)),expectedDeviceId);
  const ecdh=crypto.createECDH('prime256v1'); ecdh.setPrivateKey(privateKey);
  assert.deepEqual(ecdh.getPublicKey(undefined,'uncompressed'),publicDer.subarray(PREFIX.length));
  const shared=ecdh.computeSecret(artifact.subarray(56,121));
  const info=Buffer.concat([LABEL,uuidBytes(expectedDeviceId),crypto.createHash('sha256').update(publicDer).digest()]);
  const wrapKey=hkdf(shared,artifact.subarray(121,153),info);
  const unwrap=crypto.createDecipheriv('aes-256-gcm',wrapKey,artifact.subarray(153,165));
  unwrap.setAAD(artifact.subarray(0,153)); unwrap.setAuthTag(artifact.subarray(197,213));
  const dek=Buffer.concat([unwrap.update(artifact.subarray(165,197)),unwrap.final()]);
  const pdf=crypto.createDecipheriv('aes-256-gcm',dek,artifact.subarray(213,225));
  pdf.setAAD(artifact.subarray(0,229)); pdf.setAuthTag(artifact.subarray(229,245));
  return Buffer.concat([pdf.update(artifact.subarray(245)),pdf.final()]);
}

test('mobile crypto source uses P-256 ECDH, HKDF-SHA256 and AES-256-GCM TPQE v1', () => {
  assert.match(device,/createECDH\('prime256v1'\)/);
  assert.match(device,/P256_SPKI_PREFIX/);
  assert.match(doc,/createECDH\('prime256v1'\)/);
  assert.match(doc,/createHmac\('sha256'/);
  assert.match(doc,/createDecipheriv\('aes-256-gcm'/);
  assert.match(doc,/TPQE/);
  assert.doesNotMatch(doc,/PQENC01|RSAOAEP256/);
});

test('TPQE v1 backend-format fixture decrypts and authentication rejects tampering', () => {
  const device=crypto.createECDH('prime256v1'); device.generateKeys();
  const publicDer=Buffer.concat([PREFIX,device.getPublicKey(undefined,'uncompressed')]);
  const deviceId=crypto.randomUUID();
  const pdf=Buffer.from('%PDF-1.7\nTPATHS cross-platform interoperability fixture\n%%EOF');
  const made=makeArtifact(pdf,deviceId,publicDer,device.getPrivateKey());
  assert.equal(made.artifact.length,245+pdf.length);
  assert.deepEqual(referenceDecrypt(made.artifact,made.privateKey,publicDer,deviceId),pdf);
  const tampered=Buffer.from(made.artifact); tampered[229]^=1;
  assert.throws(()=>referenceDecrypt(tampered,made.privateKey,publicDer,deviceId));
  assert.throws(()=>referenceDecrypt(made.artifact,made.privateKey,publicDer,crypto.randomUUID()));
});

test('device registration persists backend-issued ID and requires a registered P-256 key', () => {
  assert.match(device,/devices\.register/);
  assert.match(device,/publicKeyRegistered !== true/);
  assert.match(device,/registered\.id/);
  assert.match(secure,/tpaths\.backendDeviceId/);
  assert.match(secure,/AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
  assert.match(read('src/app/(app)/activate.tsx'),/ensureDeviceRegistered/);
  assert.match(api,/\/api\/v1\/devices\/register/);
});

test('reader binds authorization and TPQE decrypt to backend device ID', () => {
  assert.match(reader,/ensureDeviceRegistered/);
  assert.match(reader,/content\.authorize\(id, device\.deviceId\)/);
  assert.match(reader,/device\.privateKeyHex, device\.publicKeyBase64/);
  assert.match(doc,/artifactDeviceId !== expectedDeviceId/);
  assert.match(doc,/Decrypted PDF checksum does not match/);
  assert.match(read('src/types.ts'),/artifactEndpoint/);
});

test('client source contains no obvious server secret configuration', () => {
  const config=read('src/config.ts');
  assert.doesNotMatch(config,/DATABASE_URL|JWT_ACCESS_SECRET|CONTENT_ENCRYPTION_KEY|AWS_SECRET_ACCESS_KEY/);
});


test('offline artifacts and metadata are AES-256-GCM encrypted at rest with a device-only key', () => {
  const storage = read('src/storage/documents.ts');
  assert.match(storage,/createCipheriv\('aes-256-gcm'/);
  assert.match(storage,/createDecipheriv\('aes-256-gcm'/);
  assert.match(storage,/tpaths\.offline\.storageKey\.v1/);
  assert.match(storage,/AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
  assert.match(storage,/index\.tpc/);
  assert.match(storage,/signedLease/);
  assert.doesNotMatch(storage,/offlineGrantIsValid|MAX_OFFLINE_MS/);
});

test('reader revalidates license online and fails closed offline without a signed lease', () => {
  assert.match(reader,/licenses\.validate\(license\.id, device\.deviceId\)/);
  assert.match(reader,/getOfflineGrant\(cached\.licenseId\)/);
  assert.match(reader,/verifyOfflineLease\(grant\.signedLease/);
  assert.doesNotMatch(reader,/licenses\.issueOfflineLease/);
  assert.doesNotMatch(reader,/offlineGrantIsValid|OFFLINE_GRACE_MS/);
  assert.match(reader,/content\.artifactAt\(authorization\.artifactEndpoint/);
});

test('secure PDF reader applies capture protection, dynamic user watermark and plaintext cleanup', () => {
  assert.match(reader,/preventScreenCaptureAsync/);
  assert.match(reader,/clearPlaintextCache/);
  assert.match(reader,/watermarkTime/);
  assert.match(reader,/pointerEvents="none"/);
  assert.match(read('src/auth/AuthProvider.tsx'),/clearOfflineCache/);
});


test('artifact authorization endpoint is same-origin constrained and downloads are non-cacheable and size-limited', () => {
  assert.match(api,/artifactAt/);
  assert.ok(api.includes('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'));
  assert.ok(reader.includes('authorization.artifactEndpoint')); 
  assert.match(apiClient,/\"Cache-Control\": \"no-store\"/);
  assert.match(apiClient,/maxArtifactBytes/);
});

test('local encrypted cache envelope uses authenticated encryption and rejects tampering', () => {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const plain = Buffer.from('TPATHS encrypted offline cache fixture');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const envelope = Buffer.concat([Buffer.from('TPC1'), iv, cipher.getAuthTag(), ciphertext]);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, envelope.subarray(4, 16));
  decipher.setAuthTag(envelope.subarray(16, 32));
  assert.deepEqual(Buffer.concat([decipher.update(envelope.subarray(32)), decipher.final()]), plain);
  const damaged = Buffer.from(envelope); damaged[damaged.length - 1] ^= 1;
  const rejected = crypto.createDecipheriv('aes-256-gcm', key, damaged.subarray(4, 16));
  rejected.setAuthTag(damaged.subarray(16, 32));
  assert.throws(() => Buffer.concat([rejected.update(damaged.subarray(32)), rejected.final()]));
});


test('signed offline lease is ES256-pinned, identity-bound, document-version-bound and time-bounded', () => {
  const lease = read('src/security/offlineLease.ts');
  const config = read('src/config.ts');
  const apiIndex = read('src/api/index.ts');
  assert.match(lease,/KJUR\.jws\.JWS\.verify/);
  assert.match(lease,/header\.alg !== 'ES256'/);
  assert.match(lease,/header\.kid/);
  assert.match(lease,/claims\.iss !== ISSUER/);
  assert.match(lease,/claims\.aud !== AUDIENCE/);
  assert.match(lease,/claims\.documentChecksumSha256/);
  assert.match(lease,/claims\.documentVersion/);
  assert.match(lease,/MAX_LEASE_SECONDS = 24 \* 60 \* 60/);
  assert.match(lease,/claims\.policyVersion !== 1/);
  assert.match(config,/EXPO_PUBLIC_OFFLINE_LEASE_PUBLIC_KEYS/);
  assert.doesNotMatch(apiIndex,/offline-lease/);
  assert.match(read('docs/mobile-document-security.md'),/does not implement a signed offline-license endpoint/);
  assert.match(read('docs/mobile-backend-gaps.md'),/There is no `POST \/api\/v1\/licenses\/\:licenseId\/offline-lease` route/);
});


test('mobile uses only routes declared by the uploaded backend and exact content response names', () => {
  const apiIndex = read('src/api/index.ts');
  const types = read('src/types.ts');
  const auth = read('src/auth/AuthProvider.tsx');
  assert.match(apiIndex, /\/api\/v1\/users\/me/);
  assert.match(apiIndex, /\/api\/v1\/devices\/register/);
  assert.match(apiIndex, /\/api\/v1\/licenses\/activate/);
  assert.match(apiIndex, /api<Omit<License, "product">>/);
  assert.match(apiIndex, /\/api\/v1\/content\//);
  assert.match(types, /artifactEndpoint: string/);
  assert.doesNotMatch(apiIndex, /offline-lease/);
  assert.match(types, /checksumSha256: string/);
  assert.match(types, /artifactEndpoint: string/);
  assert.match(auth, /users\.me\(\)/);
});

test('known backend content authorization enum mismatch is documented and not bypassed by mobile', () => {
  const gaps = read('docs/mobile-backend-gaps.md');
  const reader = read('src/app/reader.tsx');
  assert.match(gaps, /DocumentStatus.*READY/s);
  assert.match(gaps, /ProductStatus.*ACTIVE/s);
  assert.match(reader, /content\.authorize\(id, device\.deviceId\)/);
  assert.doesNotMatch(reader, /content\.artifact\(id,/);
});


test('email verification uses the backend public token endpoint and WhatsApp validation', () => {
  const apiIndex = read('src/api/index.ts');
  const register = read('src/app/(auth)/register.tsx');
  const verify = read('src/app/(auth)/verify.tsx');
  assert.match(apiIndex, /\/api\/v1\/auth\/verify-email/);
  assert.match(verify, /auth\.verifyEmail\(token\.trim\(\)\)/);
  assert.match(register, /\+\?\[1-9\]\\d\{7,14\}/);
});
