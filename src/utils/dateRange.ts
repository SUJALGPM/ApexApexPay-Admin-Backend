import { z } from "zod";

const maxRangeDays = 90;

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

export function normalizeAndValidateDateRange(input: {
  from?: string | undefined;
  to?: string | undefined;
}): { from: string; to: string } {
  const now = new Date();
  const to = input.to ? new Date(input.to) : now;
  const from = input.from ? new Date(input.from) : new Date(to.getTime() - 1000 * 60 * 60 * 24 * 7);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("INVALID_DATE_RANGE");
  }
  if (from > to) {
    throw new Error("INVALID_DATE_RANGE");
  }

  const ms = to.getTime() - from.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days > maxRangeDays) {
    throw new Error("DATE_RANGE_TOO_LARGE");
  }

  return { from: from.toISOString(), to: to.toISOString() };
}
