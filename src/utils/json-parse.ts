/** Result of a lenient JSON parse attempt. */
export interface JsonParseResult {
  /** Whether parsing succeeded (strict or lenient). */
  success: boolean;

  /** The parsed value, if successful. */
  value?: unknown;

  /** Whether lenient parsing was required (markdown fences stripped). */
  lenient?: boolean;

  /** Error message if parsing failed entirely. */
  error?: string;
}

/**
 * Attempt to parse a string as JSON, with a lenient fallback.
 *
 * 1. Try `JSON.parse()` on the raw input.
 * 2. On failure, strip markdown code fences and trim, then try again.
 * 3. Return a result object with status and parsed value or error.
 */
export function lenientJsonParse(text: string): JsonParseResult {
  // Strict attempt first.
  try {
    const value = JSON.parse(text);
    return { success: true, value };
  } catch {
    /* fall through to lenient */
  }

  // Lenient: strip markdown fences and trim.
  const stripped = text
    .replace(/^```(?:json|JSON)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();

  try {
    const value = JSON.parse(stripped);
    return { success: true, value, lenient: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
