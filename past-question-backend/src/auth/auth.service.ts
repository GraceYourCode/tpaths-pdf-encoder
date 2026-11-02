import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  hashPassword,
  verifyPassword,
  randomToken,
  sha256,
  signJwt,
  verifyJwt,
} from '../common/utils/crypto.js';
import { MailService } from '../mail/mail.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}
  private safe(u: any) {
    return {
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      status: u.status,
      emailVerifiedAt: u.emailVerifiedAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  async register(dto: any, ip?: string) {
    const email = dto.email.toLowerCase().trim();
    const exists = await (this.prisma as any).user.findUnique({
      where: { email },
    });
    if (exists)
      throw new ConflictException('An account with this email already exists');

    const u = await (this.prisma as any).user.create({
      data: {
        email,
        passwordHash: await hashPassword(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        whatsapp: dto.whatsapp,
      },
    });
    const raw = randomToken();
    await (this.prisma as any).emailVerificationToken.create({
      data: {
        userId: u.id,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 24 * 3600e3),
      },
    });
    await this.mail.sendVerification(email, raw);
    await this.audit.log({
      userId: u.id,
      action: 'USER_REGISTERED',
      ipAddress: ip,
    });
    return {
      user: this.safe(u),
      verificationToken:
        this.config.get('app.env') === 'production' ? undefined : raw,
    };
  }

  async login(dto: any, ip?: string, userAgent?: string) {
    const u = await (this.prisma as any).user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!u || !(await verifyPassword(dto.password, u.passwordHash))) {
      await this.audit.log({
        action: 'USER_LOGIN_FAILED',
        ipAddress: ip,
        metadata: { email: dto.email?.toLowerCase() },
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    // Password is verified first, so account state is only revealed to the
    // holder of the correct password.
    if (!u.emailVerifiedAt)
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email address before signing in',
      });
    if (u.status !== 'ACTIVE')
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is not active',
      });
    const sid = randomToken(18),
      family = randomToken(18);
    const refresh = signJwt(
      { sub: u.id, role: u.role, sid },
      this.config.getOrThrow('security.refreshSecret'),
      Math.floor(this.refreshMs() / 1000),
    );
    const exp = new Date(Date.now() + this.refreshMs());
    await (this.prisma as any).session.create({
      data: {
        id: sid,
        userId: u.id,
        tokenFamilyId: family,
        refreshTokenHash: sha256(refresh),
        userAgent,
        ipAddress: ip,
        expiresAt: exp,
      },
    });
    await this.audit.log({
      userId: u.id,
      action: 'USER_LOGIN_SUCCESS',
      ipAddress: ip,
    });
    return {
      accessToken: this.access(u, sid),
      refreshToken: refresh,
      user: this.safe(u),
    };
  }
  private refreshMs() {
    return Number(
      this.config.get<string>('security.refreshExpirationMs') ?? '2592000000',
    );
  }
  private access(u: any, sid: string) {
    return signJwt(
      { sub: u.id, role: u.role, sid },
      this.config.getOrThrow('security.accessSecret'),
      Number(this.config.get<string>('security.accessExpirationSec') ?? 900),
    );
  }
  async refresh(raw: string, ip?: string, userAgent?: string) {
    let token: any;
    try {
      token = verifyJwt<any>(
        raw,
        this.config.getOrThrow('security.refreshSecret'),
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const hash = sha256(raw);
    const s = await (this.prisma as any).session.findUnique({
      where: { id: token.sid },
      include: { user: true },
    });
    if (!s || s.revokedAt || s.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (s.refreshTokenHash !== hash) {
      await (this.prisma as any).session.updateMany({
        where: { tokenFamilyId: s.tokenFamilyId },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        userId: s.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    const next = signJwt(
      { sub: s.user.id, role: s.user.role, sid: s.id },
      this.config.getOrThrow('security.refreshSecret'),
      Math.floor(this.refreshMs() / 1000),
    );
    const rotated = await (this.prisma as any).session.updateMany({
      where: {
        id: s.id,
        refreshTokenHash: hash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: sha256(next),
        ipAddress: ip,
        userAgent: userAgent ?? s.userAgent,
      },
    });
    if (rotated.count !== 1) {
      await (this.prisma as any).session.updateMany({
        where: { tokenFamilyId: s.tokenFamilyId },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        userId: s.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { accessToken: this.access(s.user, s.id), refreshToken: next };
  }
  async logout(sessionId: string) {
    await (this.prisma as any).session.updateMany({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }
  async logoutAll(userId: string) {
    await (this.prisma as any).session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  async me(userId: string) {
    const u = await (this.prisma as any).user.findUnique({
      where: { id: userId },
    });
    return this.safe(u);
  }
  async verifyEmail(raw: string) {
    const t = await (this.prisma as any).emailVerificationToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!t || t.usedAt || t.expiresAt <= new Date())
      throw new UnauthorizedException('Invalid verification token');
    await (this.prisma as any).$transaction([
      (this.prisma as any).emailVerificationToken.update({
        where: { id: t.id },
        data: { usedAt: new Date() },
      }),
      (this.prisma as any).user.update({
        where: { id: t.userId },
        data: { emailVerifiedAt: new Date(), status: 'ACTIVE' },
      }),
    ]);
    await this.audit.log({ userId: t.userId, action: 'EMAIL_VERIFIED' });
    return { verified: true };
  }
  async forgotPassword(email: string) {
    const u = await (this.prisma as any).user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (u) {
      const raw = randomToken();
      await (this.prisma as any).passwordResetToken.create({
        data: {
          userId: u.id,
          tokenHash: sha256(raw),
          expiresAt: new Date(Date.now() + 30 * 60e3),
        },
      });
      await this.mail.sendPasswordReset(u.email, raw);
      await this.audit.log({
        userId: u.id,
        action: 'PASSWORD_RESET_REQUESTED',
      });
      return this.config.get('app.env') === 'production' ? undefined : raw;
    }
    return undefined;
  }
  async resetPassword(raw: string, password: string) {
    const t = await (this.prisma as any).passwordResetToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!t || t.usedAt || t.expiresAt <= new Date())
      throw new UnauthorizedException('Invalid reset token');
    await (this.prisma as any).$transaction([
      (this.prisma as any).passwordResetToken.update({
        where: { id: t.id },
        data: { usedAt: new Date() },
      }),
      (this.prisma as any).user.update({
        where: { id: t.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      (this.prisma as any).session.updateMany({
        where: { userId: t.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({ userId: t.userId, action: 'PASSWORD_CHANGED' });
    return { reset: true };
  }
  async resendVerification(email: string) {
    const u = await (this.prisma as any).user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!u || u.emailVerifiedAt) return;
    const raw = randomToken();
    await (this.prisma as any).emailVerificationToken.updateMany({
      where: { userId: u.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await (this.prisma as any).emailVerificationToken.create({
      data: {
        userId: u.id,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + 24 * 3600e3),
      },
    });
    await this.mail.sendVerification(u.email, raw);
    return this.config.get('app.env') === 'production' ? undefined : raw;
  }
}
