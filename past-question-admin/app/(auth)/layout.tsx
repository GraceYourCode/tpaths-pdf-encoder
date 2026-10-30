import type { ReactNode } from "react";

/** Centered, chrome-free layout for unauthenticated pages (login). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      {children}
    </div>
  );
}
