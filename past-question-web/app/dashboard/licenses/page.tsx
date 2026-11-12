'use client';

import { useEffect, useState } from 'react';
import { accountApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { activationLabel, describeLicense } from '@/lib/student-status';
import type { License } from '@/lib/types';
import { LoadError, Loading, StatusBadge } from '@/components/StatusBadge';

export default function Licenses() {
  const [items, setItems] = useState<License[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    accountApi.licenses()
      .then((l) => active && setItems(l))
      .catch((e) => active && setError(errorMessage(e, 'Licences could not be loaded.')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <p className="eyebrow">ENTITLEMENTS</p>
      <h1 className="page-title">Licences</h1>
      <p className="mt-2 text-slate-600">Status, activation and expiry as the backend records them.</p>
      {error && <LoadError message={error} />}
      {!error && !items && <Loading />}
      {items && (
        <div className="mt-7 space-y-4">
          {items.map((x) => {
            const view = describeLicense(x);
            return (
              <div className="card p-6" key={x.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row">
                  <div>
                    <StatusBadge label={view.label} tone={view.tone} />
                    <h2 className="mt-3 text-lg font-bold">{x.product.title}</h2>
                    {x.purchase?.reference && <p className="mono mt-1 text-xs text-slate-500">Purchase {x.purchase.reference}</p>}
                  </div>
                  <dl className="grid gap-1 text-sm text-slate-600 sm:text-right">
                    <div><dt className="inline font-medium text-slate-900">Device: </dt><dd className="inline">{activationLabel(x)}</dd></div>
                    <div>
                      <dt className="inline font-medium text-slate-900">Expires: </dt>
                      <dd className="inline">{x.expiresAt ? new Date(x.expiresAt).toLocaleDateString() : 'No expiry date'}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div className="empty">No licences found.</div>}
        </div>
      )}
    </div>
  );
}
