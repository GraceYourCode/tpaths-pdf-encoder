export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN' | string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  category: string | null;
  subject: string | null;
  course: string | null;
  level: string | null;
  institution: string | null;
  examType: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | string;
  coverImageKey: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: DocumentSummary[];
};

export type DocumentSummary = {
  id: string;
  title: string;
  version: number;
  sizeBytes: number;
  checksumSha256: string;
  status?: string;
  createdAt?: string;
};

export type Purchase = {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  product: Pick<Product, 'id' | 'title' | 'status'>;
  payment?: { reference: string; status: string; currency: string; amount: number };
  license?: License | null;
};

export type License = {
  id: string;
  userId: string;
  productId: string;
  purchaseId: string;
  status: string;
  deviceId: string | null;
  expiresAt: string | null;
  activatedAt: string | null;
  lastValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: { id: string; title: string; status: string; documents?: DocumentSummary[] };
};

export type Device = {
  id: string;
  platform: string;
  appVersion: string | null;
  status: string;
  lastSeenAt: string;
  createdAt: string;
};

export type ApiError = {
  success?: false;
  error?: { code?: string; message?: string; details?: unknown };
  message?: string;
};

export type PaymentVerification = Purchase & {
  activationToken?: string;
  activationTokenExpiresAt?: string | null;
};
