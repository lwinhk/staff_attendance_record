import { Pool, type PoolClient, type PoolConfig } from "pg";

export const createDatabasePool = (connectionString: string): Pool => {
  const config: PoolConfig = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };

  return new Pool(config);
};

export const checkDatabaseConnection = async (pool: Pool): Promise<void> => {
  await pool.query("select 1");
};

export const withTransaction = async <T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
export { migrations, type Migration } from "./migrations.js";
export { getAttendanceDetail, getEmployeeSiteSummary, getEmployeeSummary, getPeriodSummary, type ReportFilters, type Pagination } from "./reporting.js";
