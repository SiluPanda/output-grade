import type {
  GradeReport,
  GradeOptions,
  DimensionResult,
  DimensionId,
  DimensionScores,
  GradeMeta,
  Signal,
  DetectedFormat,
} from './types';
import {
  DEFAULT_WEIGHTS,
  CRITICAL_FLOORS,
  DEFAULT_PASS_THRESHOLD,
  redistributeWeights,
} from './defaults';
import { detectFormat } from './utils/format-detect';
import { scoreStructuralValidity } from './dimensions/structural-validity';
import { scoreTruncationRisk } from './dimensions/truncation-risk';
import { scoreRefusalDetection } from './dimensions/refusal-detection';
import { scoreContentCoherence } from './dimensions/content-coherence';
import { scoreHallucinationRisk } from './dimensions/hallucination-risk';
import { scoreSchemaCompleteness } from './dimensions/schema-completeness';
import { scoreRelevance } from './dimensions/relevance';
import { scoreFormatCompliance } from './dimensions/format-compliance';

/**
 * Grade an LLM output across all 8 quality dimensions.
 *
 * Runs structural validity, truncation risk, refusal detection, content
 * coherence, hallucination risk, schema completeness, relevance, and
 * format compliance. Computes a weighted composite score with critical
 * floor capping and returns a complete GradeReport.
 *
 * Dimensions that lack required inputs (schema, prompt, format) are
 * excluded and their weights redistributed proportionally.
 */
export function grade(output: string, options: GradeOptions = {}): GradeReport {
  const startTime = Date.now();

  // Handle empty/null/undefined input
  if (!output || output.trim().length === 0) {
    return buildEmptyReport(startTime, options);
  }

  // Detect format
  const detectedFormat: DetectedFormat = detectFormat(output);

  // Determine excluded dimensions
  const excluded: DimensionId[] = [];
  if (!options.schema) excluded.push('schema-completeness');
  if (!options.prompt) excluded.push('relevance');
  if (!options.format && !options.prompt) excluded.push('format-compliance');

  const weights = redistributeWeights(
    options.weights
      ? mergeWeights(options.weights)
      : DEFAULT_WEIGHTS,
    excluded,
  );

  // Run all dimensions
  const results: Record<DimensionId, DimensionResult> = {
    'structural-validity': scoreStructuralValidity(output, options.format),
    'truncation-risk': scoreTruncationRisk(output, options.format),
    'refusal-detection': scoreRefusalDetection(output, options.prompt),
    'content-coherence': scoreContentCoherence(output, options.format),
    'hallucination-risk': scoreHallucinationRisk(output),
    'schema-completeness': options.schema
      ? scoreSchemaCompleteness(output, options.schema)
      : { score: 1.0, signals: [] },
    'relevance': options.prompt
      ? scoreRelevance(output, options.prompt, options.expected)
      : { score: 1.0, signals: [] },
    'format-compliance': (options.format || options.prompt)
      ? scoreFormatCompliance(output, options.format, options.prompt)
      : { score: 1.0, signals: [] },
  };

  // Build dimension scores
  const dimensions: DimensionScores = {
    'schema-completeness': results['schema-completeness'].score,
    'structural-validity': results['structural-validity'].score,
    'content-coherence': results['content-coherence'].score,
    'hallucination-risk': results['hallucination-risk'].score,
    'truncation-risk': results['truncation-risk'].score,
    'refusal-detection': results['refusal-detection'].score,
    'relevance': results['relevance'].score,
    'format-compliance': results['format-compliance'].score,
  };

  // Compute weighted average composite
  let composite = 0;
  let totalWeight = 0;
  for (const id of Object.keys(weights) as DimensionId[]) {
    const w = weights[id];
    composite += results[id].score * w;
    totalWeight += w;
  }
  composite = totalWeight > 0 ? composite / totalWeight : 0;

  // Critical floor capping
  const floors = options.criticalFloors ?? CRITICAL_FLOORS;
  let criticalFloorTriggered: string | null = null;
  for (const [dimId, floor] of Object.entries(floors)) {
    if (
      floor &&
      results[dimId as DimensionId] &&
      results[dimId as DimensionId].score < floor.threshold
    ) {
      if (composite > floor.ceiling) {
        composite = floor.ceiling;
        criticalFloorTriggered = dimId;
      }
    }
  }

  composite = Math.max(0, Math.min(1, composite));

  // Determine applicable dimensions
  const applicableDimensions = (Object.keys(weights) as DimensionId[]).filter(
    (id) => weights[id] > 0,
  );

  // Collect and order signals
  const allSignals = orderSignals(
    Object.values(results).flatMap((r) => r.signals),
  );

  // Pass/fail
  const passThreshold = options.passThreshold ?? DEFAULT_PASS_THRESHOLD;
  const pass = composite >= passThreshold;

  // Summary
  const summary = generateSummary(composite, allSignals);

  // Meta
  const meta: GradeMeta = {
    durationMs: Date.now() - startTime,
    weights: { ...weights },
    applicableDimensions,
    criticalFloorTriggered,
    detectedFormat,
    outputLength: output.length,
  };

  return {
    score: composite,
    pass,
    passThreshold,
    dimensions,
    signals: allSignals,
    summary,
    meta,
  };
}

// ── Empty Input Report ───────────────────────────────────────────────────────

function buildEmptyReport(
  startTime: number,
  options: GradeOptions,
): GradeReport {
  const passThreshold = options.passThreshold ?? DEFAULT_PASS_THRESHOLD;
  const emptySignal: Signal = {
    id: 'empty-output',
    severity: 'critical',
    dimension: 'grade',
    message: 'Output is empty or whitespace-only',
    location: null,
  };

  const dimensions: DimensionScores = {
    'schema-completeness': 0,
    'structural-validity': 0,
    'content-coherence': 0,
    'hallucination-risk': 0,
    'truncation-risk': 0,
    'refusal-detection': 0,
    'relevance': 0,
    'format-compliance': 0,
  };

  return {
    score: 0,
    pass: false,
    passThreshold,
    dimensions,
    signals: [emptySignal],
    summary: 'Poor quality output: 1 critical issue. Output is empty or whitespace-only. Retry recommended.',
    meta: {
      durationMs: Date.now() - startTime,
      weights: { ...DEFAULT_WEIGHTS },
      applicableDimensions: [],
      criticalFloorTriggered: null,
      detectedFormat: 'text',
      outputLength: 0,
    },
  };
}

// ── Weight Merging ───────────────────────────────────────────────────────────

function mergeWeights(
  custom: Partial<Record<string, number>>,
): Record<DimensionId, number> {
  return {
    ...DEFAULT_WEIGHTS,
    ...custom,
  } as Record<DimensionId, number>;
}

// ── Signal Ordering ──────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const DIMENSION_ORDER: Record<string, number> = {
  'refusal-detection': 0,
  'truncation-risk': 1,
  'structural-validity': 2,
  'schema-completeness': 3,
  'hallucination-risk': 4,
  'content-coherence': 5,
  'relevance': 6,
  'format-compliance': 7,
  'grade': 8,
};

function orderSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => {
    // 1. Severity (critical first)
    const sevDiff =
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3);
    if (sevDiff !== 0) return sevDiff;

    // 2. Dimension order
    const dimDiff =
      (DIMENSION_ORDER[a.dimension] ?? 9) -
      (DIMENSION_ORDER[b.dimension] ?? 9);
    if (dimDiff !== 0) return dimDiff;

    // 3. Location (earlier first)
    const aStart = a.location?.start ?? Infinity;
    const bStart = b.location?.start ?? Infinity;
    return aStart - bStart;
  });
}

// ── Summary Generation ───────────────────────────────────────────────────────

function generateSummary(score: number, signals: Signal[]): string {
  const criticalSignals = signals.filter((s) => s.severity === 'critical');
  const warningSignals = signals.filter((s) => s.severity === 'warning');
  const issueCount = criticalSignals.length + warningSignals.length;

  // Top issues: up to 3 most severe
  const topIssues = [...criticalSignals, ...warningSignals]
    .slice(0, 3)
    .map((s) => s.message);

  if (score >= 0.9) {
    if (issueCount === 0) {
      return 'High quality output, no significant issues detected.';
    }
    return `High quality output with ${issueCount} minor issue(s).`;
  }

  if (score >= 0.7) {
    const issueList = topIssues.length > 0 ? ` ${topIssues.join('; ')}.` : '';
    return `Acceptable quality, ${issueCount} issue(s).${issueList}`;
  }

  if (score >= 0.4) {
    const issueList = topIssues.length > 0 ? ` ${topIssues.join('; ')}.` : '';
    return `Questionable quality, ${issueCount} issue(s).${issueList} Consider retrying.`;
  }

  const issueList = topIssues.length > 0 ? ` ${topIssues.join('; ')}.` : '';
  return `Poor quality output: ${issueCount} critical issue(s).${issueList} Retry recommended.`;
}
