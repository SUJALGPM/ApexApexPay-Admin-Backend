import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { sendError, sendOk } from "../utils/http.js";
import { parseQuery } from "../utils/validate.js";
import { paginationSchema, decodeCursor, encodeCursor } from "../utils/pagination.js";
import { dateRangeSchema, normalizeAndValidateDateRange } from "../utils/dateRange.js";
import { listNotifications } from "../db/notifications.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, requireRole(["super_admin", "support"]), async (req, res) => {
  try {
    const q = parseQuery(
      req,
      paginationSchema
        .merge(dateRangeSchema)
        .merge(z.object({ user_id: z.string().max(80).optional(), type: z.string().max(80).optional() }))
    );
    const cursor = decodeCursor(q.cursor);
    const { from, to } = normalizeAndValidateDateRange(q);

    const { items, nextCursor } = await listNotifications({
      from,
      to,
      limit: q.limit,
      cursor,
      userId: q.user_id,
      type: q.type
    });

    sendOk(res, {
      items,
      page: { limit: q.limit, nextCursor: nextCursor ? encodeCursor(nextCursor) : null },
      range: { from, to }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const code = msg === "DATE_RANGE_TOO_LARGE" || msg === "INVALID_DATE_RANGE" ? msg : "BAD_REQUEST";
    sendError(res, 400, code, "Invalid notifications query");
  }
});
