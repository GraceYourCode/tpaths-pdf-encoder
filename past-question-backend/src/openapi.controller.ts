import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/auth.decorator.js';

/**
 * Route summary document. The authoritative request/response contract is
 * docs/api-contract.md; keep this list in step with it. Schemas are not yet
 * generated, so this file describes routes and security only.
 */
@Controller('openapi')
export class OpenApiController {
  @Public()
  @Get('json')
  document() {
    const op = (summary: string, security = true) => ({
      summary,
      ...(security ? {} : { security: [] }),
    });
    return {
      openapi: '3.0.3',
      info: { title: 'Past Question Platform API', version: '1.0.0' },
      servers: [{ url: '/api/v1' }],
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      paths: {
        '/health': { get: op('Liveness', false) },
        '/health/db': { get: op('Database readiness (informational)', false) },
        '/health/ready': { get: op('Readiness: database and object storage (503 when down)', false) },
        '/auth/register': { post: op('Register (409 if email exists)', false) },
        '/auth/login': { post: op('Login (403 EMAIL_NOT_VERIFIED or ACCOUNT_INACTIVE)', false) },
        '/auth/refresh': { post: op('Rotate refresh token', false) },
        '/auth/logout': { post: op('Revoke current session') },
        '/auth/logout-all': { post: op('Revoke all sessions') },
        '/auth/me': { get: op('Current user') },
        '/auth/verify-email': { post: op('Verify email with token', false) },
        '/auth/resend-verification': { post: op('Resend verification', false) },
        '/auth/forgot-password': { post: op('Request password reset', false) },
        '/auth/reset-password': { post: op('Reset password', false) },
        '/users/me': { get: op('Profile'), patch: op('Update profile') },
        '/users/me/licenses': { get: op('My licenses') },
        '/users/me/purchases': { get: op('My purchases') },
        '/users/me/devices': { get: op('My devices') },
        '/products': { get: op('List active products', false) },
        '/products/{id}': { get: op('Get active product', false) },
        '/devices': { get: op('List my devices') },
        '/devices/register': { post: op('Register device and optional P-256 public key') },
        '/devices/{id}/validate': { post: op('Validate device') },
        '/devices/{id}/revoke': { post: op('Revoke device') },
        '/licenses': { get: op('My licenses') },
        '/licenses/activate': { post: op('Activate purchase token and bind device') },
        '/licenses/{id}': { get: op('Get license') },
        '/licenses/{id}/validate': { post: op('Validate license for device') },
        '/content/{documentId}/access': { post: op('Issue content authorization token') },
        '/content/{documentId}/artifact': { get: op('Download device-bound .pqe artifact (X-Content-Authorization)') },
        '/payments/initialize': { post: op('Start Paystack transaction for a product') },
        '/payments/verify': { post: op('Confirm a Paystack transaction') },
        '/payments/webhook': { post: op('Paystack webhook (HMAC-SHA512 signed)', false) },
        '/admin/dashboard': { get: op('Admin dashboard') },
        '/admin/students': { get: op('List students') },
        '/admin/audit-logs': { get: op('Audit log') },
        '/admin/tokens': { get: op('List activation tokens'), post: op('Create activation token') },
        '/admin/products': { get: op('List products'), post: op('Create product') },
        '/admin/products/{id}': { get: op('Get product'), patch: op('Update product'), delete: op('Delete product') },
        '/admin/products/{id}/archive': { post: op('Archive product') },
        '/admin/products/{productId}/documents': { get: op('List documents'), post: op('Upload PDF (encrypted at rest)') },
        '/admin/products/{productId}/documents/{id}': { get: op('Get document'), patch: op('Update document status'), delete: op('Disable document') },
        '/admin/licenses': { get: op('List licenses') },
        '/admin/licenses/{id}': { get: op('Get license') },
        '/admin/licenses/{id}/suspend': { post: op('Suspend license') },
        '/admin/licenses/{id}/revoke': { post: op('Revoke license') },
        '/admin/purchases': { get: op('List purchases') },
        '/admin/purchases/{id}': { get: op('Get purchase') },
      },
    };
  }
}
