import { queryRead } from "./query.js";

export type AuditLogItem = {
  id: string;
  txn_id: string | null;
  action: string;
  created_at: string;
};

export async function listAuditLogs(params: {
  from: string;
  to: string;
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
  txnId?: string | undefined;
  action?: string | undefined;
}): Promise<{ items: AuditLogItem[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [params.from, params.to];
  const where: string[] = ["created_at >= $1", "created_at <= $2"];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
  }

  if (params.txnId) {
    values.push(params.txnId);
    where.push(`txn_id = $${values.length}`);
  }

  if (params.action) {
    values.push(params.action);
    where.push(`action = $${values.length}`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<AuditLogItem>(
    `select id, txn_id, action, created_at
     from public.audit_logs
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

