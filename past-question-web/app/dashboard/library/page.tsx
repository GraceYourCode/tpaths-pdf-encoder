'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accountApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { activationLabel, describeLicense } from '@/lib/student-status';
import type { License } from '@/lib/types';
import { LoadError, Loading, StatusBadge } from '@/components/StatusBadge';

/**
 * Lists the materials this student is entitled to. Documents themselves are only
 * delivered to the mobile app, so this page never offers a download.
 */
export default function Library() {
  const [items, setItems] = useState<License[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    accountApi.licenses()
      .then((l) => active && setItems(l))
      .catch((e) => active && setError(errorMessage(e, 'Your library could not be loaded.')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <p className="eyebrow">MY LIBRARY</p>
      <h1 className="page-title">Your materials</h1>
      <p className="mt-2 text-slate-600">
        Materials you can use right now. Open them in the Tpaths mobile app, signed in with this account.
      </p>
      {error && <LoadError message={error} />}
      {!error && !items && <Loading />}
      {items && (() => {
        const usable = items.filter((x) => describeLicense(x).usable);
        if (usable.length === 0) {
          return (
            <div className="empty mt-7">
              <h2>Your library is empty.</h2>
              <p>
                Purchase a material from the <Link href="/store" className="text-link">Tpaths store</Link>, then
                activate it in the mobile app.
              </p>
            </div>
          );
        }
        return (
          <div className="grid gap-5 pt-7 md:grid-cols-2">
            {usable.map((x) => {
              const view = describeLicense(x);
              return (
                <div className="card p-6" key={x.id}>
                  <StatusBadge label={view.label} tone={view.tone} />
                  <h2 className="mt-4 text-xl font-bold">{x.product.title}</h2>
                  <p className="mt-3 text-sm text-slate-600">{activationLabel(x)}.</p>
                  {x.expiresAt && (
                    <p className="mt-1 text-sm text-slate-600">Access until {new Date(x.expiresAt).toLocaleDateString()}.</p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
