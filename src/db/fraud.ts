import { queryRead, queryWrite } from "./query.js";

export async function listHighRiskTransactions(params: {
  from: string;
  to: string;
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
}): Promise<{ items: Record<string, unknown>[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [params.from, params.to];
  const where: string[] = ["t.created_at >= $1", "t.created_at <= $2", "lr.decision = 'HIGH'"];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(t.created_at, t.id) < ($${values.length - 1}, $${values.length})`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<Record<string, unknown>>(
    `with latest_risk as (
       select distinct on (rs.txn_id)
         rs.txn_id,
         rs.risk_score,
         rs.decision,
         rs.fraud_type
       from public.risk_scores rs
       order by rs.txn_id, rs.created_at desc
     )
     select
       t.*,
       lr.risk_score,
       lr.decision,
       lr.fraud_type
     from public.transactions t
     join latest_risk lr on lr.txn_id = t.id
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

export async function listFlaggedReceivers(params: {
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
}): Promise<{ items: Record<string, unknown>[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [];
  const where: string[] = ["flagged = true"];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(updated_at, receiver_user_id) < ($${values.length - 1}, $${values.length})`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<Record<string, unknown>>(
    `select rp.*
     from public.receiver_profiles rp
     where ${where.join(" and ")}
     order by rp.updated_at desc, rp.receiver_user_id desc
     limit $${values.length}`,
    values
  );

  const sliced = rows.slice(0, params.limit);
  const last = sliced[sliced.length - 1] as { updated_at?: unknown; receiver_user_id?: unknown } | undefined;
  const nextCursor =
    rows.length > params.limit && last && typeof last.updated_at === "string" && typeof last.receiver_user_id === "string"
      ? { createdAt: last.updated_at, id: last.receiver_user_id }
      : null;
  return { items: sliced, nextCursor };
}

export async function setReceiverFlag(params: { receiverId: string; flagged: boolean }): Promise<void> {
  await queryWrite(
    `insert into public.receiver_profiles (receiver_user_id, flagged, updated_at)
     values ($1, $2, now())
     on conflict (receiver_user_id)
     do update set flagged = excluded.flagged, updated_at = now()`,
    [params.receiverId, params.flagged]
  );
}
