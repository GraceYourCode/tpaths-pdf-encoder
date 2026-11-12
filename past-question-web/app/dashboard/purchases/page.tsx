'use client';

import { useEffect, useState } from 'react';
import { accountApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { purchaseStatusLabel, purchaseTone } from '@/lib/student-status';
import type { Purchase } from '@/lib/types';
import { formatMoney } from '@/components/StoreCard';
import { LoadError, Loading, StatusBadge } from '@/components/StatusBadge';

export default function Purchases() {
  const [items, setItems] = useState<Purchase[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    accountApi.purchases()
      .then((p) => active && setItems(p))
      .catch((e) => active && setError(errorMessage(e, 'Purchases could not be loaded.')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <p className="eyebrow">ACCOUNT</p>
      <h1 className="page-title">Purchases</h1>
      <p className="mt-2 text-slate-600">Status comes from the backend. A purchase is only paid once the backend has confirmed it.</p>
      {error && <LoadError message={error} />}
      {!error && !items && <Loading />}
      {items && (
        <div className="card mt-7 overflow-hidden">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Product</th><th>Status</th><th>Amount</th><th>Date</th><th>Reference</th></tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id}>
                    <td className="font-semibold">{x.product.title}</td>
                    <td><StatusBadge label={purchaseStatusLabel(x.status)} tone={purchaseTone(x.status)} /></td>
                    <td>{formatMoney(x.amount, x.currency)}</td>
                    <td>{new Date(x.createdAt).toLocaleDateString()}</td>
                    <td className="mono">{x.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <div className="empty">No purchases yet.</div>}
        </div>
      )}
    </div>
  );
}
