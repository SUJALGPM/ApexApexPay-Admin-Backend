import type { QueryResultRow } from "pg";
import { readPool, writePool } from "./pools.js";

export async function queryRead<T extends QueryResultRow>(
  sql: string,
  params: unknown[]
): Promise<{ rows: T[] }> {
  const result = await readPool.query<T>(sql, params);
  return { rows: result.rows };
}

export async function queryWrite<T extends QueryResultRow>(
  sql: string,
  params: unknown[]
): Promise<{ rows: T[] }> {
  if (!writePool) {
    throw new Error("WRITE_POOL_NOT_CONFIGURED");
  }
  const result = await writePool.query<T>(sql, params);
  return { rows: result.rows };
}
