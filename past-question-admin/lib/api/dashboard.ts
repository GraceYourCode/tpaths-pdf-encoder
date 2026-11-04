import type { BackendAuditLog, DashboardStats } from "./types";
import { mapAuditEvent } from "./types";
import { backendRequest } from "./server";

interface BackendDashboard {
  students: { total: number; active: number };
  products: { total: number; active: number };
  licenses: { total: number; active: number };
  tokens: { total: number; active: number };
  purchases: { paid: number };
  recentActivity: BackendAuditLog[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const data = await backendRequest<BackendDashboard>({ path: "/admin/dashboard", method: "GET" });
  return {
    totalProducts: data.products.total,
    activeProducts: data.products.active,
    totalStudents: data.students.total,
    activeStudents: data.students.active,
    totalLicenses: data.licenses.total,
    activeLicenses: data.licenses.active,
    totalTokens: data.tokens.total,
    activeTokens: data.tokens.active,
    paidPurchases: data.purchases.paid,
    recentActivity: (data.recentActivity ?? []).map(mapAuditEvent),
  };
}
