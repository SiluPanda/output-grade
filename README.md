# output-grade

Heuristic LLM output quality scoring without calling another LLM.

Grades LLM outputs across 8 dimensions — structural validity, content coherence, hallucination risk, truncation detection, refusal detection, schema completeness, relevance, and format compliance — using fast, deterministic heuristics. Zero runtime dependencies.

## Installation

```bash
npm install output-grade
```

## Quick Start

```typescript
import { grade } from 'output-grade';

// Basic grading
const report = grade(outputText);
console.log(report.score);  // 0.0 - 1.0
console.log(report.pass);   // true if score >= 0.7

// Context-aware grading
const report = grade(outputText, {
  prompt: 'Explain quantum computing',
  schema: { type: 'object', required: ['title', 'body'] },
  format: 'json',
  passThreshold: 0.8,
});
```

## CLI

Grade LLM output from the command line:

```bash
npx output-grade "Your LLM output text here"
npx output-grade ./path/to/output.txt --format json
npx output-grade "Some response" --prompt "Explain quantum computing" --format human
npx output-grade "Some JSON response" --schema '{"type":"object","required":["title"]}'
```

Exit code: `0` if the output passes (score ≥ threshold), `1` if it fails.

Options:
- `--format json|human` — Output format (default: `human`)
- `--prompt <text>` — Original prompt for relevance scoring
- `--schema <json>` — JSON schema string for schema-completeness scoring

## Available Utilities

Low-level utility functions are exported for direct use:

### tokenize(text)

Simple whitespace tokenizer. Splits on whitespace, strips punctuation, lowercases.

```typescript
import { tokenize } from 'output-grade';

tokenize('Hello World, this is a Test.');
// => ['hello', 'world', 'this', 'is', 'a', 'test']
```

### splitSentences(text)

Splits text on sentence-ending punctuation followed by whitespace and an uppercase letter.

```typescript
import { splitSentences } from 'output-grade';

splitSentences('Hello world. This is great! Is it?');
// => ['Hello world.', 'This is great!', 'Is it?']
```

### computeNgrams(tokens, n?)

Computes n-gram frequency distribution from a token array. Default n=3 (trigrams).

```typescript
import { computeNgrams } from 'output-grade';

const freq = computeNgrams(['the', 'quick', 'brown', 'fox'], 3);
// Map { 'the quick brown' => 1, 'quick brown fox' => 1 }
```

### repetitionRatio(tokens, n?)

Fraction of unique n-grams that appear more than once. Returns 0.0 - 1.0.

```typescript
import { repetitionRatio } from 'output-grade';

repetitionRatio(['a', 'b', 'c', 'a', 'b', 'c'], 3);
// => ratio > 0 (repetition detected)
```

### detectFormat(output)

Auto-detects output format: `'json'`, `'xml'`, `'markdown'`, or `'text'`.

```typescript
import { detectFormat } from 'output-grade';

detectFormat('{"key": "value"}');  // => 'json'
detectFormat('# Hello\nText');     // => 'markdown'
detectFormat('<root></root>');     // => 'xml'
detectFormat('Plain text.');       // => 'text'
```

### checkBracketBalance(text)

Checks bracket balance for `{}`, `[]`, `()`, `<>`. Returns balance counts and max nesting depth.

```typescript
import { checkBracketBalance } from 'output-grade';

const balance = checkBracketBalance('{ [ ] }');
// { curly: 0, square: 0, round: 0, angle: 0, maxDepth: 2 }
```

### lenientJsonParse(text)

Attempts strict JSON parse first, then strips markdown fences and retries.

```typescript
import { lenientJsonParse } from 'output-grade';

lenientJsonParse('```json\n{"key": "value"}\n```');
// { success: true, value: { key: 'value' }, lenient: true }
```

### extractUrls(text)

Extracts all URLs from text with character offsets and suspicion flags. A URL is flagged suspicious when its domain is a known example/placeholder domain, its path has 5+ segments, its TLD is all-numeric, or its TLD is longer than 6 characters.

```typescript
import { extractUrls } from 'output-grade';

extractUrls('Visit https://example.com/page for info.');
// [{ url: 'https://example.com/page', start: 6, end: 30, suspicious: true, reason: 'example domain' }]

extractUrls('See https://github.com/user/repo for code.');
// [{ url: 'https://github.com/user/repo', start: 4, end: 32, suspicious: false }]
```

### extractDates(text, futureHorizonYears?)

Extracts dates from text in four formats (ISO `YYYY-MM-DD`, US `MM/DD/YYYY`, `Month DD, YYYY`, `DD Month YYYY`) with character offsets and validity flags. Flags impossible dates (e.g. Feb 30), out-of-range years (before 1900 or after 2100), and dates beyond `futureHorizonYears` (default: 2) from the current year.

```typescript
import { extractDates } from 'output-grade';

extractDates('Released 2024-01-15. Event on February 30, 2024.');
// [
//   { date: '2024-01-15', start: 9, end: 19, valid: true },
//   { date: 'February 30, 2024', start: 30, end: 47, valid: false, reason: 'impossible date' }
// ]
```

## Types Reference

All TypeScript types are exported:

- `GradeReport` — Complete grade report returned by `grade()`
- `GradeOptions` — Options for the `grade()` function
- `GraderConfig` — Configuration for `createGrader()`
- `Grader` — Preconfigured grader instance
- `DimensionId` — Union of 8 dimension identifiers
- `DimensionResult` — Per-dimension score and signals
- `DimensionScores` — Record of all 8 dimension scores
- `Signal` — A detected quality signal
- `SignalLocation` — Character offset range for a signal
- `Severity` — `'info' | 'warning' | 'critical'`
- `OutputFormat` — Expected output format union
- `DetectedFormat` — Detected format subset
- `GradeMeta` — Grading process metadata
- `JsonSchema` — Simplified JSON Schema for validation
- `CustomPatterns` — Custom pattern overrides
- `CriticalFloorConfig` — Critical dimension floor configuration
- `BracketBalance` — Bracket balance check result
- `JsonParseResult` — Lenient JSON parse result
- `UrlLocation` — Extracted URL with start/end offsets and suspicion flag
- `DateLocation` — Extracted date with start/end offsets and validity flag

## License

MIT
