# Database

PostgreSQL is accessed exclusively through Prisma. `prisma/schema.prisma` defines users, sessions, verification/reset secrets, products, documents, payments, purchases, licenses, activation tokens, devices and audit logs.

Use `npm run prisma:generate`, `npm run prisma:migrate` for development, and `npm run prisma:deploy` for production. Production must use committed migrations rather than `db push`.
