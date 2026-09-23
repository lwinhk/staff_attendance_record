import type { UserRole } from "@attendance/contracts";

export const canResetUserPassword = (actor: UserRole, target: UserRole): boolean => {
  if (actor === "tenant_admin") return target !== "super_admin";
  return actor === "operations_admin" && target === "site_supervisor";
};
