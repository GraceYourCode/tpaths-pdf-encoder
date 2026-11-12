import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Buffer, createCipheriv, createDecipheriv, randomBytes } from 'react-native-quick-crypto';

const dir = new Directory(Paths.document, 'tpaths-documents');
const plainDir = new Directory(Paths.cache, 'tpaths-reader-temp');
const index = new File(dir, 'index.tpc');
const KEY_ID = 'tpaths.offline.storageKey.v1';
const GRANT_PREFIX = 'tpaths.offline.grant.';
const GRANT_IDS = 'tpaths.offline.grantIds';
const MAGIC = Buffer.from('TPC1', 'ascii');

export type Offline = {
  documentId: string;
  productId?: string;
  licenseId: string;
  title: string;
  version: number;
  encryptedPath: string;
  checksumSha256?: string | null;
  cachedAt: string;
  licenseExpiresAt?: string | null;
};
export type OfflineGrant = { signedLease: string };

function ensure() {
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
}
function safeId(value: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('Invalid document identifier.');
  return value;
}
async function storageKey(): Promise<Buffer> {
  let encoded = await SecureStore.getItemAsync(KEY_ID);
  if (!encoded) {
    encoded = randomBytes(32).toString('base64');
    await SecureStore.setItemAsync(KEY_ID, encoded, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('Offline storage key is invalid.');
  return key;
}
function seal(plain: Uint8Array, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plain)), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}
function open(sealed: Uint8Array, key: Buffer): Buffer {
  const b = Buffer.from(sealed);
  if (b.length < 32 || !b.subarray(0, 4).equals(MAGIC)) throw new Error('Offline cache is damaged.');
  const decipher = createDecipheriv('aes-256-gcm', key, b.subarray(4, 16), { authTagLength: 16 });
  decipher.setAuthTag(b.subarray(16, 32));
  return Buffer.concat([decipher.update(b.subarray(32)), decipher.final()]);
}
async function readIndex(): Promise<Offline[]> {
  ensure();
  if (!index.exists) return [];
  const key = await storageKey();
  try {
    const decoded = open(await index.bytes(), key);
    const value = JSON.parse(decoded.toString('utf8')) as Offline[];
    decoded.fill(0);
    return Array.isArray(value) ? value : [];
  } catch {
    // Fail closed: do not treat an unreadable index as an empty but usable cache.
    throw new Error('Offline document index could not be authenticated. Clear the offline cache and download again.');
  } finally { key.fill(0); }
}
async function writeIndex(rows: Offline[]) {
  ensure();
  const key = await storageKey();
  const plain = Buffer.from(JSON.stringify(rows), 'utf8');
  try {
    const sealed = seal(plain, key);
    index.create({ overwrite: true });
    index.write(new Uint8Array(sealed));
    sealed.fill(0);
  } finally { plain.fill(0); key.fill(0); }
}
export async function getOffline(id: string) {
  return (await readIndex()).find(x => x.documentId === id) ?? null;
}
export async function saveOffline(
  id: string,
  bytes: Uint8Array,
  metadata: Omit<Offline, 'documentId' | 'encryptedPath' | 'cachedAt'>,
) {
  ensure();
  const file = new File(dir, `${safeId(id)}.tpc`);
  const key = await storageKey();
  try {
    const sealed = seal(bytes, key);
    file.create({ overwrite: true });
    file.write(new Uint8Array(sealed));
    sealed.fill(0);
  } finally { key.fill(0); }
  const rows = (await readIndex()).filter(x => x.documentId !== id);
  rows.push({ documentId: id, ...metadata, encryptedPath: file.uri, cachedAt: new Date().toISOString() });
  await writeIndex(rows);
}
export async function readOffline(uri: string) {
  const key = await storageKey();
  try {
    const plain = open(await new File(uri).bytes(), key);
    return new Uint8Array(plain);
  } finally { key.fill(0); }
}
export async function removeOffline(id: string) {
  const rows = await readIndex();
  const entry = rows.find(x => x.documentId === id);
  if (entry) { const f = new File(entry.encryptedPath); if (f.exists) f.delete(); }
  await writeIndex(rows.filter(x => x.documentId !== id));
}
export function plaintextUri(id: string) { if (!plainDir.exists) plainDir.create({ idempotent: true, intermediates: true }); return new File(plainDir, `${safeId(id)}.pdf`).uri; }
export function clearPlaintextCache() { if (plainDir.exists) plainDir.delete(); }
export function removeFile(uri: string) { const f = new File(uri); if (f.exists) f.delete(); }
export async function clearOfflineCache() {
  clearPlaintextCache();
  if (dir.exists) dir.delete();
  dir.create({ idempotent: true, intermediates: true });
  await SecureStore.deleteItemAsync(KEY_ID);
  const ids = JSON.parse((await SecureStore.getItemAsync(GRANT_IDS)) ?? '[]') as string[];
  await Promise.all(ids.map(id => SecureStore.deleteItemAsync(`${GRANT_PREFIX}${id}`)));
  await SecureStore.deleteItemAsync(GRANT_IDS);
}
export async function saveOfflineGrant(licenseId: string, signedLease: string) {
  if (!signedLease || signedLease.length > 8192) throw new Error('The signed offline lease is invalid.');
  const key = `${GRANT_PREFIX}${safeId(licenseId)}`;
  await SecureStore.setItemAsync(key, JSON.stringify({ signedLease }), {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  const ids = JSON.parse((await SecureStore.getItemAsync(GRANT_IDS)) ?? '[]') as string[];
  if (!ids.includes(licenseId)) { ids.push(licenseId); await SecureStore.setItemAsync(GRANT_IDS, JSON.stringify(ids), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }); }
}
export async function getOfflineGrant(licenseId: string): Promise<OfflineGrant | null> {
  const raw = await SecureStore.getItemAsync(`${GRANT_PREFIX}${safeId(licenseId)}`);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as OfflineGrant;
    return typeof value.signedLease === 'string' ? value : null;
  } catch { return null; }
}
