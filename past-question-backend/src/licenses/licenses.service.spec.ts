import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LicensesService, parseDateRange, parsePaging } from './licenses.service.js';

/** Minimal in-memory license store for the methods under test. */
function fakeLicenses(initial: any[]) {
  const rows = initial.map((r) => ({ ...r }));
  const db: any = {
    rows,
    license: {
      findUnique: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
      update: async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id), data),
      count: async () => rows.length,
      findMany: async () => rows,
    },
    user: { findUnique: async () => ({ status: 'ACTIVE' }) },
    device: { findUnique: async () => ({ status: 'ACTIVE' }) },
  };
  return db;
}
const audit = { log: async () => undefined } as any;

describe('license status transitions', () => {
  it('reinstates a suspended license but never a revoked one', async () => {
    const db = fakeLicenses([
      { id: 'a', status: 'SUSPENDED', userId: 'u', productId: 'p' },
      { id: 'b', status: 'REVOKED', userId: 'u', productId: 'p' },
    ]);
    const svc = new LicensesService(db, audit);
    await expect(svc.setStatus('a', 'ACTIVE', 'admin')).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(svc.setStatus('b', 'ACTIVE', 'admin')).rejects.toBeInstanceOf(ConflictException);
    await expect(svc.setStatus('b', 'SUSPENDED', 'admin')).rejects.toBeInstanceOf(ConflictException);
  });

  it('expired-status licenses cannot be revived by a status change', async () => {
    const db = fakeLicenses([{ id: 'x', status: 'EXPIRED', userId: 'u', productId: 'p' }]);
    const svc = new LicensesService(db, audit);
    await expect(svc.setStatus('x', 'ACTIVE', 'admin')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('admin query helpers', () => {
  it('clamps paging to safe bounds', () => {
    expect(parsePaging({ page: '0', limit: '9999' })).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(parsePaging({ page: 'abc' })).toMatchObject({ page: 1, limit: 20 });
    expect(parsePaging({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('rejects malformed date filters', () => {
    expect(() => parseDateRange({ from: 'not-a-date' })).toThrow(BadRequestException);
    expect(parseDateRange({})).toBeUndefined();
    const r = parseDateRange({ from: '2026-01-01', to: '2026-02-01' });
    expect(r?.gte).toBeInstanceOf(Date);
    expect(r?.lte).toBeInstanceOf(Date);
  });
});

describe('license detail and validation', () => {
  it('validate refuses a license whose device has been revoked', async () => {
    const db = fakeLicenses([
      { id: 'l', status: 'ACTIVE', userId: 'u', productId: 'p', deviceId: 'd', expiresAt: null, product: { status: 'ACTIVE' } },
    ]);
    db.device.findUnique = async () => ({ status: 'REVOKED' });
    const svc = new LicensesService(db, audit);
    db.license.findUnique = async () => ({ id: 'l', status: 'ACTIVE', userId: 'u', deviceId: 'd', expiresAt: null, product: { status: 'ACTIVE' } });
    await expect(svc.validate('u', 'l')).resolves.toEqual({ valid: false });
  });

  it('get returns ForbiddenException-free NotFound for other users', async () => {
    const db = fakeLicenses([]);
    db.license.findUnique = async () => ({ id: 'l', userId: 'owner' });
    const svc = new LicensesService(db, audit);
    await expect(svc.get('intruder', 'l')).rejects.toThrow('License not found');
    expect(ForbiddenException).toBeDefined();
  });
});
