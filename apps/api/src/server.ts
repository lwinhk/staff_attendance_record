import { createDatabasePool } from "@attendance/database";
import pino from "pino";
import { createApp } from "./app.js";
import { env } from "./config/env.js";

const logger = pino({ level: env.LOG_LEVEL });
const database = createDatabasePool(env.DATABASE_URL);
const app = createApp({ database });

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, "Attendance API started");
});

const shutdown = (signal: NodeJS.Signals): void => {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    void database.end().finally(() => process.exit(0));
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
