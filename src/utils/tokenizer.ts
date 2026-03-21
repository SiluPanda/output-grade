/**
 * Simple whitespace tokenizer.
 *
 * Splits text on whitespace, strips leading/trailing punctuation from each
 * token, lowercases, and filters empty tokens. Degrades gracefully for
 * non-Latin scripts (no crashes, no NaN).
 */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(t => t.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase())
    .filter(t => t.length > 0);
}
