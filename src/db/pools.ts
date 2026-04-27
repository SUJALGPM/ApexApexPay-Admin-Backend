import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const readPool = new Pool({
  connectionString: env.DATABASE_URL_READONLY,
  max: 10,
  idleTimeoutMillis: 30_000
});

export const writePool =
  env.DATABASE_URL_WRITE && env.DATABASE_URL_WRITE.trim().length > 0
    ? new Pool({
        connectionString: env.DATABASE_URL_WRITE,
        max: 5,
        idleTimeoutMillis: 30_000
      })
    : null;

export async function closePools(): Promise<void> {
  await readPool.end();
  if (writePool) await writePool.end();
}
