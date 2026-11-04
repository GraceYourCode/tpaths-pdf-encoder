/**
 * Operator tool: set an admin's password without email access.
 *
 * Usage (run on a machine that has DATABASE_URL set, from the backend folder):
 *
 *   ADMIN_PASSWORD='<at least 12 characters>' npx tsx scripts/admin-set-password.ts \
 *     --email admin@example.com [--role SUPER_ADMIN] [--create --first Ada --last Obi --whatsapp +2348000000000]
 *
 * Behaviour:
 *   - Existing user: sets the password, revokes all their sessions, sets status
 *     ACTIVE and marks the email verified (if not already). Role changes only
 *     when --role is given.
 *   - Missing user: only created with --create (role defaults to ADMIN).
 *   - Writes an ADMIN_PASSWORD_RESET audit record.
 *
 * The password is read from the ADMIN_PASSWORD environment variable so it does
 * not appear in shell history or process listings.
 */
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createDatabaseAdapter } from '../src/database/prisma-client.js';
import { hashPassword } from '../src/common/utils/crypto.js';

const ROLES = ['ADMIN', 'SUPER_ADMIN'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function main() {
  const url = "postgres://gym_saas_user:gym_saas_password@localhost:5432/gym_saas_db"
  if (!url) fail('DATABASE_URL is not set');

  const email = arg('email')?.toLowerCase().trim();
  if (!email || !email.includes('@')) fail('--email is required');

  const password = process.env.ADMIN_PASSWORD ?? '';
  if (password.length < 12) fail('ADMIN_PASSWORD must be set and at least 12 characters');

  const role = arg('role');
  if (role !== undefined && !ROLES.includes(role)) fail(`--role must be one of ${ROLES.join(', ')}`);

  const prisma = new PrismaClient({ adapter: createDatabaseAdapter(url) as any } as any) as any;
  try {
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({ where: { email } });

    let user: any;
    let action: 'UPDATED' | 'CREATED';
    if (existing) {
      action = 'UPDATED';
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          status: 'ACTIVE',
          ...(existing.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
          ...(role ? { role } : {}),
        },
      });
    } else {
      if (!flag('create')) fail(`No user with email ${email}. Add --create to create an admin account.`);
      const first = arg('first');
      const last = arg('last');
      const whatsapp = arg('whatsapp');
      if (!first || !last || !whatsapp) fail('--create requires --first, --last and --whatsapp');
      action = 'CREATED';
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: first,
          lastName: last,
          whatsapp,
          role: role ?? 'ADMIN',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });
    }

    const revoked = await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'ADMIN_PASSWORD_RESET',
        entityType: 'User',
        entityId: user.id,
        metadata: { operator: 'scripts/admin-set-password', result: action, sessionsRevoked: revoked.count },
      },
    });

    console.log(`${action === 'CREATED' ? 'Created' : 'Updated'} ${user.email} (role ${user.role}, status ${user.status}).`);
    console.log(`Sessions revoked: ${revoked.count}. You can now sign in with the new password.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
