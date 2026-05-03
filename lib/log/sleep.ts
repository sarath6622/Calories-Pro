/**
 * Sleep duration in minutes between bedtime and wakeTime.
 *
 * PRD §4.6: `durationMinutes` is computed from the two timestamps. The two
 * inputs are real `Date` instants, so a sleep that crosses midnight
 * (bedtime = 23:30 → wakeTime = 07:00 next day) just works as long as the
 * caller passes both as full datetimes — there's no calendar arithmetic
 * involved beyond subtracting the epoch ms.
 *
 * Returns null if either input is invalid or wakeTime is not strictly after
 * bedtime; the API layer turns that into a 400.
 */
export function sleepDurationMinutes(bedtime: Date, wakeTime: Date): number | null {
  const start = bedtime.getTime();
  const end = wakeTime.getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) return null;
  return Math.round((end - start) / 60_000);
}
