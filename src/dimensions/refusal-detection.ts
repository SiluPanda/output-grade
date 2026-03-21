import type { DimensionResult, Signal } from '../types';
import { REFUSAL_PATTERNS } from '../patterns/refusal';
import { splitSentences } from '../utils/sentences';

/**
 * Score the refusal detection of an LLM output.
 *
 * Scans the output for refusal patterns (direct refusal, policy citation,
 * safety refusal, capability limitation, redirect) and identity disclosure
 * patterns. Classifies the output as full refusal (score 0.0), partial
 * refusal (clamped to [0.3, 0.9]), or no refusal (score 1.0). Identity
 * disclosures receive a softer deduction of 0.05 per occurrence with a
 * floor of 0.7.
 */
export function scoreRefusalDetection(
  output: string,
  _prompt?: string,
): DimensionResult {
  const signals: Signal[] = [];
  const sentences = splitSentences(output);

  if (sentences.length === 0) {
    return { score: 1.0, signals };
  }

  // Scan for refusal matches
  let refusalSentenceCount = 0;
  let identityCount = 0;

  for (const sentence of sentences) {
    let isRefusal = false;

    for (const pattern of REFUSAL_PATTERNS) {
      if (pattern.pattern.test(sentence)) {
        if (pattern.category === 'identity') {
          identityCount++;
          signals.push({
            id: `refusal-${pattern.category}`,
            severity: 'info',
            dimension: 'refusal-detection',
            message: `Identity disclosure: "${pattern.label}"`,
            location: null,
          });
        } else {
          isRefusal = true;
          signals.push({
            id: `refusal-${pattern.category}`,
            severity: pattern.severity,
            dimension: 'refusal-detection',
            message: `Refusal detected: "${pattern.label}"`,
            location: null,
          });
        }
      }
    }

    if (isRefusal) {
      refusalSentenceCount++;
    }
  }

  // Classification
  let score: number;

  if (refusalSentenceCount === sentences.length) {
    // Full refusal
    score = 0.0;
    signals.push({
      id: 'refusal-full',
      severity: 'critical',
      dimension: 'refusal-detection',
      message: 'Entire output is a refusal',
      location: null,
    });
  } else if (refusalSentenceCount > 0) {
    // Partial refusal
    const ratio = refusalSentenceCount / sentences.length;
    score = Math.max(0.3, Math.min(0.9, 1.0 - ratio));
    signals.push({
      id: 'refusal-partial',
      severity: 'warning',
      dimension: 'refusal-detection',
      message: `Partial refusal: ${refusalSentenceCount}/${sentences.length} sentences`,
      location: null,
    });
  } else {
    score = 1.0;
  }

  // Identity disclosure deduction (softer)
  if (identityCount > 0) {
    score = Math.max(0.7, score - identityCount * 0.05);
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    signals,
  };
}
