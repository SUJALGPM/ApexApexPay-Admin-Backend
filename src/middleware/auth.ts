import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { verifyAdminToken } from "../auth/jwt.js";
import { sendError } from "../utils/http.js";

export type AuthenticatedAdmin = {
  adminId: string;
  email: string;
  role: "super_admin" | "analyst" | "support";
};

declare module "express-serve-static-core" {
  interface Request {
    admin?: AuthenticatedAdmin;
  }
}

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[env.COOKIE_NAME] as string | undefined;
  if (cookieToken && cookieToken.length > 0) return cookieToken;

  const header = req.header("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token) return null;
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    sendError(res, 401, "UNAUTHORIZED", "Missing authentication token");
    return;
  }

  try {
    const payload = verifyAdminToken(token);
    req.admin = { adminId: payload.adminId, email: payload.email, role: payload.role };
    next();
  } catch {
    console.log("[auth] invalid token", { path: req.path, ip: req.ip });
    sendError(res, 401, "UNAUTHORIZED", "Invalid or expired token");
  }
}
