/**
 * PRD §4.3: a log entry's date represents the user's local calendar date,
 * stored as midnight UTC. We accept ISO date strings (YYYY-MM-DD) on the
 * wire and convert to a Date at start-of-day UTC for storage and querying.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().startsWith(value);
}

export function startOfDayUTC(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function endOfDayUTC(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function todayIsoDate(now: Date = new Date()): string {
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
