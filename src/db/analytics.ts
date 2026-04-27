import { queryRead } from "./query.js";

export type DashboardKpis = {
  totalTransactions: number;
  statusBreakdown: Record<string, number>;
  fraudRate: number;
  holdRate: number;
  recoveryCount: number;
};

export type DailySeriesPoint = {
  day: string;
  total: number;
  highRisk: number;
};

export type RiskDistributionPoint = {
  decision: string;
  count: number;
};

export type FraudTypePoint = {
  fraud_type: string;
  count: number;
};

export async function getDashboardKpis(params: {
  from: string;
  to: string;
}): Promise<DashboardKpis> {
  const { rows } = await queryRead<{
    total: string;
    requested: string;
    hold: string;
    approved: string;
    completed: string;
    failed: string;
    recovered: string;
    high_risk: string;
  }>(
    `with latest_risk as (
       select distinct on (rs.txn_id)
         rs.txn_id,
         rs.decision
       from public.risk_scores rs
       order by rs.txn_id, rs.created_at desc
     )
     select
       count(*)::text as total,
       count(*) filter (where t.status = 'REQUESTED')::text as requested,
       count(*) filter (where t.status = 'HOLD')::text as hold,
       count(*) filter (where t.status = 'APPROVED')::text as approved,
       count(*) filter (where t.status = 'COMPLETED')::text as completed,
       count(*) filter (where t.status = 'FAILED')::text as failed,
       count(*) filter (where t.status = 'RECOVERED')::text as recovered,
       count(*) filter (where lr.decision = 'HIGH')::text as high_risk
     from public.transactions t
     left join latest_risk lr on lr.txn_id = t.id
     where t.created_at >= $1 and t.created_at <= $2`,
    [params.from, params.to]
  );

  const r = rows[0] ?? {
    total: "0",
    requested: "0",
    hold: "0",
    approved: "0",
    completed: "0",
    failed: "0",
    recovered: "0",
    high_risk: "0"
  };

  const total = Number(r.total);
  const hold = Number(r.hold);
  const recovered = Number(r.recovered);
  const highRisk = Number(r.high_risk);

  const fraudRate = total > 0 ? highRisk / total : 0;
  const holdRate = total > 0 ? hold / total : 0;

  return {
    totalTransactions: total,
    statusBreakdown: {
      REQUESTED: Number(r.requested),
      HOLD: hold,
      APPROVED: Number(r.approved),
      COMPLETED: Number(r.completed),
      FAILED: Number(r.failed),
      RECOVERED: recovered
    },
    fraudRate,
    holdRate,
    recoveryCount: recovered
  };
}

export async function getDailyTransactionSeries(params: {
  from: string;
  to: string;
}): Promise<DailySeriesPoint[]> {
  const { rows } = await queryRead<{
    day: string;
    total: string;
    high_risk: string;
  }>(
    `with latest_risk as (
       select distinct on (rs.txn_id)
         rs.txn_id,
         rs.decision
       from public.risk_scores rs
       order by rs.txn_id, rs.created_at desc
     )
     select
       date_trunc('day', t.created_at)::date::text as day,
       count(*)::text as total,
       count(*) filter (where lr.decision = 'HIGH')::text as high_risk
     from public.transactions t
     left join latest_risk lr on lr.txn_id = t.id
     where t.created_at >= $1 and t.created_at <= $2
     group by 1
     order by 1 asc`,
    [params.from, params.to]
  );

  return rows.map((r) => ({
    day: r.day,
    total: Number(r.total),
    highRisk: Number(r.high_risk)
  }));
}

export async function getRiskDecisionDistribution(params: {
  from: string;
  to: string;
}): Promise<RiskDistributionPoint[]> {
  const { rows } = await queryRead<{ decision: string | null; count: string }>(
    `with latest_risk as (
       select distinct on (rs.txn_id)
         rs.txn_id,
         rs.decision
       from public.risk_scores rs
       order by rs.txn_id, rs.created_at desc
     )
     select
       coalesce(lr.decision, 'UNKNOWN') as decision,
       count(*)::text as count
     from public.transactions t
     left join latest_risk lr on lr.txn_id = t.id
     where t.created_at >= $1 and t.created_at <= $2
     group by 1
     order by count(*) desc`,
    [params.from, params.to]
  );
  return rows.map((r) => ({ decision: r.decision ?? "UNKNOWN", count: Number(r.count) }));
}

export async function getFraudTypeBreakdown(params: {
  from: string;
  to: string;
}): Promise<FraudTypePoint[]> {
  const { rows } = await queryRead<{ fraud_type: string | null; count: string }>(
    `with latest_risk as (
       select distinct on (rs.txn_id)
         rs.txn_id,
         rs.fraud_type
       from public.risk_scores rs
       order by rs.txn_id, rs.created_at desc
     )
     select
       coalesce(lr.fraud_type, 'UNKNOWN') as fraud_type,
       count(*)::text as count
     from public.transactions t
     left join latest_risk lr on lr.txn_id = t.id
     where t.created_at >= $1 and t.created_at <= $2
     group by 1
     order by count(*) desc`,
    [params.from, params.to]
  );
  return rows.map((r) => ({ fraud_type: r.fraud_type ?? "UNKNOWN", count: Number(r.count) }));
}

