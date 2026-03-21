import type { DimensionResult, Signal, DetectedFormat } from '../types';
import { tokenize } from '../utils/tokenizer';
import { splitSentences } from '../utils/sentences';
import { repetitionRatio } from '../utils/ngrams';
import { detectFormat } from '../utils/format-detect';

/**
 * Score the content coherence of an LLM output.
 *
 * Evaluates multiple facets of coherence: degenerate output detection,
 * n-gram repetition, sentence repetition, sliding window repetition,
 * lexical diversity (Type-Token Ratio), and sentence structure analysis.
 *
 * Composite: weighted average of sub-metrics — repetition 0.5,
 * lexical diversity 0.25, degenerate output 0.15, sentence structure 0.10.
 * Clamped to [0.0, 1.0].
 */
export function scoreContentCoherence(
  output: string,
  format?: string,
): DimensionResult {
  const signals: Signal[] = [];
  const detectedFormat: DetectedFormat =
    (format as DetectedFormat) || detectFormat(output);

  // Extract text content based on format
  const text = extractText(output, detectedFormat);

  // Degenerate output check
  const degenerateScore = scoreDegenerateOutput(text, signals);
  if (degenerateScore <= 0.1) {
    return { score: degenerateScore, signals };
  }

  // N-gram repetition
  const tokens = tokenize(text);
  const ngramRepScore = scoreNgramRepetition(tokens, signals);

  // Sentence repetition
  const sentences = splitSentences(text);
  const sentRepScore = scoreSentenceRepetition(sentences, signals);

  // Sliding window repetition
  const slidingScore = scoreSlidingWindowRepetition(text, signals);

  // Lexical diversity (TTR)
  const ttrScore = scoreLexicalDiversity(tokens, signals);

  // Sentence structure
  const structureScore = scoreSentenceStructure(sentences, signals);

  // Composite: weighted average
  const repetitionScore = Math.min(ngramRepScore, sentRepScore, slidingScore);
  const composite =
    repetitionScore * 0.5 +
    ttrScore * 0.25 +
    degenerateScore * 0.15 +
    structureScore * 0.1;

  return {
    score: Math.max(0, Math.min(1, composite)),
    signals,
  };
}

// ── Text Extraction ──────────────────────────────────────────────────────────

function extractText(output: string, format: DetectedFormat): string {
  if (format === 'json') {
    try {
      const parsed = JSON.parse(output);
      return extractJsonStrings(parsed).join(' ');
    } catch {
      return output;
    }
  }
  return output;
}

function extractJsonStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(extractJsonStrings);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(extractJsonStrings);
  }
  return [];
}

// ── Degenerate Output ────────────────────────────────────────────────────────

function scoreDegenerateOutput(text: string, signals: Signal[]): number {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    signals.push({
      id: 'coherence-empty',
      severity: 'critical',
      dimension: 'content-coherence',
      message: 'Output is empty or whitespace-only',
      location: null,
    });
    return 0.0;
  }

  if (new Set(trimmed).size === 1) {
    signals.push({
      id: 'coherence-single-char-repeat',
      severity: 'critical',
      dimension: 'content-coherence',
      message: 'Output is a single character repeated',
      location: null,
    });
    return 0.0;
  }

  const specialRatio =
    (trimmed.match(/[^a-zA-Z0-9\s]/g) || []).length / trimmed.length;
  if (specialRatio > 0.9) {
    signals.push({
      id: 'coherence-mostly-special',
      severity: 'critical',
      dimension: 'content-coherence',
      message: `${Math.round(specialRatio * 100)}% special characters`,
      location: null,
    });
    return 0.1;
  }

  return 1.0;
}

// ── N-gram Repetition ────────────────────────────────────────────────────────

function scoreNgramRepetition(tokens: string[], signals: Signal[]): number {
  if (tokens.length < 3) return 1.0;

  const ratio = repetitionRatio(tokens, 3);
  if (ratio > 0.5) {
    signals.push({
      id: 'coherence-ngram-repetition',
      severity: 'warning',
      dimension: 'content-coherence',
      message: `High n-gram repetition ratio: ${ratio.toFixed(2)}`,
      location: null,
    });
  }

  return Math.max(0, 1.0 - Math.min(1.0, ratio * 1.5));
}

// ── Sentence Repetition ──────────────────────────────────────────────────────

function scoreSentenceRepetition(
  sentences: string[],
  signals: Signal[],
): number {
  if (sentences.length < 2) return 1.0;

  const seen = new Map<string, number>();
  for (const s of sentences) {
    const normalized = s.trim().toLowerCase();
    seen.set(normalized, (seen.get(normalized) || 0) + 1);
  }

  let duplicates = 0;
  for (const count of seen.values()) {
    if (count > 1) duplicates += count - 1;
  }

  const ratio = duplicates / sentences.length;
  if (ratio > 0.2) {
    signals.push({
      id: 'coherence-sentence-repetition',
      severity: 'critical',
      dimension: 'content-coherence',
      message: `${duplicates} duplicate sentence(s) out of ${sentences.length}`,
      location: null,
    });
  }

  return Math.max(0, 1.0 - ratio);
}

// ── Sliding Window Repetition ────────────────────────────────────────────────

function scoreSlidingWindowRepetition(
  text: string,
  signals: Signal[],
): number {
  if (text.length < 100) return 1.0;

  let repeatsFound = 0;
  for (
    let blockSize = 50;
    blockSize <= Math.min(200, text.length / 2);
    blockSize += 50
  ) {
    for (let i = 0; i <= text.length - blockSize * 2; i++) {
      const block = text.substring(i, i + blockSize);
      const nextIdx = text.indexOf(block, i + blockSize);
      if (nextIdx !== -1) {
        repeatsFound++;
        signals.push({
          id: 'coherence-sliding-repeat',
          severity: 'critical',
          dimension: 'content-coherence',
          message: `Repeated ${blockSize}-char block detected`,
          location: null,
        });
        break;
      }
    }
    if (repeatsFound > 0) break;
  }

  return repeatsFound > 0 ? 0.2 : 1.0;
}

// ── Lexical Diversity ────────────────────────────────────────────────────────

function scoreLexicalDiversity(tokens: string[], signals: Signal[]): number {
  if (tokens.length === 0) return 1.0;

  const unique = new Set(tokens).size;
  const ttr = unique / tokens.length;

  if (ttr < 0.2) {
    signals.push({
      id: 'coherence-low-diversity',
      severity: 'warning',
      dimension: 'content-coherence',
      message: `Low lexical diversity (TTR=${ttr.toFixed(2)})`,
      location: null,
    });
  }

  return Math.min(1.0, ttr / 0.4);
}

// ── Sentence Structure ───────────────────────────────────────────────────────

function scoreSentenceStructure(
  sentences: string[],
  signals: Signal[],
): number {
  if (sentences.length === 0) return 1.0;

  const avgLength =
    sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
    sentences.length;

  if (avgLength < 3) {
    signals.push({
      id: 'coherence-short-sentences',
      severity: 'warning',
      dimension: 'content-coherence',
      message: `Very short avg sentence length: ${avgLength.toFixed(1)} words`,
      location: null,
    });
    return 0.5;
  }

  if (avgLength > 100) {
    signals.push({
      id: 'coherence-long-sentences',
      severity: 'warning',
      dimension: 'content-coherence',
      message: `Very long avg sentence length: ${avgLength.toFixed(1)} words`,
      location: null,
    });
    return 0.5;
  }

  return 1.0;
}
