import { queryRead } from "./query.js";

export type NotificationItem = {
  id: string;
  user_id: string | null;
  type: string;
  created_at: string;
};

export async function listNotifications(params: {
  from: string;
  to: string;
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
  userId?: string | undefined;
  type?: string | undefined;
}): Promise<{ items: NotificationItem[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [params.from, params.to];
  const where: string[] = ["created_at >= $1", "created_at <= $2"];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
  }

  if (params.userId) {
    values.push(params.userId);
    where.push(`user_id = $${values.length}`);
  }

  if (params.type) {
    values.push(params.type);
    where.push(`type = $${values.length}`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<NotificationItem>(
    `select id, user_id, type, created_at
     from public.notifications
     where ${where.join(" and ")}
     order by created_at desc, id desc
     limit $${values.length}`,
    values
  );

  const sliced = rows.slice(0, params.limit);
  const last = sliced[sliced.length - 1];
  const nextCursor = rows.length > params.limit && last ? { createdAt: last.created_at, id: last.id } : null;
  return { items: sliced, nextCursor };
}

