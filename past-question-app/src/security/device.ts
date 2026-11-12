import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Buffer, createECDH } from 'react-native-quick-crypto';
import { devices } from '@/api';
import { APP_VERSION } from '@/config';
import { saveDeviceKeys, setBackendDeviceId, storedDeviceKeys } from '@/storage/secure';

// DER SubjectPublicKeyInfo prefix for id-ecPublicKey / prime256v1.
const P256_SPKI_PREFIX = Buffer.from(
  '3059301306072a8648ce3d020106082a8648ce3d030107034200',
  'hex',
);

export type DeviceIdentity = {
  installationId: string;
  deviceId: string;
  privateKeyHex: string;
  publicKeyBase64: string;
  platform: string;
};

/** Create and persist a P-256 ECDH identity using the native OpenSSL-backed crypto module. */
export async function identity(): Promise<Omit<DeviceIdentity, 'deviceId'> & { deviceId: string | null }> {
  const stored = await storedDeviceKeys();
  if (stored) {
    return {
      installationId: stored.installationId,
      deviceId: stored.backendDeviceId,
      privateKeyHex: stored.privateKeyHex,
      publicKeyBase64: stored.publicKeyBase64,
      platform: Device.osName ?? 'mobile',
    };
  }

  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const privateKeyHex = ecdh.getPrivateKey('hex');
  const publicPoint = ecdh.getPublicKey(undefined, 'uncompressed');
  if (publicPoint.length !== 65 || publicPoint[0] !== 4) {
    throw new Error('Unable to create a valid P-256 device key.');
  }
  const publicKeyBase64 = Buffer.concat([P256_SPKI_PREFIX, publicPoint]).toString('base64');
  const installationId = Crypto.randomUUID();
  await saveDeviceKeys(installationId, privateKeyHex, publicKeyBase64);
  return {
    installationId,
    deviceId: null,
    privateKeyHex,
    publicKeyBase64,
    platform: Device.osName ?? 'mobile',
  };
}

/** Register the installation key and retain the backend-issued Device.id. */
export async function ensureDeviceRegistered(): Promise<DeviceIdentity> {
  const d = await identity();
  if (d.deviceId) return { ...d, deviceId: d.deviceId };
  const registered = await devices.register({
    deviceId: d.installationId,
    platform: d.platform,
    appVersion: APP_VERSION,
    publicKey: d.publicKeyBase64,
  });
  if (!registered.id || registered.publicKeyRegistered !== true) {
    throw new Error('The server did not confirm registration of this device encryption key.');
  }
  await setBackendDeviceId(registered.id);
  return { ...d, deviceId: registered.id };
}
