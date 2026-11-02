import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { LicensesService } from '../licenses/licenses.service.js';
import { AuditService } from '../audit/audit.service.js';

const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_TIMEOUT_MS = 15000;

/**
 * Payment lifecycle:
 *   1. initialize  -> PENDING payment + PENDING purchase, Paystack transaction created
 *   2. complete    -> triggered by verify (user) or webhook (provider). Server
 *                     re-checks the transaction with Paystack, then atomically
 *                     claims the PENDING purchase and creates license + activation
 *                     token in one database transaction.
 *
 * Completion is idempotent: the claim is a conditional updateMany on status, so
 * concurrent verify/webhook calls cannot create a second license or token.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly licenses: LicensesService,
    private readonly audit: AuditService,
  ) {}

  private provider() {
    return this.config.get<string>('payment.provider') || 'paystack';
  }

  private assertProvider() {
    if (this.provider() !== 'paystack')
      throw new BadRequestException('Unsupported payment provider');
  }

  // -------------------------------------------------------------------------
  // 1. Initialization
  // -------------------------------------------------------------------------

  async initialize(userId: string, productId: string, ip?: string) {
    this.assertProvider();
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
    });
    if (!user || user.status !== 'ACTIVE')
      throw new ForbiddenException('Account is not active');

    const product = await (this.prisma as any).product.findUnique({
      where: { id: productId },
    });
    if (!product || product.status !== 'ACTIVE')
      throw new NotFoundException('Product not found');
    if (!(product.price > 0))
      throw new BadRequestException('Product is free and cannot be purchased');

    const owned = await (this.prisma as any).license.findFirst({
      where: { userId, productId, status: 'ACTIVE' },
    });
    if (owned) throw new ConflictException('Product already purchased');

    // Server-generated reference: the client never chooses amount or reference.
    const reference = `PQ-${randomUUID()}`;
    const { purchase } = await (this.prisma as any).$transaction(
      async (tx: any) => {
        const payment = await tx.payment.create({
          data: {
            provider: this.provider(),
            reference,
            amount: product.price,
            currency: product.currency,
            status: 'PENDING',
          },
        });
        const purchase = await tx.purchase.create({
          data: {
            userId,
            productId,
            paymentId: payment.id,
            reference,
            amount: product.price,
            currency: product.currency,
            status: 'PENDING',
          },
        });
        return { purchase };
      },
    );

    let init: any;
    try {
      init = await this.paystackRequest('/transaction/initialize', 'POST', {
        email: user.email,
        amount: product.price,
        currency: product.currency,
        reference,
        metadata: { productId, userId, purchaseId: purchase.id },
      });
    } catch (error) {
      await (this.prisma as any).purchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });
      throw error;
    }
    if (!init.status || !init.data?.authorization_url) {
      await (this.prisma as any).purchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Payment could not be initialized');
    }

    await this.audit.log({
      userId,
      action: 'PAYMENT_INITIALIZED',
      entityType: 'Purchase',
      entityId: purchase.id,
      ipAddress: ip,
    });
    return {
      reference,
      authorizationUrl: init.data.authorization_url,
      accessCode: init.data.access_code,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Completion
  // -------------------------------------------------------------------------

  /** Client-initiated confirmation. Only the purchase owner may confirm it. */
  async verify(userId: string, d: any, ip?: string) {
    this.assertProvider();
    return this.complete(d.reference, {
      expectedUserId: userId,
      productIdHint: d.productId,
      requestedAmount: d.amount,
      ip,
    });
  }

  private async complete(
    reference: string,
    opts: {
      expectedUserId?: string;
      productIdHint?: string;
      requestedAmount?: number;
      eventId?: string;
      ip?: string;
    },
  ) {
    const result = await this.paystackRequest(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      'GET',
    );
    if (!result.status || result.data?.status !== 'success')
      throw new BadRequestException('Payment could not be verified');

    const data = result.data;
    const amount = Number(data.amount);
    const currency = String(data.currency || '').toUpperCase();
    if (
      opts.requestedAmount !== undefined &&
      Number(opts.requestedAmount) !== amount
    )
      throw new BadRequestException('Payment amount mismatch');

    let purchase = await (this.prisma as any).purchase.findUnique({
      where: { reference },
      include: { product: true },
    });

    if (!purchase) {
      // Verify without a prior initialize call: create the pending records here.
      // Webhooks never create ownerless purchases.
      if (!opts.expectedUserId) return { processed: false, ignored: true };
      const productId = String(opts.productIdHint || data.metadata?.productId || '');
      if (!productId) throw new BadRequestException('Product is required');
      const product = await (this.prisma as any).product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new BadRequestException('Product unavailable');
      purchase = await (this.prisma as any).$transaction(async (tx: any) => {
        const payment = await tx.payment.create({
          data: {
            provider: this.provider(),
            reference,
            amount,
            currency,
            status: 'PENDING',
            rawMetadata: { customerEmail: data.customer?.email },
          },
        });
        const created = await tx.purchase.create({
          data: {
            userId: opts.expectedUserId,
            productId,
            paymentId: payment.id,
            reference,
            amount,
            currency,
            status: 'PENDING',
          },
        });
        return { ...created, product };
      });
    }

    if (opts.expectedUserId && purchase.userId !== opts.expectedUserId)
      throw new ForbiddenException('Payment does not belong to this account');

    if (purchase.status === 'PAID') {
      return this.purchaseResult(purchase.id, { alreadyProcessed: true });
    }

    const product = purchase.product;
    if (!product || product.status !== 'ACTIVE')
      throw new BadRequestException('Product unavailable');
    if (amount !== purchase.amount || amount !== product.price)
      throw new BadRequestException('Payment amount does not match product price');
    if (currency !== String(product.currency).toUpperCase())
      throw new BadRequestException('Payment currency does not match product currency');

    // Atomic claim: only one caller can move PENDING/FAILED -> PAID.
    const outcome = await (this.prisma as any).$transaction(async (tx: any) => {
      const claimed = await tx.purchase.updateMany({
        where: { id: purchase.id, status: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'PAID' },
      });
      if (claimed.count !== 1) return null;

      await tx.payment.update({
        where: { id: purchase.paymentId },
        data: {
          status: 'SUCCESS',
          verifiedAt: new Date(),
          ...(opts.eventId ? { eventId: opts.eventId } : {}),
        },
      });
      await tx.license.create({
        data: {
          userId: purchase.userId,
          productId: purchase.productId,
          purchaseId: purchase.id,
          status: 'ACTIVE',
        },
      });
      // Activation token is created inside the same transaction, so a purchase
      // can never be PAID without its activation token.
      const token = await this.licenses.generateToken(
        purchase.productId,
        undefined,
        purchase.id,
        tx,
      );
      return token;
    });

    if (!outcome) return this.purchaseResult(purchase.id, { alreadyProcessed: true });

    await this.audit.log({
      userId: purchase.userId,
      action: 'PAYMENT_VERIFIED',
      entityType: 'Payment',
      entityId: purchase.paymentId,
      ipAddress: opts.ip,
    });
    return this.purchaseResult(purchase.id, {
      alreadyProcessed: false,
      activationToken: outcome.token,
      activationTokenExpiresAt: outcome.expiresAt,
    });
  }

  // -------------------------------------------------------------------------
  // Webhook
  // -------------------------------------------------------------------------

  verifyWebhook(raw: string, signature: string) {
    const secret = this.config.getOrThrow<string>('payment.secretKey');
    const expected = createHmac('sha512', secret).update(raw).digest();
    const actual = Buffer.from(signature ?? '', 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new UnauthorizedException('Invalid webhook signature');
  }

  async webhook(payload: any, ip?: string) {
    this.assertProvider();
    const eventId = String(payload?.data?.id ?? '');
    if (!eventId) throw new BadRequestException('Missing event id');

    if (payload?.event !== 'charge.success') {
      await this.audit.log({
        action: 'WEBHOOK_IGNORED',
        ipAddress: ip,
        metadata: { event: payload?.event, eventId },
      });
      return { processed: true, ignored: true };
    }

    const reference = String(payload?.data?.reference ?? '');
    if (!reference) throw new BadRequestException('Missing payment reference');

    const seen = await (this.prisma as any).payment.findUnique({
      where: { eventId },
    });
    if (seen) return { processed: true, duplicate: true };

    try {
      const result = await this.complete(reference, { eventId, ip });
      if ((result as any).ignored) return { processed: true, ignored: true };
    } catch (error: any) {
      // A concurrent delivery of the same event hit the unique eventId constraint.
      if (error?.code === 'P2002') return { processed: true, duplicate: true };
      throw error;
    }

    await this.audit.log({
      action: 'WEBHOOK_RECEIVED',
      ipAddress: ip,
      metadata: { event: payload.event, eventId },
    });
    return { processed: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async purchaseResult(
    id: string,
    extra: Record<string, unknown> = {},
  ) {
    const p = await (this.prisma as any).purchase.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, title: true } },
        license: true,
      },
    });
    return {
      id: p.id,
      reference: p.reference,
      status: p.status,
      amount: p.amount,
      currency: p.currency,
      product: p.product,
      license: p.license,
      ...extra,
    };
  }

  private async paystackRequest(path: string, method: 'GET' | 'POST', body?: unknown) {
    const key = this.config.getOrThrow<string>('payment.secretKey');
    let r: Response;
    try {
      r = await fetch(`${PAYSTACK_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
      });
    } catch {
      this.logger.error(`Paystack request failed: ${method} ${path}`);
      throw new BadRequestException('Payment provider is unavailable');
    }
    if (!r.ok) {
      this.logger.warn(`Paystack returned ${r.status} for ${method} ${path}`);
      throw new BadRequestException('Payment request failed');
    }
    return (await r.json()) as any;
  }
}
