import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";

const payloadSchema = z.object({
  adminId: z.string().uuid(),
  role: z.enum(["super_admin", "analyst", "support"]),
  email: z.string().email()
});

export type JwtPayload = z.infer<typeof payloadSchema>;

export function signAdminToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS
  });
}

export function verifyAdminToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  });
  return payloadSchema.parse(decoded);
}
