'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { accountApi, authApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { passwordProblem } from '@/lib/password';
import { useSession } from '@/components/SessionProvider';
import { LoadError, Loading, StatusBadge } from '@/components/StatusBadge';
import type { Device } from '@/lib/types';

export default function Security() {
  const { logout } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [devicesError, setDevicesError] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [deviceMessage, setDeviceMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const loadDevices = () => {
    setDevicesError('');
    return accountApi.devices()
      .then((d) => setDevices(d))
      .catch((e) => setDevicesError(errorMessage(e, 'Devices could not be loaded.')));
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  async function revokeDevice(id: string) {
    if (!window.confirm('Revoke this device? It will lose access to your materials and cannot be registered again.')) return;
    setRevokingId(id);
    setDeviceMessage(null);
    try {
      await accountApi.revokeDevice(id);
      setDeviceMessage({ kind: 'ok', text: 'Device revoked.' });
      await loadDevices();
    } catch (err) {
      setDeviceMessage({ kind: 'error', text: errorMessage(err, 'Unable to revoke this device.') });
    } finally {
      setRevokingId(null);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) return setMessage({ kind: 'error', text: problem });
    if (password !== confirm) return setMessage({ kind: 'error', text: 'Passwords do not match.' });

    setSaving(true);
    setMessage(null);
    try {
      await accountApi.update({ password });
    } catch (err) {
      setSaving(false);
      return setMessage({ kind: 'error', text: errorMessage(err, 'Unable to change password.') });
    }
    // The backend revokes every session when the password changes, so this
    // browser must sign out too rather than continue with a stale session.
    await logout();
    router.replace('/auth/login');
  }

  async function logoutEverywhere() {
    setMessage(null);
    try {
      await authApi.logoutAll();
    } catch (err) {
      return setMessage({ kind: 'error', text: errorMessage(err, 'Unable to sign out other sessions. Try again.') });
    }
    await logout();
    router.replace('/auth/login');
  }

  return (
    <div>
      <p className="eyebrow">SECURITY</p>
      <h1 className="page-title">Security</h1>
      <div className="grid gap-6 pt-7 md:grid-cols-2">
        <form onSubmit={changePassword} className="card space-y-5 p-7">
          <h2 className="section-title">Change password</h2>
          <label className="label">
            New password
            <input className="input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="hint">At least 12 characters with uppercase, lowercase and a number.</span>
          </label>
          <label className="label">
            Confirm password
            <input className="input" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {message && <div role="alert" className={message.kind === 'ok' ? 'alert' : 'alert-error'}>{message.text}</div>}
          <button disabled={saving} className="button-primary">{saving ? 'Changing…' : 'Change password'}</button>
          <p className="text-xs text-slate-500">Changing your password signs you out on every device.</p>
        </form>

        <div className="space-y-6">
          <div className="card p-7">
            <h2 className="section-title">Sign out everywhere</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Ends every active session for this account, including this one.</p>
            <button className="button-danger mt-5" onClick={() => void logoutEverywhere()}>Log out all sessions</button>
          </div>
          <div className="card p-7">
            <h2 className="section-title">Devices</h2>
            {devicesError && <LoadError message={devicesError} />}
            {!devicesError && !devices && <Loading rows={1} />}
            {devices && devices.length === 0 && <p className="mt-3 text-sm text-slate-600">No devices registered yet.</p>}
            {devices && devices.length > 0 && (
              <ul className="mt-4 space-y-3">
                {devices.map((d) => (
                  <li key={d.id} className="list-row">
                    <div>
                      <p className="font-semibold capitalize">{d.platform.toLowerCase()}{d.appVersion ? ` · ${d.appVersion}` : ''}</p>
                      <p className="text-xs text-slate-500">Last seen {new Date(d.lastSeenAt).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge label={d.status === 'ACTIVE' ? 'Active' : 'Revoked'} tone={d.status === 'ACTIVE' ? 'success' : 'danger'} />
                      {d.status === 'ACTIVE' && (
                        <button className="text-link text-xs" disabled={revokingId !== null} onClick={() => void revokeDevice(d.id)}>
                          {revokingId === d.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {deviceMessage && <div role="status" className={deviceMessage.kind === 'ok' ? 'alert mt-4' : 'alert-error mt-4'}>{deviceMessage.text}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
