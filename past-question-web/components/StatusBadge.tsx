import type { Tone } from '@/lib/student-status';

const toneClasses: Record<Tone, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  neutral: 'bg-slate-200 text-slate-700',
};

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return <span className={`badge ${toneClasses[tone]}`}>{label}</span>;
}

/** Shared loading and error block for account pages. */
export function LoadError({ message }: { message: string }) {
  return <div role="alert" className="alert-error mt-5">{message}</div>;
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-7 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}
