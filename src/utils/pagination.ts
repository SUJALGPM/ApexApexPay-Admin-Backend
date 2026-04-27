import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional()
});

export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string): Cursor | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as unknown;
    const schema = z.object({ createdAt: z.string().min(1), id: z.string().min(1) });
    return schema.parse(parsed);
  } catch {
    return null;
  }
}
