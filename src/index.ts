import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { sendError } from "./utils/http.js";
import { authRouter } from "./routes/auth.js";
import { analyticsRouter } from "./routes/analytics.js";
import { transactionsRouter } from "./routes/transactions.js";
import { usersRouter } from "./routes/users.js";
import { fraudRouter } from "./routes/fraud.js";
import { auditLogsRouter } from "./routes/auditLogs.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adminsRouter } from "./routes/admins.js";
import { healthRouter } from "./routes/health.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());

const allowedOrigins = (() => {
  const raw = env.FRONTEND_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  const devExtras = env.NODE_ENV === "development" ? ["http://localhost:3001"] : [];
  return Array.from(new Set([...raw, ...devExtras]));
})();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS_NOT_ALLOWED"));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(pinoHttp({ logger }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/users", usersRouter);
app.use("/api/fraud", fraudRouter);
app.use("/api/audit-logs", auditLogsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admins", adminsRouter);

app.use((req, res) => {
  sendError(res, 404, "NOT_FOUND", "Not found");
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    sendError(res, 500, "INTERNAL_ERROR", "Unexpected server error");
  }
  next(err);
});

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "Admin backend listening");
});
