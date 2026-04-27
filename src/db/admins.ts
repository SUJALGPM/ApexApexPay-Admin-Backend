import { queryRead, queryWrite } from "./query.js";

export type AdminRole = "super_admin" | "analyst" | "support";

export type AdminRow = {
  id: string;
  email: string;
  role: AdminRole;
  created_at: string;
};

export type AdminAuthRow = {
  id: string;
  email: string;
  role: AdminRole;
  password_hash: string;
};

export async function getAdminByEmail(email: string): Promise<AdminAuthRow | null> {
  const { rows } = await queryRead<AdminAuthRow>(
    `select id, email, role, password_hash
     from public.admins
     where email = $1
     limit 1`,
    [email]
  );
  return rows[0] ?? null;
}

export async function countAdmins(): Promise<number> {
  const { rows } = await queryRead<{ count: string }>(`select count(*)::text as count from public.admins`, []);
  const c = rows[0]?.count ?? "0";
  return Number(c);
}

export async function listAdmins(params: {
  limit: number;
  cursor?: { createdAt: string; id: string } | null;
}): Promise<{ items: AdminRow[]; nextCursor: { createdAt: string; id: string } | null }> {
  const values: unknown[] = [];
  const where: string[] = [];

  if (params.cursor) {
    values.push(params.cursor.createdAt, params.cursor.id);
    where.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
  }

  values.push(params.limit + 1);

  const { rows } = await queryRead<AdminRow>(
    `select id, email, role, created_at
     from public.admins
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

export async function createAdmin(input: {
  email: string;
  passwordHash: string;
  role: AdminRole;
}): Promise<AdminRow> {
  const { rows } = await queryWrite<AdminRow>(
    `insert into public.admins (email, password_hash, role)
     values ($1, $2, $3)
     returning id, email, role, created_at`,
    [input.email, input.passwordHash, input.role]
  );
  const row = rows[0];
  if (!row) throw new Error("FAILED_TO_CREATE_ADMIN");
  return row;
}
