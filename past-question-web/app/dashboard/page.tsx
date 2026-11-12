'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accountApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { describeLicense, purchaseStatusLabel, purchaseTone } from '@/lib/student-status';
import type { License, Purchase } from '@/lib/types';
import { formatMoney } from '@/components/StoreCard';
import { useSession } from '@/components/SessionProvider';
import { LoadError, Loading, StatusBadge } from '@/components/StatusBadge';

export default function Dashboard() {
  const { user } = useSession();
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [licenses, setLicenses] = useState<License[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([accountApi.purchases(), accountApi.licenses()])
      .then(([p, l]) => {
        if (!active) return;
        setPurchases(p);
        setLicenses(l);
      })
      .catch((e) => active && setError(errorMessage(e, 'Your account details could not be loaded.')));
    return () => {
      active = false;
    };
  }, []);

  const paid = purchases?.filter((p) => p.status === 'PAID') ?? [];
  const usable = licenses?.filter((l) => describeLicense(l).usable) ?? [];

  return (
    <div>
      <p className="eyebrow">STUDENT DASHBOARD</p>
      <h1 className="page-title">Good to see you, {user?.firstName}.</h1>
      <p className="mt-2 text-slate-600">Your account, purchases and access status in one place.</p>
      {error && <LoadError message={error} />}

      {!error && (!purchases || !licenses) ? <Loading rows={2} /> : (
        <>
          <div className="stats-grid">
            <div className="stat"><span>Paid purchases</span><strong>{paid.length}</strong></div>
            <div className="stat"><span>Licences</span><strong>{licenses?.length ?? 0}</strong></div>
            <div className="stat"><span>Usable now</span><strong>{usable.length}</strong></div>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <section className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="section-title">Recent purchases</h2>
                <Link href="/dashboard/purchases" className="text-link">View all</Link>
              </div>
              {(purchases?.length ?? 0) === 0 ? (
                <p className="mt-5 text-sm text-slate-600">No purchases yet. <Link href="/store" className="text-link">Browse the store.</Link></p>
              ) : (
                <div className="mt-5 space-y-4">
                  {(purchases ?? []).slice(0, 4).map((x) => (
                    <div key={x.id} className="list-row">
                      <div>
                        <p className="font-semibold">{x.product.title}</p>
                        <p className="text-xs text-slate-500">{new Date(x.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(x.amount, x.currency)}</p>
                        <StatusBadge label={purchaseStatusLabel(x.status)} tone={purchaseTone(x.status)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card p-6">
              <h2 className="section-title">Access your materials</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Secured documents are opened in the Tpaths mobile application, not downloaded from the website.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/dashboard/library" className="button-primary">Open library</Link>
                <Link href="/dashboard/activation" className="button-secondary">Activation details</Link>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
