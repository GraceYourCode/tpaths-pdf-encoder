'use client';

import { useEffect, useState } from 'react';
import { accountApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { paymentStatusLabel } from '@/lib/student-status';
import type { Purchase } from '@/lib/types';
import { formatMoney } from '@/components/StoreCard';
import { LoadError, Loading, StatusBadge } from '@/components/StatusBadge';

export default function Transactions() {
  const [items, setItems] = useState<Purchase[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    accountApi.purchases()
      .then((p) => active && setItems(p))
      .catch((e) => active && setError(errorMessage(e, 'Transactions could not be loaded.')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <p className="eyebrow">PAYMENTS</p>
      <h1 className="page-title">Transactions</h1>
      <p className="mt-2 text-slate-600">Payment records as the backend holds them.</p>
      {error && <LoadError message={error} />}
      {!error && !items && <Loading />}
      {items && (
        <div className="card mt-7 overflow-hidden">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Reference</th><th>Payment</th><th>Product</th><th>Amount</th><th>Date</th></tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id}>
                    <td className="mono">{x.payment?.reference ?? x.reference}</td>
                    <td>{x.payment ? <StatusBadge label={paymentStatusLabel(x.payment.status)} tone={x.payment.status === 'SUCCESS' ? 'success' : x.payment.status === 'FAILED' ? 'danger' : 'neutral'} /> : '—'}</td>
                    <td>{x.product.title}</td>
                    <td>{formatMoney(x.payment?.amount ?? x.amount, x.payment?.currency ?? x.currency)}</td>
                    <td>{new Date(x.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length === 0 && <div className="empty">No transactions found.</div>}
        </div>
      )}
    </div>
  );
}
