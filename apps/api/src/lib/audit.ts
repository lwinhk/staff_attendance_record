import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "@attendance/database";

export const writeAuditEvent = async (
  database: Pool | PoolClient,
  event: {
    tenantId: string | null;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> => {
  await database.query(
    `insert into audit_events (id, tenant_id, actor_user_id, action, entity_type, entity_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), event.tenantId, event.actorUserId, event.action, event.entityType, event.entityId ?? null, event.metadata ?? {}],
  );
};
