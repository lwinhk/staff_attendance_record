import { randomUUID } from "node:crypto";
import { createDatabasePool } from "@attendance/database";
import { env } from "../config/env.js";
import { hashPassword } from "../lib/security.js";

const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;
const displayName = process.env.SUPER_ADMIN_NAME?.trim() ?? "Platform Administrator";

if (!email || !password || password.length < 12) {
  throw new Error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (minimum 12 characters) are required");
}

const database = createDatabasePool(env.DATABASE_URL);
try {
  const existing = await database.query("select id from users where role = 'super_admin' and deleted_at is null limit 1");
  if (existing.rowCount) throw new Error("A Super Admin already exists; bootstrap is intentionally one-time only");
  const userId = randomUUID();
  await database.query(
    `insert into users (id, role, display_name, email, password_hash)
     values ($1, 'super_admin', $2, $3, $4)`,
    [userId, displayName, email, await hashPassword(password)],
  );
  console.info(`Created Super Admin ${email} (${userId})`);
} finally {
  await database.end();
}
