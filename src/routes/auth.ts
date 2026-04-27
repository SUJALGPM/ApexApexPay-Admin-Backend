import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { countAdmins, createAdmin, getAdminByEmail } from "../db/admins.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAdminToken } from "../auth/jwt.js";
import { env } from "../config/env.js";
import { sendError, sendOk } from "../utils/http.js";
import { requireAuth } from "../middleware/auth.js";
import { parseBody } from "../utils/validate.js";

export const authRouter = Router();

async function getSetupStatus() {
  console.log("[auth.setup] checking admin count");
  const count = await countAdmins();
  console.log("[auth.setup] admin count =", count);
  return { canSetup: count === 0, count };
}

async function handleSetup(req: Request, res: Response) {
  try {
    if (!env.ADMIN_SETUP_TOKEN || env.ADMIN_SETUP_TOKEN.trim().length === 0) {
      sendError(res, 501, "SETUP_DISABLED", "Setup is disabled");
      return;
    }

    const { count } = await getSetupStatus();
    if (count > 0) {
      sendError(res, 409, "ADMIN_ALREADY_EXISTS", "Admin already exists");
      return;
    }

    const body = parseBody(
      req,
      z.object({
        email: z.string().email(),
        password: z.string().min(12).max(200),
        setup_token: z.string().min(8).max(200)
      })
    );

    if (body.setup_token !== env.ADMIN_SETUP_TOKEN) {
      console.log("[auth.setup] invalid setup token for email", body.email.toLowerCase());
      sendError(res, 403, "FORBIDDEN", "Invalid setup token");
      return;
    }

    console.log("[auth.setup] inserting first super_admin", body.email.toLowerCase());
    const admin = await createAdmin({
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      role: "super_admin"
    });

    sendOk(res, { admin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const status = msg === "WRITE_POOL_NOT_CONFIGURED" ? 501 : 400;
    const code = msg === "WRITE_POOL_NOT_CONFIGURED" ? msg : "BAD_REQUEST";
    sendError(res, status, code, "Unable to setup admin");
  }
}

authRouter.get("/setup-status", async (req, res) => {
  const status = await getSetupStatus();
  sendOk(res, { canSetup: status.canSetup });
});

authRouter.post("/setup", async (req, res) => {
  await handleSetup(req, res);
});

authRouter.get("/bootstrap-status", async (req, res) => {
  const status = await getSetupStatus();
  sendOk(res, { canBootstrap: status.canSetup });
});

authRouter.post("/bootstrap", async (req, res) => {
  await handleSetup(req, res);
});

authRouter.post("/login", async (req, res) => {
  const body = parseBody(
    req,
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(200)
    })
  );

  const admin = await getAdminByEmail(body.email.toLowerCase());
  if (!admin) {
    console.log("[auth.login] admin not found for email", body.email.toLowerCase());
    sendError(res, 404, "ADMIN_NOT_FOUND", "Admin not found");
    return;
  }

  const ok = await verifyPassword(body.password, admin.password_hash);
  if (!ok) {
    console.log("[auth.login] invalid credentials for admin", admin.id);
    sendError(res, 401, "INVALID_CREDENTIALS", "Invalid credentials");
    return;
  }

  const token = signAdminToken({ adminId: admin.id, role: admin.role, email: admin.email });

  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000
  });

  sendOk(res, { admin: { id: admin.id, email: admin.email, role: admin.role } });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/"
  });
  sendOk(res, { loggedOut: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  sendOk(res, { admin: req.admin });
});
