import type { DimensionResult, Signal, DetectedFormat } from '../types';
import { detectFormat } from '../utils/format-detect';
import { checkBracketBalance } from '../utils/bracket-balance';
import { lenientJsonParse } from '../utils/json-parse';

/**
 * Score the structural validity of an LLM output.
 *
 * Delegates to format-specific scoring functions based on the detected
 * (or caller-provided) output format. Returns a score from 0.0 (invalid)
 * to 1.0 (perfectly valid) along with diagnostic signals.
 */
export function scoreStructuralValidity(
  output: string,
  format?: string,
): DimensionResult {
  const detectedFormat: DetectedFormat =
    (format as DetectedFormat) || detectFormat(output);
  const signals: Signal[] = [];

  let score: number;
  switch (detectedFormat) {
    case 'json':
      score = scoreJson(output, signals);
      break;
    case 'markdown':
      score = scoreMarkdown(output, signals);
      break;
    case 'code':
      score = scoreCode(output, signals);
      break;
    case 'xml':
      score = scoreXml(output, signals);
      break;
    default:
      score = scoreText(output, signals);
      break;
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    signals,
  };
}

// ── JSON ──────────────────────────────────────────────────────────────────────

function scoreJson(output: string, signals: Signal[]): number {
  const result = lenientJsonParse(output);

  // Strict parse success.
  if (result.success && !result.lenient) {
    return 1.0;
  }

  // Lenient parse success (markdown fences stripped).
  if (result.success && result.lenient) {
    signals.push({
      id: 'json-lenient-parse',
      severity: 'warning',
      dimension: 'structural-validity',
      message: 'JSON required lenient parsing (markdown fences stripped)',
      location: null,
    });
    return 0.8;
  }

  // Failed parse — check for common issues.
  const trimmed = output.trim();

  if (/,\s*[}\]]/.test(trimmed)) {
    signals.push({
      id: 'json-trailing-comma',
      severity: 'warning',
      dimension: 'structural-validity',
      message: 'JSON contains trailing commas',
      location: null,
    });
    return 0.7;
  }

  if (/{\s*\w+\s*:/.test(trimmed)) {
    signals.push({
      id: 'json-unquoted-keys',
      severity: 'warning',
      dimension: 'structural-validity',
      message: 'JSON contains unquoted keys',
      location: null,
    });
    return 0.6;
  }

  if (/'[^']*'/.test(trimmed) && !/"[^"]*"/.test(trimmed)) {
    signals.push({
      id: 'json-single-quotes',
      severity: 'warning',
      dimension: 'structural-validity',
      message: 'JSON uses single quotes instead of double quotes',
      location: null,
    });
    return 0.6;
  }

  signals.push({
    id: 'json-unparseable',
    severity: 'critical',
    dimension: 'structural-validity',
    message: `JSON is completely unparseable: ${result.error}`,
    location: null,
  });
  return 0.0;
}

// ── Markdown ──────────────────────────────────────────────────────────────────

function scoreMarkdown(output: string, signals: Signal[]): number {
  let score = 1.0;

  // Code fence balance.
  const fenceCount = (output.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    signals.push({
      id: 'markdown-unclosed-fence',
      severity: 'critical',
      dimension: 'structural-validity',
      message: 'Unclosed code fence detected',
      location: null,
    });
    score -= 0.3;
  }

  // Heading hierarchy.
  const headings = [...output.matchAll(/^(#{1,6})\s/gm)].map(
    (m) => m[1].length,
  );
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      signals.push({
        id: 'markdown-skipped-heading',
        severity: 'info',
        dimension: 'structural-validity',
        message: `Heading level skipped from h${headings[i - 1]} to h${headings[i]}`,
        location: null,
      });
      score -= 0.05;
    }
  }

  return Math.max(0, score);
}

// ── Code ──────────────────────────────────────────────────────────────────────

function scoreCode(output: string, signals: Signal[]): number {
  let score = 1.0;

  const balance = checkBracketBalance(output);
  const unbalanced =
    Math.abs(balance.curly) +
    Math.abs(balance.square) +
    Math.abs(balance.round);

  if (unbalanced > 0) {
    signals.push({
      id: 'code-unbalanced-brackets',
      severity: 'critical',
      dimension: 'structural-validity',
      message: `Unbalanced brackets: {${balance.curly}} [${balance.square}] (${balance.round})`,
      location: null,
    });
    score -= 0.2 * unbalanced;
  }

  // Trailing incomplete constructs.
  const trimmed = output.trimEnd();
  if (/[=:,({]\s*$/.test(trimmed)) {
    signals.push({
      id: 'code-incomplete-construct',
      severity: 'warning',
      dimension: 'structural-validity',
      message: 'Code ends with incomplete construct',
      location: null,
    });
    score -= 0.1;
  }

  return Math.max(0, score);
}

// ── XML ───────────────────────────────────────────────────────────────────────

function scoreXml(output: string, signals: Signal[]): number {
  let score = 1.0;

  // Simple tag balance check.
  const openTags = [...output.matchAll(/<(\w+)[\s>]/g)].map((m) => m[1]);
  const closeTags = [...output.matchAll(/<\/(\w+)>/g)].map((m) => m[1]);
  const unclosed = openTags.length - closeTags.length;

  if (unclosed > 0) {
    signals.push({
      id: 'xml-unclosed-tags',
      severity: 'critical',
      dimension: 'structural-validity',
      message: `${unclosed} unclosed XML tag(s)`,
      location: null,
    });
    score -= 0.2 * unclosed;
  }

  return Math.max(0, score);
}

// ── Text ──────────────────────────────────────────────────────────────────────

function scoreText(output: string, signals: Signal[]): number {
  let score = 1.0;

  if (output.includes('\uFFFD')) {
    signals.push({
      id: 'text-replacement-chars',
      severity: 'info',
      dimension: 'structural-validity',
      message: 'Text contains Unicode replacement characters',
      location: null,
    });
    score -= 0.1;
  }

  // Check for excessive control characters.
  const controlCount = (
    output.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []
  ).length;
  if (controlCount > 0) {
    signals.push({
      id: 'text-control-chars',
      severity: 'info',
      dimension: 'structural-validity',
      message: `Text contains ${controlCount} control character(s)`,
      location: null,
    });
    score -= 0.1;
  }

  return Math.max(0, score);
}
