# Deployment

1. Provision PostgreSQL.
2. Set all production environment variables from `.env.example` using a secret manager.
3. Set `CORS_ORIGINS` to exact trusted web origins; never `*`.
4. Run `npm ci`, `npm run prisma:generate`, `npm run prisma:deploy`, then `npm run build`.
5. Start with `npm run start:prod` behind TLS and a reverse proxy/load balancer.
6. Use private S3/R2-compatible object storage for production documents and replace the local storage adapter with the provider implementation.
7. Configure the payment provider webhook to `POST /api/v1/payments/webhook` and retain its signature header.
8. Use a shared rate-limit store before running multiple API instances.
