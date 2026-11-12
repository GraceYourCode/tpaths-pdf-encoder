import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { nav } from '@/navigation';
import * as ScreenCapture from 'expo-screen-capture';
import { content, licenses, users } from '@/api';
import { ApiError } from '@/api/client';
import { ensureDeviceRegistered, identity } from '@/security/device';
import { decryptArtifact } from '@/security/document';
import {
  clearPlaintextCache, getOffline, getOfflineGrant, plaintextUri, readOffline,
  removeFile, saveOffline,
} from '@/storage/documents';
import { File } from 'expo-file-system';
import { offlineLeasePublicKeys } from '@/config';
import { verifyOfflineLease } from '@/security/offlineLease';
import { useAuth } from '@/auth/AuthProvider';
import { Brand } from '@/components/Brand';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/themed-text';
import type { License } from '@/types';

type PdfProps = { source: { uri: string }; style: object; trustAllCerts?: boolean };
let Pdf: ComponentType<PdfProps> | null = null;
try {
  // Native-only optional module: Expo Go/web must remain loadable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Pdf = require('react-native-pdf-jsi').default as ComponentType<PdfProps>;
} catch { Pdf = null; }

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/i.test(value);

export default function Reader() {
  const { documentId, title } = useLocalSearchParams<{ documentId: string; title?: string }>();
  const id = String(documentId ?? '');
  const { user } = useAuth();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [watermarkTime, setWatermarkTime] = useState(new Date().toISOString());
  const uriRef = useRef<string | null>(null);
  const mounted = useRef(true);
  const foreground = useRef(AppState.currentState === 'active');

  useEffect(() => {
    mounted.current = true;
    foreground.current = AppState.currentState === 'active';
    clearPlaintextCache();
    ScreenCapture.preventScreenCaptureAsync('tpaths-reader').catch(() => undefined);
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        foreground.current = false;
        const current = uriRef.current;
        if (current) removeFile(current);
        clearPlaintextCache();
        uriRef.current = null;
        if (mounted.current) setUri(null);
      } else if (mounted.current) {
        foreground.current = true;
        setReload(value => value + 1);
      }
    });
    const watermarkTimer = setInterval(() => setWatermarkTime(new Date().toISOString()), 30_000);
    return () => {
      mounted.current = false;
      subscription.remove();
      clearInterval(watermarkTimer);
      ScreenCapture.allowScreenCaptureAsync('tpaths-reader').catch(() => undefined);
      const current = uriRef.current;
      if (current) removeFile(current);
      clearPlaintextCache();
      uriRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let plaintextPath: string | null = null;
    const run = async () => {
      setLoading(true);
      setError('');
      setUri(null);
      try {
        if (!id || !user?.id) throw new Error('Your account or document could not be identified.');
        const cached = await getOffline(id);
        let device;
        try {
          device = await ensureDeviceRegistered();
        } catch (registrationError) {
          // A previously registered device identity may still be used for a
          // bounded offline read; a new device can never self-activate offline.
          const existing = await identity();
          if (!existing.deviceId) throw registrationError;
          device = { ...existing, deviceId: existing.deviceId };
        }

        let artifact: Uint8Array;
        let checksum: string | null | undefined;
        let licenseId: string;
        let licenseExpiry: string | null = null;
        let documentTitle = String(title ?? cached?.title ?? 'Protected document');
        let documentVersion = cached?.version ?? 0;

        try {
          // A cached PQE file is not itself an entitlement. Revalidate the
          // license and device with the server before using any cached copy.
          const owned = await users.licenses();
          const candidates = owned.filter(item => item.status === 'ACTIVE' && item.deviceId === device.deviceId);
          let license: License | null = null;
          for (const item of candidates) {
            const detail = await licenses.get(item.id) as License;
            if ((detail.product?.documents ?? []).some(doc => doc.id === id)) {
              license = detail;
              break;
            }
          }
          if (!license) throw new Error('No active license grants access to this document on this device.');
          const validation = await licenses.validate(license.id, device.deviceId);
          if (!validation.valid) throw new Error('Your license is no longer valid.');
          // Re-read after validation so the expiry and product/document state
          // are checked against the latest server response.
          license = await licenses.get(license.id) as License;
          if (license.status !== 'ACTIVE' || license.deviceId !== device.deviceId ||
              license.product?.status !== 'ACTIVE') {
            throw new Error('Your license is inactive or no longer grants access.');
          }
          const document = license.product?.documents?.find(doc => doc.id === id);
          if (!document) throw new Error('This document is not included in your active license.');
          licenseId = license.id;
          licenseExpiry = license.expiresAt ?? null;
          documentTitle = document.title;
          documentVersion = document.version;
          const authorization = await content.authorize(id, device.deviceId);
          const authorizationExpiry = Date.parse(authorization.expiresAt);
          if (!Number.isFinite(authorizationExpiry) || authorizationExpiry <= Date.now()) {
            throw new Error('Document authorization expired before download. Please try again.');
          }
          checksum = authorization.document.checksumSha256;
          if (!isSha256(checksum)) throw new Error('The server did not provide a valid document checksum.');
          documentTitle = authorization.document.title;
          documentVersion = authorization.document.version;
          // Download every online open: the backend artifact endpoint performs
          // the final paid-purchase/session/device checks before releasing bytes.
          const downloaded = await content.artifactAt(authorization.artifactEndpoint, authorization.authorizationToken);
          if (downloaded.bytes.length === 0) throw new Error('The protected document download was empty.');
          artifact = downloaded.bytes;
          await saveOffline(id, artifact, {
            productId: license.productId,
            licenseId,
            title: documentTitle,
            version: documentVersion,
            checksumSha256: checksum,
            licenseExpiresAt: licenseExpiry,
          });
          // This backend snapshot does not expose an offline-lease endpoint.
          // Cache the encrypted artifact for a future signed-lease implementation,
          // but do not mint or persist a local offline entitlement.
        } catch (networkError) {
          if (!(networkError instanceof ApiError) || networkError.status !== 0 || !cached) throw networkError;
          if (cached.licenseId.length === 0) throw new Error('Offline access is unavailable for this cached document.');
          const grant = await getOfflineGrant(cached.licenseId);
          if (!grant || !isSha256(cached.checksumSha256)) {
            throw new Error('A valid signed offline lease is unavailable. Connect to the internet to revalidate your license.');
          }
          if (cached.licenseExpiresAt && Date.parse(cached.licenseExpiresAt) <= Date.now()) {
            throw new Error('Your license has expired.');
          }
          licenseId = cached.licenseId;
          checksum = cached.checksumSha256;
          documentTitle = cached.title;
          documentVersion = cached.version;
          artifact = await readOffline(cached.encryptedPath);
          verifyOfflineLease(grant.signedLease, offlineLeasePublicKeys(), {
            userId: user.id, licenseId: cached.licenseId, deviceId: device.deviceId,
            documentId: id,
            documentChecksumSha256: cached.checksumSha256.replace(/^sha256:/i, '').toLowerCase(),
            documentVersion: cached.version,
          });
        }

        let plain: Uint8Array;
        try {
          plain = await decryptArtifact(
            artifact, device.privateKeyHex, device.publicKeyBase64,
            device.deviceId, checksum, id,
          );
        } finally {
          artifact.fill(0);
        }
        if (cancelled || !mounted.current || !foreground.current) {
          plain.fill(0);
          return;
        }
        const file = new File(plaintextUri(id));
        try {
          file.create({ overwrite: true });
          file.write(plain);
        } finally {
          plain.fill(0);
        }
        plaintextPath = file.uri;
        if (cancelled || !mounted.current) {
          removeFile(file.uri);
          return;
        }
        uriRef.current = file.uri;
        setUri(file.uri);
        setWatermarkTime(new Date().toISOString());
        void licenseId;
        void documentVersion;
      } catch (caught) {
        if (!cancelled && mounted.current) {
          setError(caught instanceof Error ? caught.message : 'Unable to open this protected document.');
        }
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (plaintextPath) removeFile(plaintextPath);
    };
  }, [id, reload, user?.id, title]);

  if (loading && !uri) return <View style={styles.center}><ActivityIndicator /><ThemedText>Checking license and preparing secure document…</ThemedText></View>;
  if (error) return <View style={styles.center}><Brand /><ThemedText type="subtitle">Document unavailable</ThemedText><ThemedText themeColor="textSecondary">{error}</ThemedText><Button title="Go back" onPress={() => nav.back()} /></View>;
  if (!Pdf) return <View style={styles.center}><ThemedText type="subtitle">Secure reader requires a custom development client.</ThemedText><ThemedText themeColor="textSecondary">The protected file remains encrypted at rest. Expo Go does not include the native PDF renderer.</ThemedText><Button title="Go back" onPress={() => nav.back()} /></View>;
  if (!uri) return null;

  const watermark = `${user?.firstName ?? ''} ${user?.lastName ?? ''}  •  ${user?.email ?? ''}${user?.whatsapp ? `  •  ${user.whatsapp}` : ''}  •  ${watermarkTime}  •  TPATHS`;
  return (
    <View style={styles.container}>
      <Pdf source={{ uri }} style={styles.pdf} trustAllCerts={false} />
      <View pointerEvents="none" style={styles.watermarkGrid}>
        {Array.from({ length: 18 }, (_, index) => (
          <ThemedText key={index} style={styles.stamp}>{watermark}</ThemedText>
        ))}
      </View>
      <View pointerEvents="none" style={styles.bar}>
        <ThemedText style={styles.barText}>{String(title ?? 'Protected document')}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eee' },
  pdf: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  watermarkGrid: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-evenly', alignItems: 'center', overflow: 'hidden' },
  stamp: { color: '#b4232f', fontWeight: '800', fontSize: 11, textAlign: 'center', marginVertical: 9, opacity: 0.28, transform: [{ rotate: '-24deg' }] },
  bar: { position: 'absolute', top: 50, left: 16, right: 16, padding: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,.68)' },
  barText: { color: '#fff', textAlign: 'center', fontSize: 13, fontWeight: '700' },
});
