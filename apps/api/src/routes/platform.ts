import { randomUUID } from "node:crypto";
import type { Pool } from "@attendance/database";
import { withTransaction } from "@attendance/database";
import { Router } from "express";
import { z } from "zod";
import { writeAuditEvent } from "../lib/audit.js";
import { ApiError } from "../lib/errors.js";
import { hashPassword } from "../lib/security.js";
import { authenticate, authorize } from "../middleware/auth.js";

const createTenantSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  companyName: z.string().trim().min(2).max(200),
  timezone: z.string().trim().min(1).max(80).default("Pacific/Auckland"),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#173f35"),
  defaultDailyMinutes: z.number().int().min(1).max(1440).default(480),
  defaultLanguage: z.enum(["en", "my"]).default("en"),
  admin: z.object({
    displayName: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().min(7).max(32).optional(),
    password: z.string().min(12).max(200),
    preferredLanguage: z.enum(["en", "my"]).default("en"),
  }).refine((value) => value.email || value.phone, { message: "Email or phone is required" }),
});

export const createPlatformRouter = (database: Pool): Router => {
  const router = Router();
  router.use(authenticate(database), authorize("super_admin"));

  router.get("/tenants", async (_request, response, next) => {
    try {
      const result = await database.query(
        `select t.id, t.slug, t.status, ts.company_name, ts.timezone, ts.primary_color,
                t.created_at, count(u.id)::int as user_count
           from tenants t
           join tenant_settings ts on ts.tenant_id = t.id
           left join users u on u.tenant_id = t.id and u.deleted_at is null
          where t.deleted_at is null
          group by t.id, ts.tenant_id
          order by ts.company_name`,
      );
      response.json({ tenants: result.rows });
    } catch (error) { next(error); }
  });

  router.post("/tenants", async (request, response, next) => {
    try {
      const input = createTenantSchema.parse(request.body);
      const tenantId = randomUUID();
      const adminId = randomUUID();
      const passwordHash = await hashPassword(input.admin.password);

      await withTransaction(database, async (client) => {
        await client.query("insert into tenants (id, slug) values ($1, $2)", [tenantId, input.slug]);
        await client.query(
          `insert into tenant_settings
            (tenant_id, company_name, timezone, primary_color, default_daily_minutes, default_language)
           values ($1, $2, $3, $4, $5, $6)`,
          [tenantId, input.companyName, input.timezone, input.primaryColor, input.defaultDailyMinutes, input.defaultLanguage],
        );
        await client.query(
          `insert into users
            (id, tenant_id, role, display_name, email, phone, password_hash, preferred_language)
           values ($1, $2, 'tenant_admin', $3, $4, $5, $6, $7)`,
          [adminId, tenantId, input.admin.displayName, input.admin.email?.toLowerCase() ?? null, input.admin.phone ?? null, passwordHash, input.admin.preferredLanguage],
        );
        await writeAuditEvent(client, {
          tenantId,
          actorUserId: request.auth!.id,
          action: "tenant.created",
          entityType: "tenant",
          entityId: tenantId,
          metadata: { slug: input.slug, tenantAdminId: adminId },
        });
      });
      response.status(201).json({ tenant: { id: tenantId, slug: input.slug }, tenantAdminId: adminId });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return next(new ApiError(409, "DUPLICATE_VALUE", "Tenant slug, email, or phone already exists"));
      next(error);
    }
  });

  router.patch("/tenants/:tenantId/status", async (request, response, next) => {
    try {
      const tenantId = z.string().uuid().parse(request.params.tenantId);
      const { status } = z.object({ status: z.enum(["active", "suspended"]) }).parse(request.body);
      const result = await database.query(
        "update tenants set status = $1, updated_at = now() where id = $2 and deleted_at is null returning id",
        [status, tenantId],
      );
      if (!result.rowCount) throw new ApiError(404, "TENANT_NOT_FOUND", "Tenant not found");
      await writeAuditEvent(database, {
        tenantId,
        actorUserId: request.auth!.id,
        action: `tenant.${status}`,
        entityType: "tenant",
        entityId: tenantId,
      });
      response.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
};
