import type { AuthenticatedUser, UserRole } from "@attendance/contracts";
import type { Pool } from "@attendance/database";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/errors.js";
import { hashSessionToken } from "../lib/security.js";
import { findUserBySession } from "../repositories/auth-repository.js";

export const SESSION_COOKIE = "attendance_session";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
      sessionTokenHash?: string;
    }
  }
}

export const authenticate = (database: Pool) => async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = request.cookies[SESSION_COOKIE] as string | undefined;
    if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Authentication required");
    const tokenHash = hashSessionToken(token);
    const user = await findUserBySession(database, tokenHash);
    if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Session is invalid or expired");
    request.auth = user;
    request.sessionTokenHash = tokenHash;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: UserRole[]) => (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  if (!request.auth) return next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
  if (!roles.includes(request.auth.role)) return next(new ApiError(403, "FORBIDDEN", "Insufficient permission"));
  next();
};

export const requireTenant = (request: Request): string => {
  if (!request.auth?.tenantId) throw new ApiError(403, "TENANT_REQUIRED", "Tenant context required");
  return request.auth.tenantId;
};
