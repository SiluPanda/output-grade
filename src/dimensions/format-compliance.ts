import type { DimensionResult, Signal } from '../types';

/**
 * Score the format compliance of an LLM output.
 *
 * Determines the expected format from the explicit `format` option or by
 * detecting format instructions in the prompt. Then scores how well the
 * output complies with that expected format. Returns a score from 0.0
 * (completely non-compliant) to 1.0 (fully compliant) along with
 * diagnostic signals.
 *
 * When no expected format can be determined, returns 1.0 (neutral).
 */
export function scoreFormatCompliance(
  output: string,
  format?: string,
  prompt?: string,
): DimensionResult {
  const signals: Signal[] = [];
  const expected = format || detectExpectedFormat(prompt);

  if (!expected) {
    return { score: 1.0, signals };
  }

  let score: number;
  switch (expected) {
    case 'json':
      score = scoreJsonCompliance(output, signals);
      break;
    case 'markdown':
      score = scoreMarkdownCompliance(output, signals);
      break;
    case 'code':
      score = scoreCodeCompliance(output, signals);
      break;
    case 'xml':
      score = scoreXmlCompliance(output, signals);
      break;
    case 'list':
      score = scoreListCompliance(output, signals);
      break;
    case 'yaml':
      score = scoreYamlCompliance(output, signals);
      break;
    case 'table':
      score = scoreTableCompliance(output, signals);
      break;
    default:
      score = 1.0;
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    signals,
  };
}

// ── Format Detection from Prompt ─────────────────────────────────────────────

function detectExpectedFormat(prompt?: string): string | null {
  if (!prompt) return null;
  if (/\bjson\b/i.test(prompt)) return 'json';
  if (/\bmarkdown\b/i.test(prompt)) return 'markdown';
  if (/\b(code|function|implement)\b/i.test(prompt)) return 'code';
  if (/\bxml\b/i.test(prompt)) return 'xml';
  if (/\byaml\b/i.test(prompt)) return 'yaml';
  if (/\btable\b/i.test(prompt)) return 'table';
  if (/\b(list|bullet|enumerate)\b/i.test(prompt)) return 'list';
  return null;
}

// ── JSON ─────────────────────────────────────────────────────────────────────

function scoreJsonCompliance(output: string, signals: Signal[]): number {
  const trimmed = output.trim();

  // Pure JSON
  try {
    JSON.parse(trimmed);
    return 1.0;
  } catch {
    /* not pure JSON */
  }

  // JSON in code fence (newlines around content are optional)
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try {
      JSON.parse(fenceMatch[1].trim());
      signals.push({
        id: 'format-json-in-fence',
        severity: 'info',
        dimension: 'format-compliance',
        message: 'JSON wrapped in code fence',
        location: null,
      });
      return 0.9;
    } catch {
      /* fence content not valid JSON */
    }
  }

  // JSON extractable from prose
  const jsonMatch = trimmed.match(/[{[]([\s\S]*)[}\]]/);
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[0]);
      signals.push({
        id: 'format-json-in-prose',
        severity: 'warning',
        dimension: 'format-compliance',
        message: 'JSON embedded in prose',
        location: null,
      });
      return 0.7;
    } catch {
      /* extracted block not valid JSON */
    }
  }

  // No JSON found
  signals.push({
    id: 'format-no-json',
    severity: 'critical',
    dimension: 'format-compliance',
    message: 'Expected JSON but none found',
    location: null,
  });
  return 0.0;
}

// ── Markdown ─────────────────────────────────────────────────────────────────

function scoreMarkdownCompliance(output: string, signals: Signal[]): number {
  let indicators = 0;
  if (/^#{1,6}\s/m.test(output)) indicators++;
  if (/```/.test(output)) indicators++;
  if (/^[-*]\s/m.test(output)) indicators++;
  if (/\*\*.*\*\*/.test(output)) indicators++;
  if (/\[.*\]\(.*\)/.test(output)) indicators++;

  if (indicators >= 3) return 1.0;
  if (indicators >= 1) {
    signals.push({
      id: 'format-minimal-markdown',
      severity: 'info',
      dimension: 'format-compliance',
      message: `Minimal markdown formatting (${indicators} indicator(s))`,
      location: null,
    });
    return 0.7;
  }

  signals.push({
    id: 'format-no-markdown',
    severity: 'warning',
    dimension: 'format-compliance',
    message: 'Expected markdown but no formatting detected',
    location: null,
  });
  return 0.3;
}

// ── Code ─────────────────────────────────────────────────────────────────────

function scoreCodeCompliance(output: string, signals: Signal[]): number {
  if (/```[\s\S]*```/.test(output)) return 1.0;

  if (/\b(function|const|class|def|import|export|return)\b/.test(output)) {
    signals.push({
      id: 'format-code-no-fence',
      severity: 'info',
      dimension: 'format-compliance',
      message: 'Code detected but not wrapped in code fence',
      location: null,
    });
    return 0.8;
  }

  signals.push({
    id: 'format-no-code',
    severity: 'warning',
    dimension: 'format-compliance',
    message: 'Expected code but none detected',
    location: null,
  });
  return 0.0;
}

// ── XML ──────────────────────────────────────────────────────────────────────

function scoreXmlCompliance(output: string, signals: Signal[]): number {
  if (/<\w+[\s>][\s\S]*<\/\w+>/.test(output)) return 1.0;

  if (/<\w+/.test(output)) {
    signals.push({
      id: 'format-partial-xml',
      severity: 'warning',
      dimension: 'format-compliance',
      message: 'Partial XML detected (opening tags without closing)',
      location: null,
    });
    return 0.5;
  }

  signals.push({
    id: 'format-no-xml',
    severity: 'warning',
    dimension: 'format-compliance',
    message: 'Expected XML but none detected',
    location: null,
  });
  return 0.0;
}

// ── YAML ─────────────────────────────────────────────────────────────────────

function scoreYamlCompliance(output: string, signals: Signal[]): number {
  // YAML key: value patterns
  const yamlLines = output.split('\n').filter((l) => /^\s*\w[\w\s]*:\s/.test(l));

  if (yamlLines.length >= 2) return 1.0;

  if (yamlLines.length === 1) {
    signals.push({
      id: 'format-partial-yaml',
      severity: 'info',
      dimension: 'format-compliance',
      message: 'Minimal YAML detected (single key-value)',
      location: null,
    });
    return 0.5;
  }

  signals.push({
    id: 'format-no-yaml',
    severity: 'warning',
    dimension: 'format-compliance',
    message: 'Expected YAML but no key-value patterns found',
    location: null,
  });
  return 0.0;
}

// ── Table ────────────────────────────────────────────────────────────────────

function scoreTableCompliance(output: string, signals: Signal[]): number {
  // Markdown table (pipe-delimited)
  if (/\|.*\|/.test(output) && /\|[-:]+\|/.test(output)) return 1.0;

  // Tab-separated data (multiple lines with tabs)
  const tsvLines = output.split('\n').filter((l) => l.includes('\t'));
  if (tsvLines.length >= 2) return 1.0;

  // List found instead of table
  if (/^[-*]\s/m.test(output) || /^\d+[.)]\s/m.test(output)) {
    signals.push({
      id: 'format-list-not-table',
      severity: 'info',
      dimension: 'format-compliance',
      message: 'List found instead of expected table',
      location: null,
    });
    return 0.4;
  }

  signals.push({
    id: 'format-no-table',
    severity: 'warning',
    dimension: 'format-compliance',
    message: 'Expected table but none detected',
    location: null,
  });
  return 0.0;
}

// ── List ─────────────────────────────────────────────────────────────────────

function scoreListCompliance(output: string, signals: Signal[]): number {
  // Bullet or numbered list
  if (/^[-*]\s/m.test(output) || /^\d+[.)]\s/m.test(output)) return 1.0;

  // Paragraphs (multiple paragraphs separated by blank lines)
  if (/\n\n/.test(output.trim())) {
    signals.push({
      id: 'format-paragraphs-not-list',
      severity: 'info',
      dimension: 'format-compliance',
      message: 'Paragraphs found instead of expected list',
      location: null,
    });
    return 0.3;
  }

  signals.push({
    id: 'format-no-list',
    severity: 'warning',
    dimension: 'format-compliance',
    message: 'Expected list but none detected',
    location: null,
  });
  return 0.0;
}
