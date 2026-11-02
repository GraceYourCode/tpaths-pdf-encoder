import Link from 'next/link';
import type { Product } from '@/lib/types';
export function formatMoney(amount: number, currency: string) { return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100); }
export function StoreCard({ product }: { product: Product }) {
  return <article className="card overflow-hidden">
    <div className="flex h-36 items-end bg-slate-900 p-5"><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{product.subject ?? product.category ?? 'Past Question'}</span></div>
    <div className="p-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{product.level ?? product.institution ?? 'Academic material'}</p><h3 className="text-lg font-bold text-slate-950">{product.title}</h3><p className="mt-2 line-clamp-2 text-sm text-slate-600">{product.description ?? 'Secure digital past-question material for focused study.'}</p><div className="mt-5 flex items-center justify-between gap-3"><strong className="text-slate-950">{formatMoney(product.price, product.currency)}</strong><Link href={`/store/${product.id}`} className="button-primary">View</Link></div></div>
  </article>;
}
