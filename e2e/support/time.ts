// Wall-clock helpers for the E2E scenarios. Everything is computed in the
// browser's time zone (playwright.config.ts imports E2E_TIME_ZONE), so
// "tomorrow at 10:00 AM" means the same instant to the test and to the app.

export const E2E_TIME_ZONE = 'America/New_York';

const DAY_MS = 24 * 60 * 60 * 1000;

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function zonedParts(instant: Date): ZonedParts {
  const parts: Intl.DateTimeFormatPart[] = new Intl.DateTimeFormat('en-US', {
    timeZone: E2E_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(
      parts.find((part: Intl.DateTimeFormatPart): boolean => part.type === type)?.value,
    );
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Tomorrow's date in the E2E time zone, as YYYY-MM-DD. */
export function tomorrow(now: Date = new Date()): string {
  const { year, month, day } = zonedParts(now);
  return new Date(Date.UTC(year, month - 1, day) + DAY_MS).toISOString().slice(0, 10);
}

/** "2:00 PM" -> "14:00". */
export function to24Hour(clock: string): string {
  const match: RegExpExecArray | null = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(clock);
  if (match === null) {
    throw new Error(`Expected a time like "2:00 PM", got "${clock}".`);
  }
  const [, hours = '', minutes = '', period = ''] = match;
  const hour: number = (Number(hours) % 12) + (period === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${minutes}`;
}

/** Value for <input type="datetime-local">, which takes local wall-clock time. */
export function localInput(date: string, clock: string): string {
  return `${date}T${to24Hour(clock)}`;
}

/** The UTC instant of a wall-clock time in the E2E time zone, for API calls. */
export function toInstant(date: string, clock: string): string {
  const asUtc: number = Date.parse(`${localInput(date, clock)}:00Z`);
  const zoned: ZonedParts = zonedParts(new Date(asUtc));
  const zonedAsUtc: number = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
  );
  return new Date(asUtc - (zonedAsUtc - asUtc)).toISOString();
}

/** Matches a clock time as the app renders it ("10:00 AM", possibly with U+202F). */
export function clockPattern(clock: string): RegExp {
  return new RegExp(clock.replace(' ', '\\s'));
}
