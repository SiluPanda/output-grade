// ── Primitives ───────────────────────────────────────────────────────────────

/** Signal severity level. */
export type Severity = 'info' | 'warning' | 'critical';

/** Expected output format. */
export type OutputFormat =
  | 'json'
  | 'markdown'
  | 'code'
  | 'xml'
  | 'yaml'
  | 'text'
  | 'table'
  | 'list';

/** Detected output format (subset of OutputFormat, always resolved). */
export type DetectedFormat = 'json' | 'markdown' | 'code' | 'xml' | 'text';

/** Unique identifier for a grading dimension. */
export type DimensionId =
  | 'schema-completeness'
  | 'structural-validity'
  | 'content-coherence'
  | 'hallucination-risk'
  | 'truncation-risk'
  | 'refusal-detection'
  | 'relevance'
  | 'format-compliance';

// ── Signal ───────────────────────────────────────────────────────────────────

/** Location of a signal in the output text. */
export interface SignalLocation {
  /** Start character offset (0-based). */
  start: number;

  /** End character offset (exclusive). */
  end: number;
}

/** A single signal detected during grading. */
export interface Signal {
  /** Unique signal identifier (e.g., 'missing-required-field', 'hedging-phrase'). */
  id: string;

  /** Severity level. */
  severity: Severity;

  /** The dimension this signal belongs to. */
  dimension: string;

  /** Human-readable description. */
  message: string;

  /** Location in the output text, if applicable. */
  location: SignalLocation | null;
}

// ── Dimension Result ─────────────────────────────────────────────────────────

/** Result of a per-dimension scoring function. */
export interface DimensionResult {
  /** The dimension score, 0.0 to 1.0. */
  score: number;

  /** Signals detected for this dimension. */
  signals: Signal[];
}

/** Per-dimension score breakdown. */
export interface DimensionScores {
  'schema-completeness': number;
  'structural-validity': number;
  'content-coherence': number;
  'hallucination-risk': number;
  'truncation-risk': number;
  'refusal-detection': number;
  'relevance': number;
  'format-compliance': number;
}

// ── Grade Report ─────────────────────────────────────────────────────────────

/** Metadata about the grading process. */
export interface GradeMeta {
  /** Time taken to compute the grade, in milliseconds. */
  durationMs: number;

  /** The weights used for composite score calculation. */
  weights: Record<string, number>;

  /** Which dimensions were applicable (non-zero weight). */
  applicableDimensions: string[];

  /** Whether any critical floor was triggered, and which one. null if none. */
  criticalFloorTriggered: string | null;

  /** The detected format of the output. */
  detectedFormat: DetectedFormat;

  /** Output character count. */
  outputLength: number;
}

/** The complete grade report returned by grade(). */
export interface GradeReport {
  /** Composite quality score, 0.0 (worst) to 1.0 (best). */
  score: number;

  /** Whether the composite score meets or exceeds the pass threshold. */
  pass: boolean;

  /** The pass threshold used for the pass/fail determination. */
  passThreshold: number;

  /** Per-dimension scores. Keys are dimension IDs, values are 0-1 scores. */
  dimensions: DimensionScores;

  /** All signals detected during grading, across all dimensions. */
  signals: Signal[];

  /** Human-readable summary of the grade (1-3 sentences). */
  summary: string;

  /** Metadata about the grading process. */
  meta: GradeMeta;
}

// ── Options ──────────────────────────────────────────────────────────────────

/** Simplified JSON Schema type for schema completeness scoring. */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/** Options for the grade() function. */
export interface GradeOptions {
  /** The original prompt, for relevance scoring. */
  prompt?: string;

  /** JSON Schema for schema completeness scoring. */
  schema?: JsonSchema;

  /** Expected output for similarity comparison. */
  expected?: string;

  /** Expected format of the output. */
  format?: OutputFormat;

  /** Custom dimension weights (overrides defaults). */
  weights?: Partial<Record<string, number>>;

  /** Pass/fail threshold. Default: 0.7. */
  passThreshold?: number;

  /** Critical dimension floor overrides. */
  criticalFloors?: Record<string, { threshold: number; ceiling: number }>;
}

// ── Grader Instance ──────────────────────────────────────────────────────────

/**
 * Configuration for createGrader(). Contains reusable settings.
 * Per-call settings (prompt, schema, expected, format) are passed to grade().
 */
export interface GraderConfig extends Omit<GradeOptions, 'prompt' | 'schema' | 'expected' | 'format'> {
  // Intentionally empty: all fields inherited from Omit<GradeOptions, ...>
}

/** A preconfigured grader instance. */
export interface Grader {
  /** Grade output using this instance's configuration plus per-call options. */
  grade(output: string, options?: GradeOptions): GradeReport;

  /** Grade schema completeness only. */
  gradeSchema(output: string, schema: JsonSchema): DimensionResult;

  /** Grade structural validity only. */
  gradeStructure(output: string, format?: string): DimensionResult;

  /** Grade content coherence only. */
  gradeCoherence(output: string): DimensionResult;

  /** Detect hallucination risk indicators. */
  detectHallucinations(output: string): DimensionResult;

  /** Detect truncation indicators. */
  detectTruncation(output: string): DimensionResult;

  /** Detect refusal. */
  detectRefusal(output: string): DimensionResult;

  /** Grade relevance to prompt. */
  gradeRelevance(output: string, prompt: string): DimensionResult;

  /** Grade format compliance. */
  gradeFormatCompliance(output: string, format: string): DimensionResult;

  /** The configuration this grader was created with. */
  readonly config: GraderConfig;
}
