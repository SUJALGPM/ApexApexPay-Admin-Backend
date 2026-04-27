import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { sendError, sendOk } from "../utils/http.js";
import { parseQuery } from "../utils/validate.js";
import { paginationSchema, decodeCursor, encodeCursor } from "../utils/pagination.js";
import { dateRangeSchema, normalizeAndValidateDateRange } from "../utils/dateRange.js";
import { listTransactions, getTransactionDetail } from "../db/transactions.js";

export const transactionsRouter = Router();

transactionsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const q = parseQuery(
      req,
      paginationSchema
        .merge(dateRangeSchema)
        .merge(
          z.object({
            status: z.string().max(20).optional(),
            decision: z.string().max(10).optional(),
            fraud_type: z.string().max(100).optional(),
            min_risk_score: z.coerce.number().optional(),
            max_risk_score: z.coerce.number().optional()
          })
        )
    );

    const cursor = decodeCursor(q.cursor);
    const { from, to } = normalizeAndValidateDateRange(q);

    const { items, nextCursor } = await listTransactions({
      from,
      to,
      limit: q.limit,
      cursor,
      status: q.status,
      decision: q.decision,
      fraudType: q.fraud_type,
      minRiskScore: q.min_risk_score,
      maxRiskScore: q.max_risk_score
    });

    sendOk(res, {
      items,
      page: { limit: q.limit, nextCursor: nextCursor ? encodeCursor(nextCursor) : null },
      range: { from, to }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const code =
      msg === "DATE_RANGE_TOO_LARGE" ||
      msg === "INVALID_DATE_RANGE" ||
      msg === "INVALID_FILTER_STATUS" ||
      msg === "INVALID_FILTER_DECISION"
        ? msg
        : "BAD_REQUEST";
    sendError(res, 400, code, "Invalid transactions query");
  }
});

transactionsRouter.get("/:id", requireAuth, async (req, res) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || id.length < 10) {
    sendError(res, 400, "BAD_REQUEST", "Invalid transaction id");
    return;
  }

  const detail = await getTransactionDetail(id);
  if (!detail) {
    sendError(res, 404, "NOT_FOUND", "Transaction not found");
    return;
  }

  sendOk(res, detail);
});
