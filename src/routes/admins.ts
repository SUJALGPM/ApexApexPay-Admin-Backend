import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { createAdmin, listAdmins } from "../db/admins.js";
import { hashPassword } from "../auth/password.js";
import { sendError, sendOk } from "../utils/http.js";
import { parseBody, parseQuery } from "../utils/validate.js";
import { decodeCursor, encodeCursor, paginationSchema } from "../utils/pagination.js";

export const adminsRouter = Router();

adminsRouter.get("/", requireAuth, requireRole(["super_admin"]), async (req, res) => {
  const q = parseQuery(req, paginationSchema);
  const cursor = decodeCursor(q.cursor);
  const { items, nextCursor } = await listAdmins({ limit: q.limit, cursor });
  sendOk(res, { items, page: { limit: q.limit, nextCursor: nextCursor ? encodeCursor(nextCursor) : null } });
});

adminsRouter.post("/", requireAuth, requireRole(["super_admin"]), async (req, res) => {
  try {
    const body = parseBody(
      req,
      z.object({
        email: z.string().email(),
        password: z.string().min(12).max(200),
        role: z.enum(["super_admin", "analyst", "support"])
      })
    );

    const email = body.email.toLowerCase();
    const passwordHash = await hashPassword(body.password);

    const created = await createAdmin({ email, passwordHash, role: body.role });
    sendOk(res, { admin: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const status = msg === "WRITE_POOL_NOT_CONFIGURED" ? 501 : 400;
    const code = msg === "WRITE_POOL_NOT_CONFIGURED" ? msg : "BAD_REQUEST";
    sendError(res, status, code, "Unable to create admin");
  }
});

