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

/** Backward-compatible alias for older callers; value is Eastern Time. */
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

export interface SalaryAccrual {
  schedule_key: string;
  occurred_on: string;
  amount: number;
  description: string;
}

/**
 * One full monthly salary accrual on the 1st of each month in America/New_York.
 * Automatic accruals begin October 1, 2026. September remains historical only.
 */
export function salaryAccrualsThrough(
  today: string,
  monthlySalary = 60000
): SalaryAccrual[] {
  const out: SalaryAccrual[] = [];
  const [ty, tm] = today.split("-").map(Number);

  let y = 2026;
  let m = 10;

  while (y < ty || (y === ty && m <= tm)) {
    const month = String(m).padStart(2, "0");
    const occurredOn = `${y}-${month}-01`;

    if (occurredOn <= today) {
      out.push({
        schedule_key: `salary-${y}-${month}-day1`,
        occurred_on: occurredOn,
        amount: monthlySalary,
        description: `${monthLabel(`${y}-${month}`)} salary`,
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

/** The next upcoming 1st-of-month salary accrual date in Eastern Time. */
export function nextAccrualDate(today: string): string {
  const [year, month, day] = today.split("-").map(Number);

  if (today < "2026-10-01") return "2026-10-01";
  if (day === 1) return today;

  let y = year;
  let m = month + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }

  return `${y}-${String(m).padStart(2, "0")}-01`;
}
