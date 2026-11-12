'use client';
import { useEffect, useState } from 'react';
import { productsApi } from '@/lib/services';
import { errorMessage } from '@/lib/api';
import type { Product } from '@/lib/types';
import { StoreCard } from '@/components/StoreCard';
import { LoadError, Loading } from '@/components/StatusBadge';

const PAGE_SIZE = 12;

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce typing, and return to page 1 whenever the search text changes.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Ignore responses for out-of-date requests so fast typing or paging cannot show stale results.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    productsApi.list(params.toString())
      .then((r) => {
        if (!active) return;
        setProducts(r.items);
        setTotal(r.total);
        setTotalPages(Math.max(1, r.totalPages));
      })
      .catch((e) => active && setError(errorMessage(e, 'Products could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, query]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">STORE</p>
          <h1 className="page-title">Past questions</h1>
          <p className="mt-2 text-slate-600">Browse active materials and their catalog prices.</p>
        </div>
        <input
          className="input sm:w-80"
          type="search"
          aria-label="Search past questions"
          placeholder="Search title, subject or institution"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <LoadError message={error} />}
      {loading && products.length === 0 && <Loading rows={3} />}

      {!error && !loading && products.length === 0 && (
        <div className="empty mt-8"><h2>No products found</h2><p>Try a different search.</p></div>
      )}

      {products.length > 0 && (
        <>
          <p className="mt-6 text-sm text-slate-500" aria-live="polite">
            {total} {total === 1 ? 'result' : 'results'}{query ? ` for “${query}”` : ''}
          </p>
          <div className={`grid gap-5 pt-4 sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {products.map((p) => <StoreCard key={p.id} product={p} />)}
          </div>
          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Pagination">
              <button className="button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button className="button-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
