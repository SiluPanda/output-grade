# output-grade

Heuristic LLM output quality scoring without calling another LLM.

[![npm version](https://img.shields.io/npm/v/output-grade.svg)](https://www.npmjs.com/package/output-grade)
[![npm downloads](https://img.shields.io/npm/dt/output-grade.svg)](https://www.npmjs.com/package/output-grade)
[![license](https://img.shields.io/npm/l/output-grade.svg)](https://github.com/SiluPanda/output-grade/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/output-grade.svg)](https://nodejs.org/)
[![types](https://img.shields.io/npm/types/output-grade.svg)](https://www.npmjs.com/package/output-grade)

---

## Description

`output-grade` evaluates LLM outputs across eight quality dimensions using fast, deterministic heuristics. It produces a composite 0--1 confidence score, per-dimension breakdowns, and granular diagnostic signals -- all without calling a second LLM, requiring API keys, or making any network requests.

The eight dimensions scored are:

| Dimension | What it measures |
|---|---|
| **structural-validity** | Syntactic correctness (valid JSON, balanced brackets, well-formed markdown/XML/code) |
| **content-coherence** | Lexical diversity, n-gram repetition, sentence repetition, degenerate output detection |
| **hallucination-risk** | Hedging language density, confidence inflation, suspicious URLs, self-contradictions |
| **truncation-risk** | Unclosed brackets, incomplete endings, unclosed fences, abrupt breaks, missing list items |
| **refusal-detection** | Direct refusals, policy citations, safety refusals, capability limitations, identity disclosures |
| **schema-completeness** | Required/optional field presence, type correctness, emptiness checks against a JSON Schema |
| **relevance** | Keyword overlap with prompt, structural alignment, topic drift, length reasonableness |
| **format-compliance** | Whether the output matches the expected format (JSON, markdown, code, XML, YAML, table, list) |

Dimension scores are combined into a single composite score using a configurable weighted average with critical-dimension floor capping. A pass/fail determination is made against a configurable threshold (default: 0.7).

**Zero runtime dependencies.** All heuristics are implemented with built-in JavaScript capabilities. Typical scoring runs in sub-millisecond time.

---

## Installation

```bash
npm install output-grade
```

Requires Node.js 18 or later.

---

## Quick Start

```typescript
import { grade } from 'output-grade';

// Basic grading -- only the output text is required
const report = grade('The capital of France is Paris.');
console.log(report.score);    // 0.0 - 1.0 composite score
console.log(report.pass);     // true if score >= 0.7
console.log(report.summary);  // human-readable summary

// Context-aware grading with prompt, schema, and format
const report = grade('{"title":"Guide","body":"..."}', {
  prompt: 'Write a JSON guide about quantum computing',
  schema: { type: 'object', required: ['title', 'body'], properties: {
    title: { type: 'string' },
    body: { type: 'string' },
  }},
  format: 'json',
  passThreshold: 0.8,
});

console.log(report.dimensions);  // per-dimension score breakdown
console.log(report.signals);     // array of diagnostic signals
```

---

## Features

- **Eight quality dimensions** scored independently, then combined into a single composite.
- **Critical floor capping** -- if structural-validity, truncation-risk, or refusal-detection scores fall below their threshold, the composite score is capped regardless of other dimensions.
- **Automatic format detection** for JSON, XML, markdown, code, and plain text.
- **Granular diagnostic signals** with severity levels (`info`, `warning`, `critical`), human-readable messages, and character-offset locations.
- **Preconfigured grader factory** (`createGrader`) for reusable configuration across multiple calls.
- **CLI tool** for shell scripts, CI/CD pipelines, and one-off evaluation.
- **Zero runtime dependencies** -- no API keys, no network access, no external models.
- **Full TypeScript support** with exported types for every interface and union.
- **Sub-millisecond performance** on typical LLM outputs.
- **Deterministic** -- the same input always produces the same score.

---

## API Reference

### `grade(output, options?)`

Grade an LLM output across all eight quality dimensions. Returns a `GradeReport`.

```typescript
import { grade } from 'output-grade';

const report = grade(output, options);
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `output` | `string` | Yes | The raw LLM output text to grade. |
| `options` | `GradeOptions` | No | Configuration for context-aware grading. |

**`GradeOptions` fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `prompt` | `string` | -- | Original prompt, enables relevance and format-compliance scoring. |
| `schema` | `JsonSchema` | -- | JSON Schema, enables schema-completeness scoring. |
| `expected` | `string` | -- | Expected output for similarity comparison in relevance scoring. |
| `format` | `OutputFormat` | -- | Expected output format (`'json'`, `'markdown'`, `'code'`, `'xml'`, `'yaml'`, `'text'`, `'table'`, `'list'`). |
| `weights` | `Partial<Record<string, number>>` | `DEFAULT_WEIGHTS` | Custom dimension weights (merged with defaults). |
| `passThreshold` | `number` | `0.7` | Score threshold for the pass/fail determination. |
| `criticalFloors` | `Record<string, { threshold: number; ceiling: number }>` | `CRITICAL_FLOORS` | Per-dimension critical floor overrides. |
| `customPatterns` | `CustomPatterns` | -- | Additional hedging, refusal, or preamble patterns. |
| `stopwords` | `string[]` | -- | Custom stopwords for relevance scoring. |

Dimensions that lack required inputs (`schema`, `prompt`, `format`) are excluded automatically and their weights redistributed proportionally among active dimensions.

**Returns: `GradeReport`**

```typescript
interface GradeReport {
  score: number;              // Composite quality score, 0.0 to 1.0
  pass: boolean;              // Whether score >= passThreshold
  passThreshold: number;      // The threshold used
  dimensions: DimensionScores; // Per-dimension 0-1 scores
  signals: Signal[];          // All detected signals, ordered by severity
  summary: string;            // Human-readable summary (1-3 sentences)
  meta: GradeMeta;            // Duration, weights, detected format, etc.
}
```

---

### `createGrader(config?)`

Create a preconfigured grader instance that stores reusable configuration (weights, thresholds, custom patterns, stopwords). Per-call options passed to the instance's `grade()` method take precedence over instance config.

```typescript
import { createGrader } from 'output-grade';

const grader = createGrader({
  weights: { 'structural-validity': 0.30, 'content-coherence': 0.20 },
  passThreshold: 0.8,
});

const report = grader.grade(output, { prompt: 'Explain X', format: 'json' });
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `config` | `GraderConfig` | No | Reusable configuration. Supports `weights`, `passThreshold`, `criticalFloors`, `customPatterns`, `stopwords`. |

**Returns: `Grader`**

The `Grader` interface exposes the composite grader and per-dimension convenience methods:

| Method | Signature | Description |
|---|---|---|
| `grade` | `(output: string, options?: GradeOptions) => GradeReport` | Full composite grading. |
| `gradeSchema` | `(output: string, schema: JsonSchema) => DimensionResult` | Schema completeness only. |
| `gradeStructure` | `(output: string, format?: string) => DimensionResult` | Structural validity only. |
| `gradeCoherence` | `(output: string) => DimensionResult` | Content coherence only. |
| `detectHallucinations` | `(output: string) => DimensionResult` | Hallucination risk only. |
| `detectTruncation` | `(output: string) => DimensionResult` | Truncation risk only. |
| `detectRefusal` | `(output: string) => DimensionResult` | Refusal detection only. |
| `gradeRelevance` | `(output: string, prompt: string) => DimensionResult` | Relevance to prompt only. |
| `gradeFormatCompliance` | `(output: string, format: string) => DimensionResult` | Format compliance only. |
| `config` | `readonly GraderConfig` | The frozen configuration. |

Each per-dimension method returns a `DimensionResult`:

```typescript
interface DimensionResult {
  score: number;    // 0.0 to 1.0
  signals: Signal[]; // Signals detected for this dimension
}
```

---

### Individual Dimension Scorers

Each dimension scorer is exported independently for direct use without the composite grading pipeline.

#### `scoreStructuralValidity(output, format?)`

Score syntactic correctness. Delegates to format-specific checks: JSON parseability, markdown fence balance and heading hierarchy, code bracket balance, XML tag balance, text encoding validity.

```typescript
import { scoreStructuralValidity } from 'output-grade';

const result = scoreStructuralValidity('{"key": "value"}', 'json');
// result.score === 1.0
```

#### `scoreTruncationRisk(output, format?)`

Detect truncation indicators: unclosed brackets, incomplete sentence endings, unclosed markdown fences, hyphenated word breaks, incomplete list counts. Uses minimum (worst-case) sub-score.

```typescript
import { scoreTruncationRisk } from 'output-grade';

const result = scoreTruncationRisk('Here are 5 items:\n1. First\n2. Second');
// result.score < 1.0 (incomplete list detected)
```

#### `scoreRefusalDetection(output, prompt?)`

Detect refusals: direct refusal, policy citation, safety refusal, capability limitation, redirect, and identity disclosure. Classifies as full refusal (0.0), partial refusal (0.3--0.9), or no refusal (1.0).

```typescript
import { scoreRefusalDetection } from 'output-grade';

const result = scoreRefusalDetection("I can't help with that.");
// result.score === 0.0 (full refusal)
```

#### `scoreContentCoherence(output, format?)`

Evaluate coherence: degenerate output detection (empty, single-char repeat, high special-char ratio), n-gram repetition, sentence repetition, sliding-window block repetition, lexical diversity (TTR), and sentence structure.

```typescript
import { scoreContentCoherence } from 'output-grade';

const result = scoreContentCoherence('This is a well-written paragraph.');
// result.score close to 1.0
```

#### `scoreHallucinationRisk(output)`

Evaluate hallucination risk: hedging language density, confidence inflation, suspicious/fabricated URLs, and self-contradiction patterns. Uses minimum (worst-case) sub-score.

```typescript
import { scoreHallucinationRisk } from 'output-grade';

const result = scoreHallucinationRisk('I think probably this might be correct.');
// result.score < 1.0 (hedging detected)
```

#### `scoreSchemaCompleteness(output, schema?)`

Check required/optional field presence, type correctness, and emptiness against a JSON Schema. Returns 1.0 (neutral) when no schema is provided. Returns 0.0 when the output is not valid JSON.

```typescript
import { scoreSchemaCompleteness } from 'output-grade';

const result = scoreSchemaCompleteness(
  '{"title":"Guide"}',
  { type: 'object', required: ['title', 'body'], properties: {
    title: { type: 'string' },
    body: { type: 'string' },
  }},
);
// result.score < 1.0 (missing required field "body")
```

#### `scoreRelevance(output, prompt?, expected?)`

Evaluate relevance to the original prompt: keyword overlap, structural alignment (list/JSON/code detection in prompt vs output), topic drift, length reasonableness, and optional expected-output Jaccard similarity.

```typescript
import { scoreRelevance } from 'output-grade';

const result = scoreRelevance(
  'Quantum computing uses qubits...',
  'Explain quantum computing',
);
// result.score reflects keyword overlap and structural alignment
```

#### `scoreFormatCompliance(output, format?, prompt?)`

Check whether the output matches the expected format. Detects expected format from the explicit `format` argument or by parsing format instructions in the prompt. Supports `json`, `markdown`, `code`, `xml`, `yaml`, `table`, and `list`.

```typescript
import { scoreFormatCompliance } from 'output-grade';

const result = scoreFormatCompliance('{"key":"value"}', 'json');
// result.score === 1.0
```

---

### Utility Functions

Low-level utility functions used internally are exported for direct use.

#### `tokenize(text)`

Whitespace tokenizer. Splits on whitespace, strips leading/trailing punctuation, lowercases.

```typescript
import { tokenize } from 'output-grade';

tokenize('Hello World, this is a Test.');
// ['hello', 'world', 'this', 'is', 'a', 'test']
```

#### `splitSentences(text)`

Splits text on sentence-ending punctuation (`.`, `!`, `?`) followed by whitespace and an uppercase letter.

```typescript
import { splitSentences } from 'output-grade';

splitSentences('Hello world. This is great! Is it?');
// ['Hello world.', 'This is great!', 'Is it?']
```

#### `computeNgrams(tokens, n?)`

Compute n-gram frequency distribution. Returns a `Map<string, number>`. Default `n` is 3 (trigrams).

```typescript
import { computeNgrams } from 'output-grade';

const freq = computeNgrams(['the', 'quick', 'brown', 'fox'], 3);
// Map { 'the quick brown' => 1, 'quick brown fox' => 1 }
```

#### `repetitionRatio(tokens, n?)`

Fraction of unique n-grams that appear more than once. Returns 0.0--1.0. Default `n` is 3.

```typescript
import { repetitionRatio } from 'output-grade';

repetitionRatio(['a', 'b', 'c', 'a', 'b', 'c'], 3);
// > 0 (repetition detected)
```

#### `detectFormat(output)`

Auto-detect output format. Returns `'json'`, `'xml'`, `'markdown'`, or `'text'`.

```typescript
import { detectFormat } from 'output-grade';

detectFormat('{"key": "value"}');  // 'json'
detectFormat('# Hello\nText');     // 'markdown'
detectFormat('<root></root>');     // 'xml'
detectFormat('Plain text.');       // 'text'
```

#### `checkBracketBalance(text)`

Check bracket balance for `{}`, `[]`, `()`, and `<>`. Returns a `BracketBalance` object with per-type balance counts and maximum nesting depth.

```typescript
import { checkBracketBalance } from 'output-grade';

checkBracketBalance('{ [ ] }');
// { curly: 0, square: 0, round: 0, angle: 0, maxDepth: 2 }

checkBracketBalance('{ [');
// { curly: 1, square: 1, round: 0, angle: 0, maxDepth: 2 }
```

#### `lenientJsonParse(text)`

Attempt strict JSON parse first. On failure, strip markdown code fences and retry. Returns a `JsonParseResult`.

```typescript
import { lenientJsonParse } from 'output-grade';

lenientJsonParse('```json\n{"key": "value"}\n```');
// { success: true, value: { key: 'value' }, lenient: true }

lenientJsonParse('not json');
// { success: false, error: '...' }
```

#### `extractUrls(text)`

Extract URLs with character offsets and suspicion flags. Flags URLs with known example/placeholder domains, deeply nested paths (5+ segments), all-numeric TLDs, or implausibly long TLDs.

```typescript
import { extractUrls } from 'output-grade';

extractUrls('Visit https://example.com/page for info.');
// [{ url: 'https://example.com/page', start: 6, end: 31, suspicious: true, reason: 'example domain' }]
```

#### `extractDates(text, futureHorizonYears?)`

Extract dates in four formats (ISO `YYYY-MM-DD`, US `MM/DD/YYYY`, `Month DD, YYYY`, `DD Month YYYY`) with character offsets and validity flags. Detects impossible dates, out-of-range years, and future dates beyond `futureHorizonYears` (default: 2).

```typescript
import { extractDates } from 'output-grade';

extractDates('Released 2024-01-15. Event on February 30, 2024.');
// [
//   { date: '2024-01-15', start: 9, end: 19, valid: true },
//   { date: 'February 30, 2024', start: 30, end: 47, valid: false, reason: 'impossible date' }
// ]
```

#### `removeStopwords(tokens)`

Filter common English stopwords from a token array.

```typescript
import { removeStopwords } from 'output-grade';

removeStopwords(['the', 'quick', 'brown', 'fox', 'is', 'a', 'test']);
// ['quick', 'brown', 'fox', 'test']
```

---

### Pattern Catalogs

Built-in pattern catalogs are exported for inspection or extension.

#### `HEDGING_PATTERNS`

Array of `PatternEntry` objects matching hedging language: belief qualifiers ("I think", "I believe"), possibility markers ("probably", "perhaps", "might"), approximation markers ("approximately", "roughly"), uncertainty disclaimers, and knowledge-cutoff references.

#### `REFUSAL_PATTERNS`

Array of `PatternEntry` objects matching refusal language: direct refusals ("I cannot help"), policy citations, safety refusals, identity disclosures ("As an AI"), capability limitations, and redirects ("please consult a professional").

#### `CONFIDENCE_PATTERNS`

Array of `PatternEntry` objects matching confidence inflation: "definitely", "certainly", "without a doubt", "100%", "guaranteed", "always", "never", "absolutely".

#### `STOPWORDS`

`Set<string>` of common English stopwords (articles, prepositions, conjunctions, pronouns, common verbs).

**`PatternEntry` interface:**

```typescript
interface PatternEntry {
  pattern: RegExp;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  label: string;
}
```

---

### Constants

#### `DEFAULT_WEIGHTS`

Default dimension weights (sum to 1.0):

| Dimension | Weight |
|---|---|
| `schema-completeness` | 0.20 |
| `structural-validity` | 0.20 |
| `content-coherence` | 0.15 |
| `hallucination-risk` | 0.15 |
| `truncation-risk` | 0.10 |
| `refusal-detection` | 0.10 |
| `relevance` | 0.05 |
| `format-compliance` | 0.05 |

#### `CRITICAL_FLOORS`

Default critical-dimension floors. When a dimension's score falls below its threshold, the composite score is capped at the ceiling:

| Dimension | Threshold | Ceiling |
|---|---|---|
| `structural-validity` | 0.2 | 0.3 |
| `truncation-risk` | 0.2 | 0.3 |
| `refusal-detection` | 0.3 | 0.2 |

#### `DEFAULT_PASS_THRESHOLD`

Default pass/fail threshold: `0.7`.

#### `redistributeWeights(base, excluded)`

Redistribute dimension weights when some dimensions are excluded. Excluded dimensions get weight 0; active dimensions are scaled proportionally to sum to 1.0.

```typescript
import { redistributeWeights, DEFAULT_WEIGHTS } from 'output-grade';

const weights = redistributeWeights(DEFAULT_WEIGHTS, ['schema-completeness', 'relevance']);
// schema-completeness: 0, relevance: 0, others scaled up proportionally
```

---

## Configuration

### Custom Weights

Override individual dimension weights. Unspecified dimensions retain their defaults.

```typescript
const report = grade(output, {
  weights: {
    'structural-validity': 0.30,
    'hallucination-risk': 0.25,
    'content-coherence': 0.20,
    'truncation-risk': 0.10,
    'refusal-detection': 0.10,
    'relevance': 0.05,
  },
});
```

### Custom Pass Threshold

```typescript
const report = grade(output, { passThreshold: 0.85 });
```

### Custom Critical Floors

Override when critical dimensions cap the composite score:

```typescript
const report = grade(output, {
  criticalFloors: {
    'structural-validity': { threshold: 0.3, ceiling: 0.4 },
    'refusal-detection': { threshold: 0.5, ceiling: 0.3 },
  },
});
```

### Custom Patterns

Add additional hedging, refusal, or preamble patterns to the detection catalogs:

```typescript
const report = grade(output, {
  customPatterns: {
    hedging: [/\bsupposedly\b/i, /\ballegedly\b/i],
    refusal: [/\bwe do not support\b/i],
    preamble: [/^Note:\s*/i],
  },
});
```

### Custom Stopwords

Provide domain-specific stopwords for relevance scoring:

```typescript
const report = grade(output, {
  prompt: 'Explain the React useEffect hook',
  stopwords: ['react', 'hook', 'component'],
});
```

---

## Error Handling

`output-grade` handles edge cases gracefully rather than throwing exceptions.

**Empty or whitespace-only input** returns a `GradeReport` with `score: 0`, `pass: false`, and a single critical signal (`empty-output`).

**Unparseable JSON** (when JSON is expected) produces a `score: 0` for `structural-validity` and `schema-completeness`, with critical signals describing the parse failure.

**Missing context** (no `prompt`, `schema`, or `format` provided) causes the corresponding dimensions to be excluded from the composite and their weights redistributed. The excluded dimensions report neutral scores of 1.0 in the `dimensions` breakdown.

**All dimensions excluded** returns the original weight map unchanged (no division-by-zero).

---

## Advanced Usage

### Reusable Grader for JSON API Responses

```typescript
import { createGrader } from 'output-grade';

const jsonGrader = createGrader({
  weights: {
    'schema-completeness': 0.30,
    'structural-validity': 0.30,
    'content-coherence': 0.10,
    'hallucination-risk': 0.10,
    'truncation-risk': 0.10,
    'refusal-detection': 0.05,
    'relevance': 0.03,
    'format-compliance': 0.02,
  },
  passThreshold: 0.8,
});

const report = jsonGrader.grade(apiResponse, {
  schema: { type: 'object', required: ['id', 'name', 'status'] },
  format: 'json',
});

if (!report.pass) {
  console.error('Quality check failed:', report.summary);
  // retry or escalate
}
```

### Per-Dimension Scoring

Use individual dimension methods when you only need a specific quality signal:

```typescript
import { createGrader } from 'output-grade';

const grader = createGrader();

// Check only for refusal
const refusal = grader.detectRefusal(output);
if (refusal.score < 0.5) {
  console.warn('Model refused:', refusal.signals);
}

// Check only for truncation
const truncation = grader.detectTruncation(output);
if (truncation.score < 0.3) {
  console.warn('Output appears truncated');
}
```

### Quality Gate in a Pipeline

```typescript
import { grade } from 'output-grade';

function qualityGate(output: string, prompt: string): boolean {
  const report = grade(output, { prompt, passThreshold: 0.75 });

  if (!report.pass) {
    const criticals = report.signals.filter(s => s.severity === 'critical');
    console.warn(`Quality gate failed (${report.score.toFixed(2)}):`, criticals);
    return false;
  }

  return true;
}
```

### Batch Evaluation

```typescript
import { createGrader } from 'output-grade';

const grader = createGrader({ passThreshold: 0.7 });
const outputs: string[] = loadOutputs();

const results = outputs.map(output => grader.grade(output));
const passRate = results.filter(r => r.pass).length / results.length;
const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

console.log(`Pass rate: ${(passRate * 100).toFixed(1)}%`);
console.log(`Avg score: ${avgScore.toFixed(3)}`);
```

### Inspecting Signals

```typescript
import { grade } from 'output-grade';

const report = grade(output, { prompt, format: 'json' });

// Signals are ordered: critical first, then warning, then info
for (const signal of report.signals) {
  const loc = signal.location
    ? ` [chars ${signal.location.start}-${signal.location.end}]`
    : '';
  console.log(`[${signal.severity.toUpperCase()}] ${signal.dimension}: ${signal.message}${loc}`);
}
```

### CLI Usage

Grade output from the command line:

```bash
# Grade inline text (human-readable output)
npx output-grade "Your LLM output text here"

# Grade a file with JSON report output
npx output-grade ./path/to/output.txt --format json

# Grade with prompt context for relevance scoring
npx output-grade "Some response" --prompt "Explain quantum computing"

# Grade JSON output with a schema
npx output-grade '{"title":"Guide"}' --schema '{"type":"object","required":["title","body"]}'
```

**CLI options:**

| Option | Description |
|---|---|
| `<text-or-file>` | Text to grade, or path to a file containing text. |
| `--format json\|human` | Output format (default: `human`). |
| `--prompt <text>` | Original prompt for relevance scoring. |
| `--schema <json>` | JSON schema string for schema-completeness scoring. |
| `--help`, `-h` | Show help message. |

**Exit codes:** `0` if the output passes (score >= threshold), `1` if it fails.

---

## TypeScript

All types are exported from the package entry point. The package ships with declaration files and declaration maps.

```typescript
import type {
  GradeReport,
  GradeOptions,
  GraderConfig,
  Grader,
  DimensionId,
  DimensionResult,
  DimensionScores,
  Signal,
  SignalLocation,
  Severity,
  OutputFormat,
  DetectedFormat,
  GradeMeta,
  JsonSchema,
  CustomPatterns,
  CriticalFloorConfig,
  BracketBalance,
  JsonParseResult,
  UrlLocation,
  DateLocation,
  PatternEntry,
} from 'output-grade';
```

**Key types:**

| Type | Description |
|---|---|
| `GradeReport` | Complete grade report: composite score, dimensions, signals, summary, metadata. |
| `GradeOptions` | Options for `grade()`: prompt, schema, expected, format, weights, thresholds, patterns. |
| `GraderConfig` | Configuration for `createGrader()`: weights, thresholds, patterns, stopwords. |
| `Grader` | Preconfigured grader instance with `grade()` and per-dimension methods. |
| `DimensionId` | `'schema-completeness' \| 'structural-validity' \| 'content-coherence' \| 'hallucination-risk' \| 'truncation-risk' \| 'refusal-detection' \| 'relevance' \| 'format-compliance'` |
| `DimensionResult` | Per-dimension result: `{ score: number; signals: Signal[] }`. |
| `DimensionScores` | Record mapping all eight `DimensionId` keys to their 0--1 scores. |
| `Signal` | Detected quality signal: id, severity, dimension, message, location. |
| `SignalLocation` | Character offset range: `{ start: number; end: number }`. |
| `Severity` | `'info' \| 'warning' \| 'critical'`. |
| `OutputFormat` | `'json' \| 'markdown' \| 'code' \| 'xml' \| 'yaml' \| 'text' \| 'table' \| 'list'`. |
| `DetectedFormat` | `'json' \| 'markdown' \| 'code' \| 'xml' \| 'text'`. |
| `GradeMeta` | Grading metadata: duration, weights used, applicable dimensions, detected format, output length, critical floor triggered. |
| `JsonSchema` | Simplified JSON Schema: `type`, `properties`, `required`, `items`, `enum`, `min/max`, `pattern`. |
| `CustomPatterns` | Additional patterns: `{ hedging?: RegExp[]; refusal?: RegExp[]; preamble?: RegExp[] }`. |
| `CriticalFloorConfig` | `{ threshold: number; ceiling: number }`. |
| `BracketBalance` | Balance counts for curly, square, round, angle brackets plus max nesting depth. |
| `JsonParseResult` | `{ success: boolean; value?: unknown; lenient?: boolean; error?: string }`. |
| `UrlLocation` | `{ url: string; start: number; end: number; suspicious: boolean; reason?: string }`. |
| `DateLocation` | `{ date: string; start: number; end: number; valid: boolean; reason?: string }`. |
| `PatternEntry` | `{ pattern: RegExp; category: string; severity: Severity; label: string }`. |

---

## License

MIT
