import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { sendError, sendOk } from "../utils/http.js";
import { parseBody, parseQuery } from "../utils/validate.js";
import { paginationSchema, decodeCursor, encodeCursor } from "../utils/pagination.js";
import { dateRangeSchema, normalizeAndValidateDateRange } from "../utils/dateRange.js";
import { listFlaggedReceivers, listHighRiskTransactions, setReceiverFlag } from "../db/fraud.js";

export const fraudRouter = Router();

fraudRouter.get("/high-risk", requireAuth, requireRole(["super_admin", "analyst"]), async (req, res) => {
  try {
    const q = parseQuery(req, paginationSchema.merge(dateRangeSchema));
    const cursor = decodeCursor(q.cursor);
    const { from, to } = normalizeAndValidateDateRange(q);

    const { items, nextCursor } = await listHighRiskTransactions({ from, to, limit: q.limit, cursor });
    sendOk(res, {
      items,
      page: { limit: q.limit, nextCursor: nextCursor ? encodeCursor(nextCursor) : null },
      range: { from, to }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const code = msg === "DATE_RANGE_TOO_LARGE" || msg === "INVALID_DATE_RANGE" ? msg : "BAD_REQUEST";
    sendError(res, 400, code, "Invalid fraud query");
  }
});

fraudRouter.get("/receivers/flagged", requireAuth, requireRole(["super_admin", "analyst"]), async (req, res) => {
  const q = parseQuery(req, paginationSchema);
  const cursor = decodeCursor(q.cursor);
  const { items, nextCursor } = await listFlaggedReceivers({ limit: q.limit, cursor });
  sendOk(res, { items, page: { limit: q.limit, nextCursor: nextCursor ? encodeCursor(nextCursor) : null } });
});

fraudRouter.post("/receivers/:id/flag", requireAuth, requireRole(["super_admin"]), async (req, res) => {
  try {
    const raw = req.params.id;
    const receiverId = Array.isArray(raw) ? raw[0] : raw;
    if (!receiverId || receiverId.length < 10) {
      sendError(res, 400, "BAD_REQUEST", "Invalid receiver id");
      return;
    }
    const body = parseBody(req, z.object({ flagged: z.boolean() }));
    await setReceiverFlag({ receiverId, flagged: body.flagged });
    sendOk(res, { receiverId, flagged: body.flagged });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const code = msg === "WRITE_POOL_NOT_CONFIGURED" ? msg : "BAD_REQUEST";
    const status = msg === "WRITE_POOL_NOT_CONFIGURED" ? 501 : 400;
    sendError(res, status, code, "Unable to update receiver flag");
  }
});
