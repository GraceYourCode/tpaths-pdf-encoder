import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async list(q: any, admin = false) {
    const where: any = admin ? {} : { status: 'ACTIVE' };
    if (q.search)
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { subject: { contains: q.search, mode: 'insensitive' } },
        { institution: { contains: q.search, mode: 'insensitive' } },
      ];
    for (const k of [
      'category',
      'subject',
      'course',
      'level',
      'institution',
      'examType',
      'status',
    ])
      if (q[k]) where[k] = q[k];
    const page = Number(q.page || 1),
      limit = Math.min(Number(q.limit || 20), 100);
    const orderBy = {
      [['title', 'createdAt', 'updatedAt'].includes(q.sortBy)
        ? q.sortBy
        : 'createdAt']: q.sortOrder === 'asc' ? 'asc' : 'desc',
    };
    const [items, total] = await Promise.all([
      (this.prisma as any).product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          currency: true,
          category: true,
          subject: true,
          course: true,
          level: true,
          institution: true,
          examType: true,
          status: true,
          coverImageKey: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      (this.prisma as any).product.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }
  async get(id: string, admin = false) {
    const p = await (this.prisma as any).product.findUnique({
      where: { id },
      include: {
        documents: {
          where: admin ? {} : { status: 'READY' },
          select: {
            id: true,
            title: true,
            version: true,
            sizeBytes: true,
            checksumSha256: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!p || (!admin && p.status !== 'ACTIVE'))
      throw new NotFoundException('Product not found');
    return p;
  }
  async create(d: any, adminId: string) {
    if (Number(d.price) < 1)
      throw new BadRequestException('Product price must be greater than zero');
    const data = {
      ...d,
      price: Number(d.price),
      currency: String(d.currency || 'NGN').toUpperCase(),
      createdById: adminId,
    };
    const p = await (this.prisma as any).product.create({ data });
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Product',
      entityId: p.id,
      metadata: { operation: 'create' },
    });
    return p;
  }
  async update(id: string, d: any, adminId: string) {
    const existing = await this.get(id, true);
    if (d.price !== undefined && Number(d.price) < 1)
      throw new BadRequestException('Product price must be greater than zero');
    if (d.status === 'ACTIVE' && Number(d.price ?? existing.price) < 1)
      throw new BadRequestException(
        'An ACTIVE product must have a positive price',
      );
    const data = {
      ...d,
      ...(d.price !== undefined ? { price: Number(d.price) } : {}),
      ...(d.currency !== undefined
        ? { currency: String(d.currency).toUpperCase() }
        : {}),
    };
    const p = await (this.prisma as any).product.update({
      where: { id },
      data,
    });
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Product',
      entityId: id,
      metadata: { operation: 'update' },
    });
    return p;
  }
  async archive(id: string, adminId: string) {
    return this.update(id, { status: 'ARCHIVED' }, adminId);
  }
  async remove(id: string, adminId: string) {
    await this.get(id, true);
    await (this.prisma as any).product.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    await this.audit.log({
      userId: adminId,
      action: 'ADMIN_ACTION',
      entityType: 'Product',
      entityId: id,
      metadata: { operation: 'archive' },
    });
    return { archived: true };
  }
}
