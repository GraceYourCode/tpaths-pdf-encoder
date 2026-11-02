'use client';
import { SessionProvider } from '@/components/SessionProvider';
export default function Providers({ children }: { children: React.ReactNode }) { return <SessionProvider>{children}</SessionProvider>; }
