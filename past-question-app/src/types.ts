export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Returned by GET /api/v1/users/me (not by GET /auth/me or login). */
  whatsapp?: string | null;
};
export type DocumentSummary = { id: string; title: string; version: number; sizeBytes: number; checksumSha256: string; status?: string };
export type Product={id:string;title:string;description?:string|null;price?:number;currency?:string;category?:string|null;subject?:string|null;course?:string|null;level?:string|null;institution?:string|null;examType?:string|null;status:string;documents?:DocumentSummary[]};
export type License={id:string;userId:string;productId:string;purchaseId?:string;status:string;deviceId?:string|null;expiresAt?:string|null;activatedAt?:string|null;product:Product};
export type Device={id:string;platform:string;appVersion?:string|null;status:string;lastSeenAt:string;createdAt:string;publicKeyRegistered?:boolean};
export type ContentAuth = {
  authorizationToken: string;
  expiresAt: string;
  document: {
    id: string;
    title: string;
    version: number;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
  };
  artifactEndpoint: string;
};

export type AuthResult={accessToken:string;refreshToken:string;user:User};
