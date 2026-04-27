import { queryRead } from "./query.js";

export type UserListItem = {
  id: string;
  full_name: string | null;
  mobile_number: string | null;
  created_at: string;
};

export async function listUsers(params: {
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
}): Promise<{ items: UserListItem[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [];
  const where: string[] = [];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<UserListItem>(
    `select id, full_name, mobile_number, created_at
     from public.users
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by created_at desc, id desc
     limit $${values.length}`,
    values
  );

  const sliced = rows.slice(0, params.limit);
  const last = sliced[sliced.length - 1];
  const nextCursor = rows.length > params.limit && last ? { createdAt: last.created_at, id: last.id } : null;
  return { items: sliced, nextCursor };
}

export async function getUserDetail(userId: string): Promise<{
  user: Record<string, unknown>;
  accounts: Record<string, unknown>[];
  vpas: Record<string, unknown>[];
} | null> {
  const { rows: userRows } = await queryRead<Record<string, unknown>>(
    `select u.* from public.users u where u.id = $1 limit 1`,
    [userId]
  );
  const user = userRows[0];
  if (!user) return null;

  const { rows: accounts } = await queryRead<Record<string, unknown>>(
    `select a.* from public.accounts a where a.user_id = $1 order by a.created_at desc limit 200`,
    [userId]
  );

  const { rows: vpas } = await queryRead<Record<string, unknown>>(
    `select v.* from public.vpas v where v.user_id = $1 order by v.created_at desc limit 200`,
    [userId]
  );

  return { user, accounts, vpas };
}

export async function listUserTransactions(params: {
  userId: string;
  from: string;
  to: string;
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
}): Promise<{ items: Record<string, unknown>[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [params.userId, params.from, params.to];
  const where: string[] = ["(t.sender_user_id = $1 or t.receiver_user_id = $1)", "t.created_at >= $2", "t.created_at <= $3"];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(t.created_at, t.id) < ($${values.length - 1}, $${values.length})`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<Record<string, unknown>>(
    `select t.*
     from public.transactions t
     where ${where.join(" and ")}
     order by t.created_at desc, t.id desc
     limit $${values.length}`,
    values
  );

  const sliced = rows.slice(0, params.limit);
  const last = sliced[sliced.length - 1] as { created_at?: unknown; id?: unknown } | undefined;
  const nextCursor =
    rows.length > params.limit && last && typeof last.created_at === "string" && typeof last.id === "string"
      ? { createdAt: last.created_at, id: last.id }
      : null;
  return { items: sliced, nextCursor };
}
