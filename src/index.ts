// output-grade - Heuristic LLM output quality scoring without calling another LLM

export type {
  Severity,
  OutputFormat,
  DetectedFormat,
  DimensionId,
  SignalLocation,
  Signal,
  DimensionResult,
  DimensionScores,
  GradeMeta,
  GradeReport,
  JsonSchema,
  CustomPatterns,
  GradeOptions,
  GraderConfig,
  Grader,
} from './types';

export {
  DEFAULT_WEIGHTS,
  CRITICAL_FLOORS,
  DEFAULT_PASS_THRESHOLD,
  redistributeWeights,
} from './defaults';

export type { CriticalFloorConfig } from './defaults';

// ── Utilities ────────────────────────────────────────────────────────────────

export { tokenize } from './utils/tokenizer';
export { splitSentences } from './utils/sentences';
export { computeNgrams, repetitionRatio } from './utils/ngrams';
export { detectFormat } from './utils/format-detect';
export { checkBracketBalance } from './utils/bracket-balance';
export { lenientJsonParse } from './utils/json-parse';

export type { BracketBalance } from './utils/bracket-balance';
export type { JsonParseResult } from './utils/json-parse';

// ── Pattern Catalogs ────────────────────────────────────────────────────────

export { HEDGING_PATTERNS } from './patterns/hedging';
export type { PatternEntry } from './patterns/hedging';
export { REFUSAL_PATTERNS } from './patterns/refusal';
export { CONFIDENCE_PATTERNS } from './patterns/confidence';
export { STOPWORDS, removeStopwords } from './patterns/stopwords';

// ── Grading Dimensions ──────────────────────────────────────────────────────

export { scoreStructuralValidity } from './dimensions/structural-validity';
export { scoreTruncationRisk } from './dimensions/truncation-risk';
export { scoreRefusalDetection } from './dimensions/refusal-detection';
export { scoreContentCoherence } from './dimensions/content-coherence';
