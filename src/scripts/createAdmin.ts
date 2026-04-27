import { z } from "zod";
import { env } from "../config/env.js";
import { createAdmin } from "../db/admins.js";
import { hashPassword } from "../auth/password.js";

async function main() {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(12).max(200),
    role: z.enum(["super_admin", "analyst", "support"]).default("super_admin")
  });

  const parsed = schema.parse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: process.env.ADMIN_ROLE
  });

  if (!env.DATABASE_URL_WRITE || env.DATABASE_URL_WRITE.trim().length === 0) {
    throw new Error("DATABASE_URL_WRITE_REQUIRED");
  }

  const admin = await createAdmin({
    email: parsed.email.toLowerCase(),
    passwordHash: await hashPassword(parsed.password),
    role: parsed.role
  });

  process.stdout.write(JSON.stringify({ admin }, null, 2) + "\n");
}

main().catch((e) => {
  process.stderr.write((e instanceof Error ? e.message : "UNKNOWN_ERROR") + "\n");
  process.exit(1);
});

