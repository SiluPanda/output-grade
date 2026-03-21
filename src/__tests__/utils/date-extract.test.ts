import { describe, it, expect } from 'vitest';
import { extractDates } from '../../utils/date-extract';

// ── ISO Format (YYYY-MM-DD) ──────────────────────────────────────────────────

describe('extractDates — ISO format (YYYY-MM-DD)', () => {
  it('extracts a valid ISO date', () => {
    const results = extractDates('The release was on 2024-01-15.');
    expect(results).toHaveLength(1);
    expect(results[0]!.date).toBe('2024-01-15');
    expect(results[0]!.valid).toBe(true);
  });

  it('captures correct start/end offsets for ISO date', () => {
    const text = 'Released: 2024-03-20 today.';
    const results = extractDates(text);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(text.slice(r.start, r.end)).toBe(r.date);
  });

  it('flags ISO date with impossible day as invalid', () => {
    const results = extractDates('Date: 2024-02-30');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('impossible date');
  });

  it('flags ISO date with invalid month as invalid', () => {
    const results = extractDates('Date: 2024-13-01');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
  });

  it('accepts Feb 29 in a leap year', () => {
    const results = extractDates('Date: 2024-02-29');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(true);
  });

  it('rejects Feb 29 in a non-leap year', () => {
    const results = extractDates('Date: 2023-02-29');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('impossible date');
  });

  it('extracts multiple ISO dates', () => {
    const text = 'From 2023-01-01 to 2023-12-31.';
    const results = extractDates(text);
    expect(results).toHaveLength(2);
    expect(results[0]!.date).toBe('2023-01-01');
    expect(results[1]!.date).toBe('2023-12-31');
  });
});

// ── US Format (MM/DD/YYYY) ───────────────────────────────────────────────────

describe('extractDates — US format (MM/DD/YYYY)', () => {
  it('extracts a valid US date', () => {
    const results = extractDates('Meeting on 01/15/2024.');
    expect(results).toHaveLength(1);
    expect(results[0]!.date).toBe('01/15/2024');
    expect(results[0]!.valid).toBe(true);
  });

  it('captures correct offsets for US date', () => {
    const text = 'Deadline: 03/31/2024 sharp.';
    const results = extractDates(text);
    const r = results[0]!;
    expect(text.slice(r.start, r.end)).toBe(r.date);
  });

  it('flags US date with impossible day (month 4 has 30 days)', () => {
    const results = extractDates('Date: 04/31/2024');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('impossible date');
  });

  it('flags US date with invalid month', () => {
    const results = extractDates('Date: 13/01/2024');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
  });
});

// ── English Named Format: Month DD, YYYY ─────────────────────────────────────

describe('extractDates — English format: Month DD, YYYY', () => {
  it('extracts valid "January 15, 2024" format', () => {
    const results = extractDates('Published January 15, 2024.');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(true);
    expect(results[0]!.date).toContain('January');
  });

  it('extracts valid "March 1, 2023" without leading zero', () => {
    const results = extractDates('Started March 1, 2023.');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(true);
  });

  it('flags "February 30, 2024" as impossible', () => {
    const results = extractDates('Date: February 30, 2024.');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('impossible date');
  });

  it('is case-insensitive for month names', () => {
    const results = extractDates('Date: JANUARY 15, 2024.');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(true);
  });

  it('captures correct offsets for named date', () => {
    const text = 'Event: June 20, 2025 tonight.';
    const results = extractDates(text);
    const r = results[0]!;
    expect(text.slice(r.start, r.end)).toBe(r.date);
  });
});

// ── English Named Format: DD Month YYYY ─────────────────────────────────────

describe('extractDates — English format: DD Month YYYY', () => {
  it('extracts valid "15 January 2024" format', () => {
    const results = extractDates('Born 15 January 2024.');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(true);
  });

  it('extracts valid "1 March 2023" without leading zero', () => {
    const results = extractDates('1 March 2023 is the start.');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(true);
  });

  it('flags "30 February 2024" as impossible', () => {
    const results = extractDates('Date: 30 February 2024.');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('impossible date');
  });
});

// ── Future Date Detection ────────────────────────────────────────────────────

describe('extractDates — future date detection', () => {
  const currentYear = new Date().getFullYear();

  it('flags date more than 2 years in future as invalid', () => {
    const futureYear = currentYear + 3;
    const results = extractDates(`Date: ${futureYear}-06-15`);
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('future date');
  });

  it('accepts date within 2-year horizon', () => {
    const nearYear = currentYear + 1;
    const results = extractDates(`Deadline: ${nearYear}-01-01`);
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(true);
  });

  it('accepts date exactly at horizon boundary (currentYear + 2)', () => {
    const horizonYear = currentYear + 2;
    const results = extractDates(`Date: ${horizonYear}-06-01`);
    expect(results[0]!.valid).toBe(true);
  });

  it('respects custom futureHorizonYears parameter', () => {
    const farYear = currentYear + 5;
    // With horizon=10, this should be valid
    const results1 = extractDates(`Date: ${farYear}-01-01`, 10);
    expect(results1[0]!.valid).toBe(true);

    // With horizon=3, currentYear+5 should be invalid
    const results2 = extractDates(`Date: ${farYear}-01-01`, 3);
    expect(results2[0]!.valid).toBe(false);
    expect(results2[0]!.reason).toBe('future date');
  });
});

// ── Year Range Validation ────────────────────────────────────────────────────

describe('extractDates — year range validation', () => {
  it('rejects year before 1900', () => {
    const results = extractDates('Date: 1899-01-01');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('year out of range');
  });

  it('rejects year after 2100', () => {
    const results = extractDates('Date: 2101-01-01');
    expect(results).toHaveLength(1);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.reason).toBe('year out of range');
  });

  it('accepts year 1900', () => {
    const results = extractDates('Date: 1900-01-01');
    expect(results[0]!.valid).toBe(true);
  });

  it('accepts year 2024', () => {
    const results = extractDates('Date: 2024-06-15');
    expect(results[0]!.valid).toBe(true);
  });
});

// ── Edge Cases ───────────────────────────────────────────────────────────────

describe('extractDates — edge cases', () => {
  it('returns empty array for text with no dates', () => {
    expect(extractDates('No dates in this text at all.')).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(extractDates('')).toHaveLength(0);
  });

  it('results are sorted by start position', () => {
    const text = 'Later: 2024-12-31 and earlier: 2024-01-01.';
    const results = extractDates(text);
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.start).toBeGreaterThanOrEqual(results[i - 1]!.start);
    }
  });

  it('DateLocation has date, start, end, valid fields', () => {
    const results = extractDates('Event on 2024-06-15.');
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(typeof r.date).toBe('string');
    expect(typeof r.start).toBe('number');
    expect(typeof r.end).toBe('number');
    expect(typeof r.valid).toBe('boolean');
  });
});
