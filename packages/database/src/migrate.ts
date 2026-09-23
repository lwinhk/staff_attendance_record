import "dotenv/config";
import { createDatabasePool, withTransaction } from "./index.js";
import { migrations } from "./migrations.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = createDatabasePool(connectionString);

try {
  await pool.query(`
    create table if not exists schema_migrations (
      id varchar(160) primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const migration of migrations) {
    const applied = await pool.query<{ id: string }>("select id from schema_migrations where id = $1", [migration.id]);
    if (applied.rowCount) continue;

    await withTransaction(pool, async (client) => {
      await client.query(migration.sql);
      await client.query("insert into schema_migrations (id) values ($1)", [migration.id]);
    });
    console.info(`Applied migration ${migration.id}`);
  }
} finally {
  await pool.end();
}
