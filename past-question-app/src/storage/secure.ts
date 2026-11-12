import * as SecureStore from 'expo-secure-store';

const K = {
  a: 'tpaths.access',
  r: 'tpaths.refresh',
  installation: 'tpaths.installationId',
  backendDevice: 'tpaths.backendDeviceId',
  privateKey: 'tpaths.p256.privateKey',
  publicKey: 'tpaths.p256.publicKey',
  cachedUser: 'tpaths.cachedUser',
};
const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export async function session() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(K.a),
    SecureStore.getItemAsync(K.r),
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}
export async function saveSession(a: string, r: string) {
  await Promise.all([
    SecureStore.setItemAsync(K.a, a, opts),
    SecureStore.setItemAsync(K.r, r, opts),
  ]);
}
export async function clearSession() {
  await Promise.all([SecureStore.deleteItemAsync(K.a), SecureStore.deleteItemAsync(K.r)]);
}
export async function access() { return SecureStore.getItemAsync(K.a); }

export type StoredDeviceKeys = {
  installationId: string;
  backendDeviceId: string | null;
  privateKeyHex: string;
  publicKeyBase64: string;
};
export async function saveDeviceKeys(
  installationId: string,
  privateKeyHex: string,
  publicKeyBase64: string,
) {
  await Promise.all([
    SecureStore.setItemAsync(K.installation, installationId, opts),
    SecureStore.setItemAsync(K.privateKey, privateKeyHex, opts),
    SecureStore.setItemAsync(K.publicKey, publicKeyBase64, opts),
  ]);
}
export async function setBackendDeviceId(id: string) {
  await SecureStore.setItemAsync(K.backendDevice, id, opts);
}
export async function storedDeviceKeys(): Promise<StoredDeviceKeys | null> {
  const [installationId, backendDeviceId, privateKeyHex, publicKeyBase64] = await Promise.all([
    SecureStore.getItemAsync(K.installation),
    SecureStore.getItemAsync(K.backendDevice),
    SecureStore.getItemAsync(K.privateKey),
    SecureStore.getItemAsync(K.publicKey),
  ]);
  return installationId && privateKeyHex && publicKeyBase64
    ? { installationId, backendDeviceId, privateKeyHex, publicKeyBase64 }
    : null;
}

export async function saveCachedUser(user: unknown) {
  await SecureStore.setItemAsync(K.cachedUser, JSON.stringify(user), opts);
}
export async function cachedUser<T>() {
  const raw = await SecureStore.getItemAsync(K.cachedUser);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
export async function clearCachedUser() { await SecureStore.deleteItemAsync(K.cachedUser); }
