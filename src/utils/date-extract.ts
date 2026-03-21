export interface DateLocation {
  date: string;
  start: number;
  end: number;
  valid: boolean;
  reason?: string;
}

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

// Days in each month (non-leap year)
const DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function maxDaysInMonth(month: number, year: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month] ?? 30;
}

function validateDate(
  year: number,
  month: number,
  day: number,
  futureHorizonYears: number,
): { valid: boolean; reason?: string } {
  const currentYear = new Date().getFullYear();

  if (year < 1900 || year > 2100) {
    return { valid: false, reason: 'year out of range' };
  }
  if (month < 1 || month > 12) {
    return { valid: false, reason: 'invalid month' };
  }
  const maxDay = maxDaysInMonth(month, year);
  if (day < 1 || day > maxDay) {
    return { valid: false, reason: 'impossible date' };
  }
  if (year > currentYear + futureHorizonYears) {
    return { valid: false, reason: 'future date' };
  }
  return { valid: true };
}

/**
 * Extract dates from text with character offsets and validity flags.
 *
 * Supports four formats:
 *   - YYYY-MM-DD (ISO)
 *   - MM/DD/YYYY (US)
 *   - Month DD, YYYY  (e.g. "January 15, 2024")
 *   - DD Month YYYY   (e.g. "15 January 2024")
 *
 * @param text - Input text to scan for dates.
 * @param futureHorizonYears - Years beyond current year considered "future". Default: 2.
 */
export function extractDates(text: string, futureHorizonYears = 2): DateLocation[] {
  const results: DateLocation[] = [];

  // 1. YYYY-MM-DD
  const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = isoRe.exec(text)) !== null) {
    const year = parseInt(m[1]!, 10);
    const month = parseInt(m[2]!, 10);
    const day = parseInt(m[3]!, 10);
    const check = validateDate(year, month, day, futureHorizonYears);
    results.push({
      date: m[0],
      start: m.index,
      end: m.index + m[0].length,
      valid: check.valid,
      ...(check.reason !== undefined ? { reason: check.reason } : {}),
    });
  }

  // 2. MM/DD/YYYY
  const usRe = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((m = usRe.exec(text)) !== null) {
    const month = parseInt(m[1]!, 10);
    const day = parseInt(m[2]!, 10);
    const year = parseInt(m[3]!, 10);
    const check = validateDate(year, month, day, futureHorizonYears);
    results.push({
      date: m[0],
      start: m.index,
      end: m.index + m[0].length,
      valid: check.valid,
      ...(check.reason !== undefined ? { reason: check.reason } : {}),
    });
  }

  // 3. Month DD, YYYY  (e.g. "January 15, 2024")
  const monthNameList = Object.keys(MONTH_NAMES).map((n) => n[0]!.toUpperCase() + n.slice(1)).join('|');
  const namedRe1 = new RegExp(`\\b(${monthNameList})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi');
  while ((m = namedRe1.exec(text)) !== null) {
    const month = MONTH_NAMES[m[1]!.toLowerCase()] ?? 0;
    const day = parseInt(m[2]!, 10);
    const year = parseInt(m[3]!, 10);
    const check = validateDate(year, month, day, futureHorizonYears);
    results.push({
      date: m[0],
      start: m.index,
      end: m.index + m[0].length,
      valid: check.valid,
      ...(check.reason !== undefined ? { reason: check.reason } : {}),
    });
  }

  // 4. DD Month YYYY  (e.g. "15 January 2024")
  const namedRe2 = new RegExp(`\\b(\\d{1,2})\\s+(${monthNameList})\\s+(\\d{4})\\b`, 'gi');
  while ((m = namedRe2.exec(text)) !== null) {
    const day = parseInt(m[1]!, 10);
    const month = MONTH_NAMES[m[2]!.toLowerCase()] ?? 0;
    const year = parseInt(m[3]!, 10);
    const check = validateDate(year, month, day, futureHorizonYears);
    results.push({
      date: m[0],
      start: m.index,
      end: m.index + m[0].length,
      valid: check.valid,
      ...(check.reason !== undefined ? { reason: check.reason } : {}),
    });
  }

  // Sort by position in text
  results.sort((a, b) => a.start - b.start);

  return results;
}
