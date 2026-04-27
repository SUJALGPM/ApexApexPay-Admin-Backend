import { queryRead } from "./query.js";

export type TransactionListItem = {
  id: string;
  status: string;
  amount: string | null;
  created_at: string;
  sender_user_id: string | null;
  receiver_user_id: string | null;
  risk_score: number | null;
  decision: string | null;
  fraud_type: string | null;
};

export type TransactionDetail = {
  transaction: Record<string, unknown>;
  latestRisk: Record<string, unknown> | null;
  riskHistory: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
  sender: Record<string, unknown> | null;
  receiver: Record<string, unknown> | null;
};

const allowedStatuses = new Set([
  "REQUESTED",
  "HOLD",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "RECOVERED"
]);

const allowedDecisions = new Set(["LOW", "MEDIUM", "HIGH"]);

export async function listTransactions(params: {
  from: string;
  to: string;
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
  status?: string | undefined;
  decision?: string | undefined;
  fraudType?: string | undefined;
  minRiskScore?: number | undefined;
  maxRiskScore?: number | undefined;
}): Promise<{ items: TransactionListItem[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [params.from, params.to];
  const where: string[] = ["t.created_at >= $1", "t.created_at <= $2"];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(t.created_at, t.id) < ($${values.length - 1}, $${values.length})`);
  }

  if (params.status) {
    if (!allowedStatuses.has(params.status)) throw new Error("INVALID_FILTER_STATUS");
    values.push(params.status);
    where.push(`t.status = $${values.length}`);
  }

  if (params.decision) {
    if (!allowedDecisions.has(params.decision)) throw new Error("INVALID_FILTER_DECISION");
    values.push(params.decision);
    where.push(`lr.decision = $${values.length}`);
  }

  if (params.fraudType) {
    values.push(params.fraudType);
    where.push(`lr.fraud_type = $${values.length}`);
  }

  if (typeof params.minRiskScore === "number") {
    values.push(params.minRiskScore);
    where.push(`lr.risk_score >= $${values.length}`);
  }

  if (typeof params.maxRiskScore === "number") {
    values.push(params.maxRiskScore);
    where.push(`lr.risk_score <= $${values.length}`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<TransactionListItem>(
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
       t.id,
       t.status,
       t.amount::text as amount,
       t.created_at,
       t.sender_user_id,
       t.receiver_user_id,
       lr.risk_score,
       lr.decision,
       lr.fraud_type
     from public.transactions t
     left join latest_risk lr on lr.txn_id = t.id
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by t.created_at desc, t.id desc
     limit $${values.length}`,
    values
  );

  const sliced = rows.slice(0, params.limit);
  const last = sliced[sliced.length - 1];
  const nextCursor = rows.length > params.limit && last ? { createdAt: last.created_at, id: last.id } : null;
  return { items: sliced, nextCursor };
}

export async function getTransactionDetail(txnId: string): Promise<TransactionDetail | null> {
  const { rows: txnRows } = await queryRead<Record<string, unknown>>(
    `select t.* from public.transactions t where t.id = $1 limit 1`,
    [txnId]
  );
  const transaction = txnRows[0];
  if (!transaction) return null;

  const { rows: latestRiskRows } = await queryRead<Record<string, unknown>>(
    `select rs.* from public.risk_scores rs where rs.txn_id = $1 order by rs.created_at desc limit 1`,
    [txnId]
  );

  const { rows: riskHistory } = await queryRead<Record<string, unknown>>(
    `select rs.* from public.risk_scores rs where rs.txn_id = $1 order by rs.created_at desc limit 50`,
    [txnId]
  );

  const { rows: auditLogs } = await queryRead<Record<string, unknown>>(
    `select al.* from public.audit_logs al where al.txn_id = $1 order by al.created_at desc limit 200`,
    [txnId]
  );

  const { rows: senderRows } = await queryRead<Record<string, unknown>>(
    `select u.* from public.users u
     join public.transactions t on t.sender_user_id = u.id
     where t.id = $1
     limit 1`,
    [txnId]
  );

  const { rows: receiverUserRows } = await queryRead<Record<string, unknown>>(
    `select u.* from public.users u
     join public.transactions t on t.receiver_user_id = u.id
     where t.id = $1
     limit 1`,
    [txnId]
  );

  const { rows: receiverProfileRows } = await queryRead<Record<string, unknown>>(
    `select rp.* from public.receiver_profiles rp
     join public.transactions t on t.receiver_user_id = rp.receiver_user_id
     where t.id = $1
     limit 1`,
    [txnId]
  );

  return {
    transaction,
    latestRisk: latestRiskRows[0] ?? null,
    riskHistory,
    auditLogs,
    sender: senderRows[0] ?? null,
    receiver: receiverUserRows[0] ? { user: receiverUserRows[0], profile: receiverProfileRows[0] ?? null } : null
  };
}
