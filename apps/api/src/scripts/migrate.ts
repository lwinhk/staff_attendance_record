import { createDatabasePool, migrations, withTransaction } from "@attendance/database";
import { env } from "../config/env.js";

const database = createDatabasePool(env.DATABASE_URL);
try {
  await database.query(`create table if not exists schema_migrations (
    id varchar(160) primary key,
    applied_at timestamptz not null default now()
  )`);
  for (const migration of migrations) {
    const applied = await database.query("select 1 from schema_migrations where id = $1", [migration.id]);
    if (applied.rowCount) continue;
    await withTransaction(database, async (client) => {
      await client.query(migration.sql);
      await client.query("insert into schema_migrations (id) values ($1)", [migration.id]);
    });
    console.info(`Applied migration ${migration.id}`);
  }
} finally {
  await database.end();
}
