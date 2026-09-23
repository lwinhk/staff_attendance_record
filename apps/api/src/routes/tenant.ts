import { randomUUID } from "node:crypto";
import type { Pool } from "@attendance/database";
import { Router } from "express";
import { z } from "zod";
import { writeAuditEvent } from "../lib/audit.js";
import { ApiError } from "../lib/errors.js";
import { canResetUserPassword } from "../lib/permissions.js";
import { hashPassword } from "../lib/security.js";
import { authenticate, authorize, requireTenant } from "../middleware/auth.js";

const settingsSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  timezone: z.string().trim().min(1).max(80),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultDailyMinutes: z.number().int().min(1).max(1440),
  defaultLanguage: z.enum(["en", "my"]),
});

const createUserSchema = z.object({
  role: z.enum(["operations_admin", "site_supervisor"]),
  displayName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().min(7).max(32).optional(),
  password: z.string().min(12).max(200),
  preferredLanguage: z.enum(["en", "my"]).default("en"),
}).refine((value) => value.email || value.phone, { message: "Email or phone is required" });

const resetPasswordSchema = z.object({ password: z.string().min(12).max(200) });
const languageSchema = z.object({ preferredLanguage: z.enum(["en", "my"]) });

export const createTenantRouter = (database: Pool): Router => {
  const router = Router();
  router.use(authenticate(database));

  router.get("/settings", authorize("tenant_admin", "operations_admin"), async (request, response, next) => {
    try {
      const tenantId = requireTenant(request);
      const result = await database.query(
        `select company_name, logo_object_key, timezone, primary_color, default_daily_minutes, default_language
           from tenant_settings where tenant_id = $1`,
        [tenantId],
      );
      response.json({ settings: result.rows[0] });
    } catch (error) { next(error); }
  });

  router.put("/settings", authorize("tenant_admin"), async (request, response, next) => {
    try {
      const tenantId = requireTenant(request);
      const input = settingsSchema.parse(request.body);
      await database.query(
        `update tenant_settings set company_name = $1, timezone = $2, primary_color = $3,
                default_daily_minutes = $4, default_language = $5, updated_at = now()
          where tenant_id = $6`,
        [input.companyName, input.timezone, input.primaryColor, input.defaultDailyMinutes, input.defaultLanguage, tenantId],
      );
      await writeAuditEvent(database, { tenantId, actorUserId: request.auth!.id, action: "tenant.settings_updated", entityType: "tenant", entityId: tenantId });
      response.status(204).send();
    } catch (error) { next(error); }
  });

  router.patch("/profile/language", async (request, response, next) => {
    try {
      const input = languageSchema.parse(request.body);
      await database.query("update users set preferred_language = $1, updated_at = now() where id = $2", [input.preferredLanguage, request.auth!.id]);
      response.status(204).send();
    } catch (error) { next(error); }
  });

  router.get("/users", authorize("tenant_admin"), async (request, response, next) => {
    try {
      const tenantId = requireTenant(request);
      const result = await database.query(
        `select id, role, display_name, email, phone, status, preferred_language, created_at
           from users where tenant_id = $1 and deleted_at is null order by display_name`,
        [tenantId],
      );
      response.json({ users: result.rows });
    } catch (error) { next(error); }
  });

  router.post("/users", authorize("tenant_admin"), async (request, response, next) => {
    try {
      const tenantId = requireTenant(request);
      const input = createUserSchema.parse(request.body);
      const userId = randomUUID();
      const passwordHash = await hashPassword(input.password);
      await database.query(
        `insert into users (id, tenant_id, role, display_name, email, phone, password_hash, preferred_language)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, tenantId, input.role, input.displayName, input.email?.toLowerCase() ?? null, input.phone ?? null, passwordHash, input.preferredLanguage],
      );
      await writeAuditEvent(database, { tenantId, actorUserId: request.auth!.id, action: "user.created", entityType: "user", entityId: userId, metadata: { role: input.role } });
      response.status(201).json({ userId });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return next(new ApiError(409, "DUPLICATE_VALUE", "Email or phone already exists"));
      next(error);
    }
  });

  router.post("/users/:userId/reset-password", authorize("tenant_admin", "operations_admin"), async (request, response, next) => {
    try {
      const tenantId = requireTenant(request);
      const targetUserId = z.string().uuid().parse(request.params.userId);
      const input = resetPasswordSchema.parse(request.body);
      const target = await database.query<{ role: string }>(
        "select role from users where id = $1 and tenant_id = $2 and deleted_at is null",
        [targetUserId, tenantId],
      );
      if (!target.rows[0]) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
      if (!canResetUserPassword(request.auth!.role, target.rows[0].role as "tenant_admin" | "operations_admin" | "site_supervisor"))
        throw new ApiError(403, "FORBIDDEN", "You cannot reset this user's password");
      const passwordHash = await hashPassword(input.password);
      await database.query("update users set password_hash = $1, password_changed_at = now(), updated_at = now() where id = $2 and tenant_id = $3", [passwordHash, targetUserId, tenantId]);
      await database.query("delete from sessions where user_id = $1", [targetUserId]);
      await writeAuditEvent(database, { tenantId, actorUserId: request.auth!.id, action: "user.password_reset", entityType: "user", entityId: targetUserId });
      response.status(204).send();
    } catch (error) { next(error); }
  });

  router.patch("/users/:userId/status", authorize("tenant_admin"), async (request, response, next) => {
    try {
      const tenantId = requireTenant(request);
      const targetUserId = z.string().uuid().parse(request.params.userId);
      const { status } = z.object({ status: z.enum(["active", "disabled"]) }).parse(request.body);
      const target = await database.query<{ role: string }>("select role from users where id = $1 and tenant_id = $2 and deleted_at is null", [targetUserId, tenantId]);
      if (!target.rows[0]) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
      if (target.rows[0].role === "tenant_admin") throw new ApiError(400, "TENANT_ADMIN_REQUIRED", "Tenant Admin cannot be disabled");
      await database.query("update users set status = $1, updated_at = now() where id = $2 and tenant_id = $3", [status, targetUserId, tenantId]);
      if (status === "disabled") await database.query("delete from sessions where user_id = $1", [targetUserId]);
      await writeAuditEvent(database, { tenantId, actorUserId: request.auth!.id, action: `user.${status}`, entityType: "user", entityId: targetUserId });
      response.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
};
