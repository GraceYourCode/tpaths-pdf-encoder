'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { productsApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import { formatMoney } from '@/components/StoreCard';
import type { Product } from '@/lib/types';

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void params.then(({ id }) =>
      productsApi.get(id)
        .then((p) => active && setProduct(p))
        .catch((e) => active && setError(errorMessage(e, 'This product is not available.'))),
    );
    return () => {
      active = false;
    };
  }, [params]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="page-title">Product unavailable</h1>
        <p className="mt-3 text-slate-600">{error}</p>
        <Link href="/store" className="button-primary mt-6 inline-flex">Back to store</Link>
      </main>
    );
  }
  if (!product) return <div className="page-center"><div className="spinner" /></div>;

  const details: [string, string | null][] = [
    ['Level', product.level],
    ['Course', product.course],
    ['Institution', product.institution],
    ['Exam', product.examType],
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/store" className="back-link">← Store</Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[1.1fr_.9fr]">
        <div className="product-hero">
          <p className="eyebrow">{product.subject ?? product.category ?? 'PAST QUESTION'}</p>
          <h1 className="text-4xl font-black tracking-tight text-white">{product.title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">{product.description ?? 'Secure digital academic material.'}</p>
        </div>
        <div className="card h-fit p-6">
          <p className="text-sm text-slate-500">Price</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{formatMoney(product.price, product.currency)}</p>
          <dl className="mt-6 space-y-2 text-sm text-slate-600">
            {details.map(([k, v]) => v ? (
              <div key={k}><dt className="inline font-semibold text-slate-900">{k}: </dt><dd className="inline">{v}</dd></div>
            ) : null)}
          </dl>
          <Link href={`/checkout/${product.id}`} className="button-primary mt-7 w-full">Continue to checkout</Link>
        </div>
      </div>
      <section className="mt-8 card p-6">
        <h2 className="section-title">What happens after purchase?</h2>
        <p className="mt-2 text-slate-600">
          Once the backend confirms your payment, your purchase appears in your account and your licence is created.
          If an activation token is issued, it is shown on the confirmation page. Enter it in the Tpaths mobile application.
        </p>
      </section>
    </main>
  );
}
