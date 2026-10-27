const MINUTE_MS: number = 60_000;
const HOUR_MS: number = 60 * MINUTE_MS;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a Date for <input type="datetime-local">, which works in local time. */
export function toLocalInputValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Parses a datetime-local value as local time, or null when empty or invalid. */
export function parseLocalInput(value: string): Date | null {
  if (value.trim().length === 0) {
    return null;
  }
  const date: Date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The next full hour, one hour long: a sensible default slot. */
export function defaultSlot(now: Date = new Date()): { start: Date; end: Date } {
  const start: Date = new Date(Math.ceil(now.getTime() / HOUR_MS) * HOUR_MS);
  return { start, end: new Date(start.getTime() + HOUR_MS) };
}

const DATE_TIME = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const TIME_ONLY = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Oct 27, 2026, 10:00 AM – 11:00 AM", repeating the date only when it changes. */
export function formatSlot(startIso: string, endIso: string): string {
  const start: Date = new Date(startIso);
  const end: Date = new Date(endIso);
  const endText: string = isSameLocalDay(start, end)
    ? TIME_ONLY.format(end)
    : DATE_TIME.format(end);
  return `${DATE_TIME.format(start)} – ${endText}`;
}
