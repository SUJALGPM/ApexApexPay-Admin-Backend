import type { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/http.js";

type Role = "super_admin" | "analyst" | "support";

export function requireRole(allowed: readonly Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.admin?.role;
    if (!role) {
      sendError(res, 401, "UNAUTHORIZED", "Missing authentication");
      return;
    }
    if (!allowed.includes(role)) {
      sendError(res, 403, "FORBIDDEN", "Insufficient permissions");
      return;
    }
    next();
  };
}

