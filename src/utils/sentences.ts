/**
 * Sentence splitter.
 *
 * Splits text on sentence-ending punctuation (`.`, `!`, `?`) followed by
 * whitespace and an uppercase letter. Acceptable to mis-split abbreviations
 * like "Dr. Smith" since off-by-one errors in sentence count have negligible
 * impact on density calculations.
 */
export function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}
