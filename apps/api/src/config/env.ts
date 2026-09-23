import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default("postgresql://attendance:attendance@localhost:5432/attendance"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_HOURS: z.coerce.number().int().positive().default(24),
  COOKIE_SECURE: z.string().optional().transform((value) => value === "true"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(1).default("attendance-documents"),
  S3_ACCESS_KEY: z.string().min(1).default("attendance"),
  S3_SECRET_KEY: z.string().min(1).default("change-me"),
  S3_FORCE_PATH_STYLE: z.string().optional().transform((value) => value !== "false"),
  AI_INGESTION_KEY: z.string().optional().default(""),
});

export const env = environmentSchema.parse(process.env);
