import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { sendError, sendOk } from "../utils/http.js";
import { parseQuery } from "../utils/validate.js";
import { paginationSchema, decodeCursor, encodeCursor } from "../utils/pagination.js";
import { dateRangeSchema, normalizeAndValidateDateRange } from "../utils/dateRange.js";
import { getUserDetail, listUsers, listUserTransactions } from "../db/users.js";

export const usersRouter = Router();

usersRouter.get("/", requireAuth, requireRole(["super_admin", "support"]), async (req, res) => {
  const q = parseQuery(req, paginationSchema);
  const cursor = decodeCursor(q.cursor);
  const { items, nextCursor } = await listUsers({ limit: q.limit, cursor });
  sendOk(res, { items, page: { limit: q.limit, nextCursor: nextCursor ? encodeCursor(nextCursor) : null } });
});

usersRouter.get("/:id", requireAuth, requireRole(["super_admin", "support"]), async (req, res) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || id.length < 10) {
    sendError(res, 400, "BAD_REQUEST", "Invalid user id");
    return;
  }
  const detail = await getUserDetail(id);
  if (!detail) {
    sendError(res, 404, "NOT_FOUND", "User not found");
    return;
  }
  sendOk(res, detail);
});

usersRouter.get(
  "/:id/transactions",
  requireAuth,
  requireRole(["super_admin", "support"]),
  async (req, res) => {
    try {
      const raw = req.params.id;
      const userId = Array.isArray(raw) ? raw[0] : raw;
      if (!userId || userId.length < 10) {
        sendError(res, 400, "BAD_REQUEST", "Invalid user id");
        return;
      }
      const q = parseQuery(req, paginationSchema.merge(dateRangeSchema));
      const cursor = decodeCursor(q.cursor);
      const { from, to } = normalizeAndValidateDateRange(q);

      const { items, nextCursor } = await listUserTransactions({ userId, from, to, limit: q.limit, cursor });
      sendOk(res, {
        items,
        page: { limit: q.limit, nextCursor: nextCursor ? encodeCursor(nextCursor) : null },
        range: { from, to }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
      const code = msg === "DATE_RANGE_TOO_LARGE" || msg === "INVALID_DATE_RANGE" ? msg : "BAD_REQUEST";
      sendError(res, 400, code, "Invalid request");
    }
  }
);
