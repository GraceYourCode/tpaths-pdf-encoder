import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { PaymentsService } from './payments.service.js';

/** In-memory stand-in for the Prisma calls PaymentsService makes. */
function fakeDb() {
  const db: any = {
    users: [{ id: 'u1', email: 'a@b.co', status: 'ACTIVE' }, { id: 'u2', email: 'c@d.co', status: 'ACTIVE' }],
    products: [{ id: 'p1', price: 500000, currency: 'NGN', status: 'ACTIVE' }],
    payments: [] as any[],
    purchases: [] as any[],
    licenses: [] as any[],
    tokens: [] as any[],
    audits: [] as any[],
  };
  let seq = 0;
  const id = () => `id${++seq}`;
  const rel = (p: any) => (p ? { ...p, product: db.products.find((x: any) => x.id === p.productId), license: db.licenses.find((x: any) => x.purchaseId === p.id) ?? null } : null);
  db.user = { findUnique: async ({ where }: any) => db.users.find((u: any) => u.id === where.id) ?? null };
  db.product = { findUnique: async ({ where }: any) => db.products.find((p: any) => p.id === where.id) ?? null };
  db.license = {
    findFirst: async ({ where }: any) => db.licenses.find((l: any) => l.userId === where.userId && l.productId === where.productId && l.status === where.status) ?? null,
    create: async ({ data }: any) => {
      if (db.licenses.some((l: any) => l.purchaseId === data.purchaseId)) throw Object.assign(new Error('dup'), { code: 'P2002' });
      const l = { id: id(), ...data }; db.licenses.push(l); return l;
    },
  };
  db.payment = {
    create: async ({ data }: any) => { const p = { id: id(), ...data }; db.payments.push(p); return p; },
    update: async ({ where, data }: any) => Object.assign(db.payments.find((p: any) => p.id === where.id), data),
    findUnique: async ({ where }: any) => db.payments.find((p: any) => p.eventId === where.eventId) ?? null,
  };
  db.purchase = {
    create: async ({ data }: any) => { const p = { id: id(), ...data }; db.purchases.push(p); return p; },
    findUnique: async ({ where, include }: any) => {
      const p = db.purchases.find((x: any) => x.id === where.id || x.reference === where.reference);
      if (!p) return null;
      const out = rel(p);
      return include?.product ? out : { ...p, license: out.license };
    },
    update: async ({ where, data }: any) => Object.assign(db.purchases.find((p: any) => p.id === where.id), data),
    updateMany: async ({ where, data }: any) => {
      const hits = db.purchases.filter((p: any) => p.id === where.id && where.status.in.includes(p.status));
      hits.forEach((p: any) => Object.assign(p, data));
      return { count: hits.length };
    },
  };
  db.activationToken = {
    create: async ({ data }: any) => { const t = { id: id(), ...data, expiresAt: null }; db.tokens.push(t); return t; },
  };
  db.$transaction = async (fn: any) => fn(db);
  return db;
}

describe('PaymentsService', () => {
  let db: any;
  let svc: PaymentsService;
  let paystack: { verifyStatus: string; amount: number; currency: string; reference?: string };

  beforeEach(() => {
    db = fakeDb();
    paystack = { verifyStatus: 'success', amount: 500000, currency: 'NGN' };
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      if (String(url).includes('/transaction/initialize')) {
        const body = JSON.parse(init.body);
        return new Response(JSON.stringify({ status: true, data: { authorization_url: 'https://checkout.example/x', access_code: 'ac', reference: body.reference } }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: true, data: { status: paystack.verifyStatus, amount: paystack.amount, currency: paystack.currency, customer: { email: 'a@b.co' } } }), { status: 200 });
    }));
    const config: any = { get: (k: string) => (k === 'payment.provider' ? 'paystack' : undefined), getOrThrow: () => 'sk_test_fixture' };
    const licenses: any = {
      generateToken: async (productId: string, _e: any, purchaseId: string, tx: any) => {
        const t = { id: `t${tx.tokens.length + 1}`, productId, purchaseId };
        tx.tokens.push(t);
        return { id: t.id, token: 'PQ-TEST', expiresAt: null };
      },
    };
    svc = new PaymentsService(db, config, licenses, { log: async () => undefined } as any);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('initialize creates a PENDING purchase with a server-generated reference', async () => {
    const r = await svc.initialize('u1', 'p1');
    expect(r.reference).toMatch(/^PQ-/);
    expect(r.authorizationUrl).toBe('https://checkout.example/x');
    expect(db.purchases[0].status).toBe('PENDING');
    expect(db.purchases[0].amount).toBe(500000);
  });

  it('initialize refuses a product the user already owns', async () => {
    db.licenses.push({ id: 'l0', userId: 'u1', productId: 'p1', status: 'ACTIVE' });
    await expect(svc.initialize('u1', 'p1')).rejects.toThrow(/already purchased/);
  });

  it('verify completes the purchase exactly once, with license and token', async () => {
    const { reference } = await svc.initialize('u1', 'p1');
    const first = await svc.verify('u1', { reference, productId: 'p1' });
    expect(first.status).toBe('PAID');
    expect(first.activationToken).toBe('PQ-TEST');
    const second = await svc.verify('u1', { reference, productId: 'p1' });
    expect(second.alreadyProcessed).toBe(true);
    expect(db.licenses).toHaveLength(1);
    expect(db.tokens).toHaveLength(1);
  });

  it('a different user cannot confirm someone else\'s payment reference', async () => {
    const { reference } = await svc.initialize('u1', 'p1');
    await expect(svc.verify('u2', { reference, productId: 'p1' })).rejects.toThrow(/does not belong/);
    expect(db.licenses).toHaveLength(0);
  });

  it('rejects a Paystack amount that differs from the product price', async () => {
    const { reference } = await svc.initialize('u1', 'p1');
    paystack.amount = 100;
    await expect(svc.verify('u1', { reference, productId: 'p1' })).rejects.toThrow();
    expect(db.purchases[0].status).toBe('PENDING');
    expect(db.licenses).toHaveLength(0);
  });

  it('does not complete when Paystack reports a non-success status', async () => {
    const { reference } = await svc.initialize('u1', 'p1');
    paystack.verifyStatus = 'abandoned';
    await expect(svc.verify('u1', { reference, productId: 'p1' })).rejects.toThrow(/could not be verified/);
    expect(db.purchases[0].status).toBe('PENDING');
  });

  it('webhook ignores unknown references and duplicate events', async () => {
    const { reference } = await svc.initialize('u1', 'p1');
    const evt = { event: 'charge.success', data: { id: 9001, reference } };
    expect(await svc.webhook(evt)).toEqual({ processed: true });
    expect(await svc.webhook(evt)).toEqual({ processed: true, duplicate: true });
    expect(db.licenses).toHaveLength(1);
    const unknown = { event: 'charge.success', data: { id: 9002, reference: 'PQ-NOPE' } };
    expect(await svc.webhook(unknown)).toEqual({ processed: true, ignored: true });
    expect(db.purchases.filter((p: any) => p.reference === 'PQ-NOPE')).toHaveLength(0);
  });

  it('rejects webhook signatures that do not match the raw body', () => {
    const raw = JSON.stringify({ event: 'charge.success' });
    const good = createHmac('sha512', 'sk_test_fixture').update(raw).digest('hex');
    expect(() => svc.verifyWebhook(raw, good)).not.toThrow();
    expect(() => svc.verifyWebhook(raw, '00'.repeat(64))).toThrow();
    expect(() => svc.verifyWebhook(raw, '')).toThrow();
  });
});
