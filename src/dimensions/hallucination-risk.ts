import type { DimensionResult, Signal } from '../types';
import { HEDGING_PATTERNS } from '../patterns/hedging';
import { CONFIDENCE_PATTERNS } from '../patterns/confidence';
import { splitSentences } from '../utils/sentences';
import { extractUrls } from '../utils/url-extract';

/**
 * Score the hallucination risk of an LLM output.
 *
 * Evaluates multiple indicators: hedging language density, confidence
 * inflation phrases, fabricated/suspicious URLs, and self-contradiction
 * patterns. Returns a score from 0.0 (high hallucination risk) to 1.0
 * (low risk) along with diagnostic signals.
 *
 * Composite uses minimum (worst-case): one strongly present indicator
 * floors the entire score. Clamped to [0.0, 1.0].
 */
export function scoreHallucinationRisk(output: string): DimensionResult {
  const signals: Signal[] = [];
  const sentences = splitSentences(output);
  if (sentences.length === 0) return { score: 1.0, signals };

  const subScores: number[] = [];

  // 1. Hedging language detection
  let hedgingCount = 0;
  for (const pattern of HEDGING_PATTERNS) {
    if (pattern.pattern.test(output)) {
      hedgingCount++;
      signals.push({
        id: `hallucination-hedging-${pattern.category}`,
        severity: pattern.severity,
        dimension: 'hallucination-risk',
        message: `Hedging phrase: "${pattern.label}"`,
        location: null,
      });
    }
  }
  const hedgingDensity = hedgingCount / sentences.length;
  subScores.push(Math.max(0, 1.0 - Math.min(1.0, hedgingDensity * 2.5)));

  // 2. Confidence inflation detection
  let inflationCount = 0;
  for (const pattern of CONFIDENCE_PATTERNS) {
    if (pattern.pattern.test(output)) {
      inflationCount++;
      signals.push({
        id: 'hallucination-confidence-inflation',
        severity: 'info',
        dimension: 'hallucination-risk',
        message: `Confidence inflation: "${pattern.label}"`,
        location: null,
      });
    }
  }
  subScores.push(Math.max(0, 1.0 - Math.min(1.0, inflationCount * 0.1)));

  // 3. Fabricated URL detection (via url-extract utility)
  const urlMatches = extractUrls(output);
  let suspiciousUrls = 0;
  for (const urlLoc of urlMatches) {
    if (urlLoc.suspicious) {
      suspiciousUrls++;
      signals.push({
        id: 'hallucination-suspicious-url',
        severity: suspiciousUrls > 2 ? 'critical' : 'warning',
        dimension: 'hallucination-risk',
        message: `Suspicious URL: ${urlLoc.url}`,
        location: { start: urlLoc.start, end: urlLoc.end },
      });
    }
  }
  if (suspiciousUrls > 0)
    subScores.push(
      Math.max(0, 1.0 - Math.min(1.0, suspiciousUrls * 0.3)),
    );

  // 4. Self-contradiction detection (simple patterns)
  let contradictions = 0;
  if (/\bhowever.{0,30}this is not true\b/i.test(output)) contradictions++;
  if (/\bactually.{0,20}(?:incorrect|wrong|false)\b/i.test(output))
    contradictions++;
  if (/\bcorrection:/i.test(output)) contradictions++;
  if (contradictions > 0) {
    signals.push({
      id: 'hallucination-contradiction',
      severity: 'warning',
      dimension: 'hallucination-risk',
      message: `${contradictions} potential self-contradiction(s) detected`,
      location: null,
    });
    subScores.push(
      Math.max(0, 1.0 - Math.min(1.0, contradictions * 0.3)),
    );
  }

  // Composite: minimum (worst case)
  const score = subScores.length > 0 ? Math.min(...subScores) : 1.0;

  return {
    score: Math.max(0, Math.min(1, score)),
    signals,
  };
}
