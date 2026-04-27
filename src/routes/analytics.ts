import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { sendError, sendOk } from "../utils/http.js";
import { parseQuery } from "../utils/validate.js";
import { dateRangeSchema, normalizeAndValidateDateRange } from "../utils/dateRange.js";
import {
  getDashboardKpis,
  getDailyTransactionSeries,
  getFraudTypeBreakdown,
  getRiskDecisionDistribution
} from "../db/analytics.js";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/dashboard",
  requireAuth,
  requireRole(["super_admin", "analyst"]),
  async (req, res) => {
    try {
      const q = parseQuery(req, dateRangeSchema);
      const { from, to } = normalizeAndValidateDateRange(q);

      const [kpis, daily, riskDistribution, fraudTypes] = await Promise.all([
        getDashboardKpis({ from, to }),
        getDailyTransactionSeries({ from, to }),
        getRiskDecisionDistribution({ from, to }),
        getFraudTypeBreakdown({ from, to })
      ]);

      sendOk(res, { kpis, daily, riskDistribution, fraudTypes, range: { from, to } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
      const code = msg === "DATE_RANGE_TOO_LARGE" || msg === "INVALID_DATE_RANGE" ? msg : "BAD_REQUEST";
      sendError(res, 400, code, "Invalid analytics request");
    }
  }
);

