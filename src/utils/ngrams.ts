/**
 * Compute n-gram frequency distribution from a list of tokens.
 *
 * @param tokens - Array of tokens (typically from the tokenizer).
 * @param n - N-gram size (default: 3 for trigrams).
 * @returns A Map of n-gram strings to their occurrence counts.
 */
export function computeNgrams(tokens: string[], n: number = 3): Map<string, number> {
  const freq = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    freq.set(gram, (freq.get(gram) || 0) + 1);
  }
  return freq;
}

/**
 * Compute the repetition ratio for a token sequence.
 *
 * The repetition ratio is the fraction of unique n-grams that appear more
 * than once: `(count of n-grams appearing > 1) / (total unique n-grams)`.
 *
 * @param tokens - Array of tokens.
 * @param n - N-gram size (default: 3).
 * @returns Repetition ratio between 0.0 and 1.0.
 */
export function repetitionRatio(tokens: string[], n: number = 3): number {
  const freq = computeNgrams(tokens, n);
  if (freq.size === 0) return 0;
  let repeated = 0;
  for (const count of freq.values()) {
    if (count > 1) repeated++;
  }
  return repeated / freq.size;
}
