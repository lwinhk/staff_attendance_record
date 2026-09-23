export type ServiceStatus = "ok" | "degraded";

export interface HealthResponse {
  service: "attendance-api";
  status: ServiceStatus;
  timestamp: string;
  version: string;
}

export interface ReadinessResponse extends HealthResponse {
  checks: {
    database: ServiceStatus;
  };
}

export type UserRole = "super_admin" | "tenant_admin" | "operations_admin" | "site_supervisor";
export type Language = "en" | "my";

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  role: UserRole;
  displayName: string;
  email: string | null;
  phone: string | null;
  preferredLanguage: Language;
  tenant: null | {
    slug: string;
    companyName: string;
    timezone: string;
    primaryColor: string;
  };
}
