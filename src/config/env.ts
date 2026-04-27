import "dotenv/config";
import { z } from "zod";

const nodeEnv = (process.env.NODE_ENV ?? "development") as "development" | "test" | "production";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.preprocess(
    (v) => (typeof v === "string" && v.trim().length > 0 ? v : "http://localhost:3000"),
    z.string().min(1)
  ),

  DATABASE_URL_READONLY: z.preprocess(
    (v) => (typeof v === "string" && v.trim().length > 0 ? v : process.env.DATABASE_URL),
    z.string().min(1)
  ),
  DATABASE_URL_WRITE: z.string().optional().default(""),

  ADMIN_SETUP_TOKEN: z.string().optional().default(""),

  JWT_ISSUER: z.string().min(1).default("apexpay-admin"),
  JWT_AUDIENCE: z.string().min(1).default("apexpay-admin-frontend"),
  JWT_SECRET: z.preprocess(
    (v) => {
      if (typeof v === "string" && v.trim().length > 0) return v;
      if (nodeEnv !== "production") return "dev_jwt_secret_change_me_to_64_chars_minimum__________";
      return v;
    },
    z.string().min(32)
  ),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),

  COOKIE_NAME: z.string().min(1).default("apexpay_admin_token"),
  COOKIE_DOMAIN: z.string().optional().default(""),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),

  LOG_LEVEL: z.string().min(1).default("info")
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
