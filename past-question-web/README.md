# Tpaths Student Web

Student/customer-facing web client for the Tpaths secure past-question platform.

## Requirements

- Node.js compatible with the supplied Next.js project
- Backend reachable from the browser
- A Paystack public key for checkout, because the supplied backend exposes payment verification but not payment initialization

## Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxx
```

`NEXT_PUBLIC_*` values are browser-visible. Never place backend secrets, database credentials, payment secret keys, storage credentials or encryption keys here.

## Run

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

The supplied backend currently has integration gaps documented in `docs/backend-integration-gaps.md`.
