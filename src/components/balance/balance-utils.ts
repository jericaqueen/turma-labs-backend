export const PHP = (n: number) =>
  `PHP ${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const CATEGORIES = [
  "Opening Balance",
  "Salary",
  "Overtime Pay",
  "Payment to Gibbs",
  "Gibbs Lent Jerica Money",
  "Gibbs Paid Expense for Jerica",
  "Gibbs Monthly Charge",
  "Adjustment",
  "Historical Detail",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const OPENING_CUTOFF = "2026-07-01";

/** Current calendar date in America/New_York (Eastern Time) as YYYY-MM-DD */
export function easternToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** @deprecated kept as an alias — the ledger now follows Eastern Time. */
export const manilaToday = easternToday;

export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export function formatLedgerDate(
  occurredOn: string | null,
  precision: string
): string {
  if (precision === "unknown" || !occurredOn) return "Date not recorded";
  if (precision === "month") return monthLabel(occurredOn.slice(0, 7));
  return new Date(occurredOn + "T12:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** nth (1-indexed) weekday of a month (0=Sun … 6=Sat), as YYYY-MM-DD (Manila calendar dates). */
export function nthWeekday(year: number, month1: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(year, month1 - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** nth (1-indexed) Thursday of a month. */
export function nthThursday(year: number, month1: number, nth: number): string {
  return nthWeekday(year, month1, 4, nth);
}

export interface SalaryAccrual {
  schedule_key: string;
  occurred_on: string;
  amount: number;
  description: string;
}

/**
 * One full monthly salary on the 1st, from October 2026 through the supplied
 * America/New_York calendar date. Keys match the existing backend automation.
 */
export function salaryAccrualsThrough(today: string, monthlySalary = 60000): SalaryAccrual[] {
  const out: SalaryAccrual[] = [];
  let y = 2026;
  let m = 10;
  const [ty, tm] = today.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    const period = `${y}-${String(m).padStart(2, "0")}`;
    const date = `${period}-01`;
    if (date <= today) {
      out.push({
        schedule_key: `salary-${period}-day1`,
        occurred_on: date,
        amount: monthlySalary,
        description: `${monthLabel(period)} salary (1st of month)`,
      });
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Next first-of-month on or after the supplied ET date, never before October 2026. */
export function nextAccrualDate(today: string): string {
  if (today <= "2026-10-01") return "2026-10-01";
  const [y, m, d] = today.split("-").map(Number);
  if (d === 1) return today;
  const next = new Date(Date.UTC(y, m, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Preserve existing rows; the database's unique canonical key arbitrates races.
 * Use INSERT rather than upsert: the existing unique index is partial, and no
 * historical salary (including voided/excluded rows) should be overwritten.
 */
export async function postMissingSalaryAccruals(
  due: SalaryAccrual[],
  existingKeys: Set<string>,
  insert: (accrual: SalaryAccrual) => Promise<{ error: { code?: string; message: string } | null }>
): Promise<void> {
  for (const accrual of due) {
    if (existingKeys.has(accrual.schedule_key)) continue;
    const { error } = await insert(accrual);
    // Another frontend or the canonical cron may have inserted this key after
    // the read. Each row is separate so one duplicate cannot abort other months.
    if (error && error.code !== "23505") throw new Error(error.message);
    existingKeys.add(accrual.schedule_key);
  }
}
