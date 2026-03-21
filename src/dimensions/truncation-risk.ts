import type { DimensionResult, Signal, DetectedFormat } from '../types';
import { checkBracketBalance } from '../utils/bracket-balance';
import { detectFormat } from '../utils/format-detect';

/**
 * Score the truncation risk of an LLM output.
 *
 * Checks multiple indicators of truncated output: unclosed brackets,
 * incomplete sentence endings, unclosed markdown fences, abrupt ending
 * patterns, and content-length heuristics. Returns a score from 0.0
 * (clearly truncated) to 1.0 (complete) along with diagnostic signals.
 *
 * Composite uses minimum (worst-case): truncation is binary-ish, so
 * the worst indicator drives the score.
 */
export function scoreTruncationRisk(
  output: string,
  format?: string,
): DimensionResult {
  const detectedFormat: DetectedFormat =
    (format as DetectedFormat) || detectFormat(output);
  const signals: Signal[] = [];
  const subScores: number[] = [];

  // 1. Unclosed brackets
  const balance = checkBracketBalance(output);
  const unclosedDepth =
    Math.abs(balance.curly) +
    Math.abs(balance.square) +
    Math.abs(balance.round);

  if (unclosedDepth > 0) {
    signals.push({
      id: 'truncation-unclosed-brackets',
      severity: 'critical',
      dimension: 'truncation-risk',
      message: `${unclosedDepth} unclosed bracket(s) detected`,
      location: null,
    });
    subScores.push(Math.max(0, 1.0 - unclosedDepth * 0.3));
  }

  // 2. Incomplete sentence detection
  const trimmed = output.trimEnd();
  if (trimmed.length > 0) {
    const lastChar = trimmed[trimmed.length - 1];
    const completionChars =
      detectedFormat === 'json'
        ? ['}', ']']
        : detectedFormat === 'code'
          ? ['}', ')', ';', ']']
          : detectedFormat === 'markdown'
            ? ['.', '!', '?', ':', ';', '"', "'", ')', ']', '}', '`']
            : ['.', '!', '?', ':', ';', '"', "'", ')', ']', '}'];

    if (!completionChars.includes(lastChar)) {
      signals.push({
        id: 'truncation-incomplete-ending',
        severity: 'warning',
        dimension: 'truncation-risk',
        message:
          'Output does not end with terminal punctuation or closing delimiter',
        location: null,
      });
      subScores.push(0.3);
    }
  }

  // 3. Unclosed markdown fence
  const fenceCount = (output.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    signals.push({
      id: 'truncation-unclosed-fence',
      severity: 'critical',
      dimension: 'truncation-risk',
      message: 'Unclosed markdown code fence',
      location: null,
    });
    subScores.push(0.2);
  }

  // 4. Abrupt ending patterns — hyphenated word break
  if (
    /\w-\s*$/.test(trimmed) &&
    trimmed.length > 1
  ) {
    signals.push({
      id: 'truncation-hyphenated-break',
      severity: 'critical',
      dimension: 'truncation-risk',
      message: 'Output ends with hyphenated word break',
      location: null,
    });
    subScores.push(0.1);
  }

  // 5. Content-length heuristic — promised list items vs actual
  const listMatch = output.match(/(?:here are|the following)\s+(\d+)/i);
  if (listMatch) {
    const promised = parseInt(listMatch[1], 10);
    const numberedItems = (output.match(/^\d+[.)]\s/gm) || []).length;
    if (promised > 0 && numberedItems > 0 && numberedItems < promised * 0.5) {
      signals.push({
        id: 'truncation-incomplete-list',
        severity: 'warning',
        dimension: 'truncation-risk',
        message: `Output promises ${promised} items but contains only ${numberedItems}`,
        location: null,
      });
      subScores.push(0.4);
    }
  }

  // Composite: use minimum (worst-case)
  const score = subScores.length > 0 ? Math.min(...subScores) : 1.0;

  return {
    score: Math.max(0, Math.min(1, score)),
    signals,
  };
}
