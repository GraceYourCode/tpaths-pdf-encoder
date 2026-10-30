import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service.js';

describe('ProductsService pricing', () => {
  it('rejects a non-positive product price', async () => {
    const prisma = { product: { create: vi.fn() } };
    const audit = { log: vi.fn() };
    const service = new ProductsService(prisma as any, audit as any);
    await expect(service.create({ title: 'JAMB Past Questions', price: 0 }, 'admin')).rejects.toThrow('Product price must be greater than zero');
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('normalizes currency and stores the catalog price', async () => {
    const created = { id: 'p1', title: 'JAMB Past Questions', price: 250000, currency: 'NGN' };
    const prisma = { product: { create: vi.fn().mockResolvedValue(created) } };
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const service = new ProductsService(prisma as any, audit as any);
    await service.create({ title: 'JAMB Past Questions', price: 250000, currency: 'ngn' }, 'admin');
    expect(prisma.product.create).toHaveBeenCalledWith({ data: { title: 'JAMB Past Questions', price: 250000, currency: 'NGN', createdById: 'admin' } });
  });
});
