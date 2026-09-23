import type { HealthResponse, ReadinessResponse } from "@attendance/contracts";
import { checkDatabaseConnection, type Pool } from "@attendance/database";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { ApiError } from "./lib/errors.js";
import { createAuthRouter } from "./routes/auth.js";
import { createAttendanceRouter } from "./routes/attendance.js";
import { createEmployeesRouter } from "./routes/employees.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createAiRouter } from "./routes/ai.js";
import { createAuditRouter } from "./routes/audit.js";
import { createSyncRouter } from "./routes/sync.js";
import { createPlatformRouter } from "./routes/platform.js";
import { createNotificationsRouter } from "./routes/notifications.js";
import { createRosterRouter } from "./routes/roster.js";
import { createReportsRouter } from "./routes/reports.js";
import { createSitesRouter } from "./routes/sites.js";
import { createTenantRouter } from "./routes/tenant.js";

interface AppDependencies {
  database: Pool;
  version?: string;
}

export const createApp = ({ database, version = "0.1.0" }: AppDependencies): Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp());

  app.get("/api/health", (_request, response) => {
    const body: HealthResponse = {
      service: "attendance-api",
      status: "ok",
      timestamp: new Date().toISOString(),
      version,
    };

    response.json(body);
  });

  app.get("/api/ready", async (_request, response) => {
    try {
      await checkDatabaseConnection(database);
      const body: ReadinessResponse = {
        service: "attendance-api",
        status: "ok",
        timestamp: new Date().toISOString(),
        version,
        checks: { database: "ok" },
      };
      response.json(body);
    } catch {
      const body: ReadinessResponse = {
        service: "attendance-api",
        status: "degraded",
        timestamp: new Date().toISOString(),
        version,
        checks: { database: "degraded" },
      };
      response.status(503).json(body);
    }
  });

  app.use("/api/auth", createAuthRouter(database));
  app.use("/api/platform", createPlatformRouter(database));
  app.use("/api/tenant", createTenantRouter(database));
  app.use("/api/employees", createEmployeesRouter(database));
  app.use("/api/sites", createSitesRouter(database));
  app.use("/api/roster", createRosterRouter(database));
  app.use("/api/notifications", createNotificationsRouter(database));
  app.use("/api/attendance", createAttendanceRouter(database));
  app.use("/api/reports", createReportsRouter(database));
  app.use("/api/dashboard", createDashboardRouter(database));
  app.use("/api/ai", createAiRouter(database));
  app.use("/api/audit", createAuditRouter(database));
  app.use("/api/sync", createSyncRouter(database));

  app.use((_request, response) => {
    response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.issues } });
      return;
    }
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
      return;
    }
    request.log.error({ err: error }, "Unhandled request error");
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  });

  return app;
};
