import type { AuthenticatedUser, Language, UserRole } from "@attendance/contracts";
import type { Pool } from "@attendance/database";

interface UserCredentialRow {
  id: string;
  tenant_id: string | null;
  role: UserRole;
  display_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  preferred_language: Language;
}

interface SessionUserRow extends Omit<UserCredentialRow, "password_hash"> {
  tenant_slug: string | null;
  company_name: string | null;
  timezone: string | null;
  primary_color: string | null;
}

export const findUserByIdentifier = async (
  database: Pool,
  identifier: string,
): Promise<UserCredentialRow | null> => {
  const result = await database.query<UserCredentialRow>(
    `select id, tenant_id, role, display_name, email, phone, password_hash, preferred_language
       from users
      where deleted_at is null and status = 'active'
        and (lower(email) = lower($1) or phone = $1)
      limit 1`,
    [identifier.trim()],
  );
  return result.rows[0] ?? null;
};

export const createSession = async (
  database: Pool,
  tokenHash: string,
  userId: string,
  expiresAt: Date,
): Promise<void> => {
  await database.query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)",
    [tokenHash, userId, expiresAt],
  );
};

const toAuthenticatedUser = (row: SessionUserRow): AuthenticatedUser => ({
  id: row.id,
  tenantId: row.tenant_id,
  role: row.role,
  displayName: row.display_name,
  email: row.email,
  phone: row.phone,
  preferredLanguage: row.preferred_language,
  tenant: row.tenant_id && row.tenant_slug && row.company_name && row.timezone && row.primary_color
    ? {
        slug: row.tenant_slug,
        companyName: row.company_name,
        timezone: row.timezone,
        primaryColor: row.primary_color,
      }
    : null,
});

export const findUserBySession = async (
  database: Pool,
  tokenHash: string,
): Promise<AuthenticatedUser | null> => {
  const result = await database.query<SessionUserRow>(
    `select u.id, u.tenant_id, u.role, u.display_name, u.email, u.phone, u.preferred_language,
            t.slug as tenant_slug, ts.company_name, ts.timezone, ts.primary_color
       from sessions s
       join users u on u.id = s.user_id
       left join tenants t on t.id = u.tenant_id
       left join tenant_settings ts on ts.tenant_id = t.id
      where s.token_hash = $1 and s.expires_at > now()
        and u.status = 'active' and u.deleted_at is null
        and (t.id is null or (t.status = 'active' and t.deleted_at is null))`,
    [tokenHash],
  );
  if (!result.rows[0]) return null;
  void database.query("update sessions set last_seen_at = now() where token_hash = $1", [tokenHash]).catch(() => undefined);
  return toAuthenticatedUser(result.rows[0]);
};

export const deleteSession = async (database: Pool, tokenHash: string): Promise<void> => {
  await database.query("delete from sessions where token_hash = $1", [tokenHash]);
};
