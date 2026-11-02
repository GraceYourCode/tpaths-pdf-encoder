# Student web architecture

- Next.js App Router + TypeScript + Tailwind CSS 4.
- `components/SessionProvider.tsx` owns browser authentication state.
- `lib/api.ts` is the single HTTP client and performs access-token injection plus one-shot refresh on 401.
- `lib/services.ts` maps UI operations to the actual backend routes.
- Dashboard routes are protected by `AuthGuard` for UX; backend authorization remains authoritative.
- Store routes are public and use active product data from the API.
- Checkout uses the provider's public browser key, then backend `payments/verify` is authoritative.
- Secured PDF artifact access is intentionally not exposed by this website because the supplied content API is device-bound and designed for the mobile client.
