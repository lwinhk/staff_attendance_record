import type { Pool } from "@attendance/database";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { ApiError } from "../lib/errors.js";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "../lib/security.js";
import { authenticate, SESSION_COOKIE } from "../middleware/auth.js";
import { loginRateLimit,resetLoginRateLimit } from "../middleware/rate-limit.js";
import { createSession, deleteSession, findUserByIdentifier } from "../repositories/auth-repository.js";

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(200),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
  path: "/",
};

export const createAuthRouter = (database: Pool): Router => {
  const router = Router();

  router.post("/login", loginRateLimit, async (request, response, next) => {
    try {
      const input = loginSchema.parse(request.body);
      const user = await findUserByIdentifier(database, input.identifier);
      if (!user || !(await verifyPassword(input.password, user.password_hash))) {
        throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email, phone, or password");
      }
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + env.SESSION_HOURS * 60 * 60 * 1000);
      await createSession(database, hashSessionToken(token), user.id, expiresAt);
      resetLoginRateLimit(request);
      response.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
      response.json({ userId: user.id });
    } catch (error) { next(error); }
  });

  router.get("/me", authenticate(database), (request, response) => response.json({ user: request.auth }));

  router.post("/logout", authenticate(database), async (request, response, next) => {
    try {
      await deleteSession(database, request.sessionTokenHash!);
      response.clearCookie(SESSION_COOKIE, cookieOptions).status(204).send();
    } catch (error) { next(error); }
  });

  router.post("/change-password", authenticate(database), async (request, response, next) => {
    try {
      const input = passwordSchema.parse(request.body);
      const identifier = request.auth!.email ?? request.auth!.phone!;
      const user = await findUserByIdentifier(database, identifier);
      if (!user || !(await verifyPassword(input.currentPassword, user.password_hash))) {
        throw new ApiError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
      }
      const newHash = await hashPassword(input.newPassword);
      await database.query("update users set password_hash = $1, password_changed_at = now(), updated_at = now() where id = $2", [newHash, user.id]);
      await database.query("delete from sessions where user_id = $1 and token_hash <> $2", [user.id, request.sessionTokenHash]);
      response.status(204).send();
    } catch (error) { next(error); }
  });

  return router;
};
