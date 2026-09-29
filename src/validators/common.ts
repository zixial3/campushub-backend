import { ValidationError } from '../errors/domainErrors';

// components/schemas/Identifier: 1-128 characters, no whitespace.
const IDENTIFIER_PATTERN = /^\S+$/;
const IDENTIFIER_MAX_LENGTH = 128;

// RFC 3339 date-time with a mandatory offset. Date.parse alone is too lenient:
// it accepts date-only strings, missing offsets (local time), and rolls
// impossible dates such as Feb 30 over into March.
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const unknownKeys: string[] = Object.keys(value).filter(
    (key: string): boolean => !allowed.includes(key),
  );
  if (unknownKeys.length > 0) {
    throw new ValidationError(
      `${context} has unknown properties: ${unknownKeys.join(', ')}.`,
    );
  }
}

export function parseIdentifier(value: unknown, field: string): string {
  if (value === undefined) {
    throw new ValidationError(`${field} is required.`);
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${field} is required and must be a non-empty string.`);
  }
  if (value.length > IDENTIFIER_MAX_LENGTH || !IDENTIFIER_PATTERN.test(value)) {
    throw new ValidationError(
      `${field} must be at most ${IDENTIFIER_MAX_LENGTH} characters with no whitespace.`,
    );
  }
  return value;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const days: readonly number[] = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return days[month - 1] ?? 0;
}

function hasValidFields(match: RegExpExecArray): boolean {
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = match
    .slice(1)
    .map((part: string | undefined): number => (part === undefined ? 0 : Number(part)));
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined ||
    offsetHour === undefined ||
    offsetMinute === undefined
  ) {
    return false;
  }
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    // Leap seconds (:60) are rejected, as documented in the contract.
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

export function parseDateTime(value: unknown, field: string): Date {
  if (value === undefined) {
    throw new ValidationError(`${field} is required.`);
  }
  const invalid = new ValidationError(
    `${field} must be an ISO 8601 date-time with a time zone offset, e.g. 2026-10-01T10:00:00Z.`,
  );
  if (typeof value !== 'string') {
    throw invalid;
  }
  const match: RegExpExecArray | null = DATE_TIME_PATTERN.exec(value);
  if (match === null || !hasValidFields(match)) {
    throw invalid;
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw invalid;
  }
  return instant;
}
