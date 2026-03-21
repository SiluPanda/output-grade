import type { DimensionResult, Signal } from '../types';
import { tokenize } from '../utils/tokenizer';
import { removeStopwords } from '../patterns/stopwords';

/**
 * Score the relevance of an LLM output to the original prompt.
 *
 * Evaluates keyword overlap, structural alignment, topic drift,
 * length reasonableness, and optional expected-output comparison.
 * Returns a score from 0.0 (irrelevant) to 1.0 (highly relevant)
 * along with diagnostic signals.
 *
 * When no prompt is provided, returns 1.0 (neutral).
 */
export function scoreRelevance(
  output: string,
  prompt?: string,
  expected?: string,
): DimensionResult {
  const signals: Signal[] = [];

  // No prompt = neutral
  if (!prompt) return { score: 1.0, signals };

  const promptKeywords = extractKeywords(prompt);
  const outputKeywords = extractKeywords(output);

  if (promptKeywords.size === 0) return { score: 1.0, signals };

  // 1. Keyword overlap
  const intersection = new Set(
    [...promptKeywords].filter((k) => outputKeywords.has(k)),
  );
  const overlapRatio = intersection.size / promptKeywords.size;
  const keywordScore = Math.min(1.0, overlapRatio * 1.5);
  if (overlapRatio < 0.2) {
    signals.push({
      id: 'relevance-low-keyword-overlap',
      severity: 'warning',
      dimension: 'relevance',
      message: `Low keyword overlap: ${(overlapRatio * 100).toFixed(0)}%`,
      location: null,
    });
  }

  // 2. Structural alignment
  let structuralScore = 1.0;
  if (/\b(list|enumerate|bullet)\b/i.test(prompt)) {
    if (!/^[-*\d][\s.)]/m.test(output)) {
      signals.push({
        id: 'relevance-missing-list',
        severity: 'warning',
        dimension: 'relevance',
        message:
          'Prompt requested list format but output lacks list items',
        location: null,
      });
      structuralScore -= 0.2;
    }
  }
  if (/\bjson\b/i.test(prompt)) {
    if (!/[{[]/.test(output)) {
      signals.push({
        id: 'relevance-missing-json',
        severity: 'warning',
        dimension: 'relevance',
        message: 'Prompt requested JSON but output lacks JSON structure',
        location: null,
      });
      structuralScore -= 0.3;
    }
  }
  if (/\b(code|function|implement)\b/i.test(prompt)) {
    if (
      !/```/.test(output) &&
      !/function\s|const\s|class\s|def\s|import\s/.test(output)
    ) {
      signals.push({
        id: 'relevance-missing-code',
        severity: 'warning',
        dimension: 'relevance',
        message: 'Prompt requested code but output lacks code patterns',
        location: null,
      });
      structuralScore -= 0.2;
    }
  }
  structuralScore = Math.max(0, structuralScore);

  // 3. Topic drift detection
  let driftScore = 1.0;
  if (output.length > 200) {
    const quarters = splitIntoQuarters(output);
    const firstOverlap = computeOverlap(
      promptKeywords,
      extractKeywords(quarters[0]),
    );
    const lastOverlap = computeOverlap(
      promptKeywords,
      extractKeywords(quarters[3]),
    );
    if (firstOverlap > 0.5 && lastOverlap < 0.1) {
      signals.push({
        id: 'relevance-topic-drift',
        severity: 'warning',
        dimension: 'relevance',
        message: 'Output drifts from topic (high start, low end)',
        location: null,
      });
      driftScore -= 0.15;
    }
  }

  // 4. Length reasonableness
  let lengthScore = 1.0;
  if (
    /\b(explain in detail|comprehensive|thorough|write a long)\b/i.test(
      prompt,
    ) &&
    output.length < 100
  ) {
    signals.push({
      id: 'relevance-too-short',
      severity: 'warning',
      dimension: 'relevance',
      message: 'Output is too short for the detailed request',
      location: null,
    });
    lengthScore -= 0.2;
  }
  if (
    /\b(in one sentence|briefly|summarize|short)\b/i.test(prompt) &&
    output.length > 2000
  ) {
    signals.push({
      id: 'relevance-too-long',
      severity: 'info',
      dimension: 'relevance',
      message: 'Output is longer than expected for brief request',
      location: null,
    });
    lengthScore -= 0.1;
  }

  // 5. Expected output comparison
  let expectedScore = 1.0;
  if (expected) {
    const expectedTokens = new Set(tokenize(expected));
    const outputTokens = new Set(tokenize(output));
    const union = new Set([...expectedTokens, ...outputTokens]);
    const inter = new Set(
      [...expectedTokens].filter((t) => outputTokens.has(t)),
    );
    const jaccard = union.size > 0 ? inter.size / union.size : 0;
    expectedScore = jaccard * 0.5 + keywordScore * 0.5;
  }

  // Composite
  let composite: number;
  if (expected) {
    composite = expectedScore;
  } else {
    composite =
      keywordScore * 0.5 +
      structuralScore * 0.2 +
      driftScore * 0.15 +
      lengthScore * 0.15;
  }

  return {
    score: Math.max(0, Math.min(1, composite)),
    signals,
  };
}

function extractKeywords(text: string): Set<string> {
  const tokens = removeStopwords(tokenize(text));
  return new Set(tokens.filter((t) => t.length > 1));
}

function splitIntoQuarters(text: string): string[] {
  const chunkSize = Math.ceil(text.length / 4);
  return [
    text.substring(0, chunkSize),
    text.substring(chunkSize, chunkSize * 2),
    text.substring(chunkSize * 2, chunkSize * 3),
    text.substring(chunkSize * 3),
  ];
}

function computeOverlap(
  keywords: Set<string>,
  textKeywords: Set<string>,
): number {
  if (keywords.size === 0) return 0;
  const inter = [...keywords].filter((k) => textKeywords.has(k));
  return inter.length / keywords.size;
}
