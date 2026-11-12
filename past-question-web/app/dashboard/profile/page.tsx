'use client';

import { FormEvent, useEffect, useState } from 'react';
import { accountApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/components/SessionProvider';

export default function Profile() {
  const { user, refreshUser } = useSession();
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Keep the form in step with the account when it loads or refreshes.
  useEffect(() => {
    setFirst(user?.firstName ?? '');
    setLast(user?.lastName ?? '');
  }, [user]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first || !last) {
      setMessage({ kind: 'error', text: 'First name and last name are required.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await accountApi.update({ firstName: first, lastName: last });
      await refreshUser();
      setMessage({ kind: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err, 'Unable to update profile.') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="eyebrow">ACCOUNT</p>
      <h1 className="page-title">Profile</h1>
      <form onSubmit={submit} className="card mt-7 max-w-2xl space-y-5 p-7">
        <label className="label">
          Email
          <input className="input bg-slate-100" value={user?.email ?? ''} readOnly />
          <span className="hint">Email cannot be changed here.</span>
        </label>
        {user?.whatsapp && (
          <label className="label">
            WhatsApp number
            <input className="input bg-slate-100" value={user.whatsapp} readOnly />
          </label>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">
            First name
            <input className="input" required maxLength={100} value={firstName} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label className="label">
            Last name
            <input className="input" required maxLength={100} value={lastName} onChange={(e) => setLast(e.target.value)} />
          </label>
        </div>
        {message && (
          <div role="status" className={message.kind === 'ok' ? 'alert' : 'alert-error'}>{message.text}</div>
        )}
        <button disabled={saving} className="button-primary">{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
