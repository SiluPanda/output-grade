# output-grade -- Specification

## 1. Overview

`output-grade` is a heuristic quality scoring library for LLM output that produces a 0-1 confidence score without calling another LLM. It accepts the raw text output from any language model -- whether it is JSON, markdown, code, or free-form prose -- and evaluates it across multiple quality dimensions: schema completeness, structural validity, content coherence, hallucination risk, truncation detection, refusal detection, relevance to the original prompt, and format compliance. Each dimension produces an individual 0-1 score. The dimensions are combined into a single composite score using a configurable weighted formula. The result is a structured grade report containing the composite score, per-dimension scores, individual signals detected with their locations and severities, and a pass/fail determination against a configurable threshold.

The gap this package fills is specific and well-defined. Evaluating LLM output quality in production systems today typically requires one of two approaches: "LLM-as-judge" (calling a second, often stronger, LLM to evaluate the first LLM's output) or manual human review. LLM-as-judge is expensive (it doubles your LLM API costs), slow (it adds another round-trip latency), non-deterministic (the judge model may disagree with itself on repeated evaluations), and recursive (who judges the judge?). Human review does not scale. Meanwhile, teams need quality signals for concrete operational decisions: should this response be retried? should this pipeline stage proceed? is this batch output good enough to ship? should an alert fire? These decisions do not require the nuanced literary criticism that an LLM judge provides -- they require fast, deterministic, cheap signals that detect the common failure modes: the output is truncated, the JSON is missing required fields, the model refused to answer, the text is full of hedging language suggesting hallucination, the output is a degenerate repetition loop, the format does not match what was requested.

Existing tools address adjacent problems but not this one. `deepeval` and `promptfoo` are Python and Node.js evaluation frameworks that provide LLM-as-judge scoring (faithfulness, relevance, hallucination) -- they call a second LLM, which is the approach `output-grade` explicitly avoids. RAGAS provides faithfulness, answer relevance, and context precision metrics -- all computed using LLM calls. BERTScore, BLEU, and ROUGE are reference-based metrics that require a known-correct reference output for comparison -- `output-grade` works without a reference. The `natural` npm package provides NLP utilities (tokenization, stemming, sentiment analysis) but does not aggregate them into a quality score or target LLM-specific failure modes. `ai-output-assert` in this monorepo provides test-time assertions for LLM output in CI/CD, but it is designed for pass/fail assertions in test suites, not for producing a continuous 0-1 confidence score at runtime. `llm-output-normalizer` in this monorepo cleans and repairs LLM output but does not evaluate its quality. `llm-retry` in this monorepo orchestrates retries based on schema validation failure but does not provide a general-purpose quality signal beyond "does it parse and validate."

`output-grade` provides the missing primitive: a fast, deterministic, zero-cost (no LLM calls) quality score that works on any LLM output. It runs in sub-millisecond time on typical outputs. It requires no API keys, no network access, and no external models. It produces the same score for the same input every time. It is designed to be the quality signal that feeds into retry decisions (`llm-retry` can use `output-grade`'s score to decide whether to retry), monitoring dashboards (track average output quality over time), quality gates in pipelines (reject outputs below a threshold), and batch evaluation (score thousands of outputs offline without incurring LLM costs).

The design philosophy is practical heuristics over theoretical perfection. No set of heuristics can fully replace human judgment or a capable LLM judge. `output-grade` does not claim to. What it claims is that a well-calibrated set of heuristics can detect the 80% of quality issues that are structural, mechanical, and pattern-based -- and it can do so in microseconds at zero marginal cost. The remaining 20% of quality issues (subtle factual errors, nuanced incoherence, context-dependent relevance) require an LLM judge or human review. `output-grade` is the first-pass filter that catches the obvious failures before escalating to expensive evaluation methods.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `grade(output, options?)` function that accepts raw LLM output (as a string) and returns a `GradeReport` containing a composite 0-1 score, per-dimension scores, individual signals, and a pass/fail determination.
- Provide context-aware grading via `grade(output, { prompt?, schema?, expected?, format? })` that uses the original prompt for relevance scoring, a JSON schema for completeness scoring, an expected output for similarity scoring, and a format specifier for compliance scoring.
- Provide per-dimension scoring functions (`gradeSchema`, `gradeCoherence`, `detectHallucinations`, `detectTruncation`, `detectRefusal`, `gradeRelevance`, `gradeFormatCompliance`) for callers who need only a specific quality dimension.
- Provide a `createGrader(config)` factory that returns a preconfigured grader instance with custom weights, thresholds, patterns, and pass/fail criteria, reusable across multiple grading calls.
- Score eight quality dimensions: schema completeness, structural validity, content coherence, hallucination risk, truncation risk, refusal detection, relevance, and format compliance. Each dimension produces a 0-1 score with a clear, documented algorithm.
- Combine dimension scores into a single composite 0-1 score using a configurable weighted average with critical-dimension floor capping.
- Detect and report individual quality signals -- specific patterns, anomalies, or defects found in the output -- with their location (character offset or line number), severity (info, warning, critical), dimension membership, and human-readable description.
- Apply only deterministic, rule-based heuristics. No LLM calls, no model inference, no network access, no external service dependencies. The same input always produces the same score.
- Run in sub-millisecond time for typical LLM outputs (under 10KB). No operation should exceed 10ms even on very large outputs (100KB+).
- Provide a CLI (`output-grade`) that reads LLM output from stdin or a file, accepts options via flags, and prints the grade report as JSON or human-readable text with a conventional exit code (0 for pass, 1 for fail).
- Keep runtime dependencies at zero. All heuristics -- pattern matching, statistical calculations, text analysis -- are implemented using built-in JavaScript/Node.js capabilities.
- Work with any LLM output format: JSON, markdown, code, plain text, XML, YAML, or mixed content. The grading dimensions that do not apply to a given format contribute neutral scores (1.0) rather than penalizing the output for not being a format it was not asked to be.

### Non-Goals

- **Not an LLM-as-judge.** This package does not call a second LLM to evaluate the first LLM's output. It does not require API keys, does not make HTTP requests, and does not incur inference costs. The tradeoff is explicit: `output-grade` catches structural and pattern-based quality issues; it does not catch subtle factual errors, nuanced reasoning failures, or context-dependent relevance problems. For those, use an LLM-as-judge framework like `deepeval` or `promptfoo` as a second-pass evaluation.
- **Not a factual accuracy checker.** This package does not verify whether the facts in the output are true. It detects hallucination risk indicators (hedging language, fabricated URL patterns, implausible dates) that correlate with hallucination, but it cannot determine whether "The population of France is 67 million" is correct. Factual verification requires a knowledge base or an LLM judge.
- **Not a reference-based metric.** This package does not compute BLEU, ROUGE, BERTScore, or any metric that requires a known-correct reference output. When an `expected` output is provided, `output-grade` uses it for basic similarity heuristics (token overlap, structural match), not for embedding-based semantic similarity. For embedding-based comparison, use a dedicated similarity package.
- **Not a test assertion library.** This package produces continuous 0-1 scores, not pass/fail assertions. Use `ai-output-assert` (in this monorepo) for test-time assertions. `output-grade` can feed its score into `ai-output-assert`'s assertion logic, but the two have different purposes: `output-grade` is a runtime scoring primitive; `ai-output-assert` is a test framework integration.
- **Not a JSON schema validator.** This package checks whether an output that is supposed to be JSON contains the fields described by a provided schema and whether those fields have the correct types. It does not perform full JSON Schema validation with allOf/anyOf/oneOf, conditional schemas, or custom format validators. For full schema validation, use `ajv` or `zod`. `output-grade`'s schema completeness score is a lightweight heuristic check, not a standards-compliant validator.
- **Not a text analytics platform.** This package computes specific quality-relevant metrics (type-token ratio, sentence count, repetition density). It does not compute arbitrary text statistics, sentiment analysis, named entity recognition, topic modeling, or other NLP tasks. Use `natural`, `compromise`, or `wink-nlp` for general NLP.
- **Not a prompt evaluator.** This package evaluates the output, not the prompt. It does not lint, optimize, or score the prompt itself. Use `prompt-lint` or `prompt-optimize` for prompt-side quality.

---

## 3. Target Users and Use Cases

### AI Application Developers with Retry Logic

Developers who call an LLM API and need to decide whether to retry based on output quality. The LLM returned something, but is it good enough? `llm-retry` handles retries based on schema validation failure (the output does not parse or does not match the schema). `output-grade` extends this to softer quality signals: the output parses and validates, but it is full of hedging language, half the response is a repetition loop, or the model clearly ignored the prompt. A typical integration is: `const report = grade(output, { prompt }); if (report.score < 0.7) retry();`. This is the primary integration point -- `llm-retry`'s escalation logic can use `output-grade`'s score as a trigger.

### Pipeline and Workflow Engineers

Teams building multi-stage LLM pipelines where each stage's output feeds into the next. A quality gate between stages prevents bad output from propagating. Stage 1 generates a summary; `output-grade` scores it; if the score is below 0.8, the pipeline retries stage 1 or routes to a stronger model before proceeding to stage 2. Without a quality gate, a truncated or incoherent stage 1 output produces garbage in stages 2 through N. `output-grade` provides the gate without adding an LLM-as-judge call at every stage boundary.

### Monitoring and Observability Teams

Teams operating LLM-powered services in production who need to track output quality over time. Dashboard metrics like "average output-grade score over the last hour," "percentage of outputs below 0.5," and "hallucination risk signal rate" provide operational visibility into model behavior. Alert rules like "fire if the 5-minute rolling average score drops below 0.6" detect model degradation, prompt drift, or provider issues before users complain. `output-grade` provides the metric; Prometheus, Datadog, or custom telemetry consumes it.

### Batch Evaluation Teams

Teams evaluating LLM performance across large datasets. Running an LLM-as-judge on 10,000 outputs costs money and takes time. `output-grade` scores all 10,000 outputs in under a second with zero API cost. The heuristic scores identify the outputs that are clearly good (score > 0.9) and clearly bad (score < 0.3), leaving only the ambiguous middle range (0.3 to 0.9) for expensive LLM-as-judge evaluation. This hybrid approach reduces evaluation costs by 60-80% while maintaining quality.

### Content Moderation Pipelines

Teams that use LLMs to generate user-facing content and need a pre-publication quality check. `output-grade`'s refusal detection catches cases where the model refused to generate the requested content (returning a safety message instead). Truncation detection catches cases where the response was cut off mid-sentence. Coherence scoring catches degenerate outputs (repetition loops, nonsense text). These are all cases where publishing the output would be worse than showing an error message.

### Developers Using Local or Open-Source Models

Developers using Ollama, vLLM, llama.cpp, or similar inference servers with open-source models. These models produce a wider range of quality issues than commercial APIs: more frequent truncation, more repetition loops, more format non-compliance, more incoherent outputs. `output-grade` is especially valuable here because the quality variance is higher and the cost of running an LLM judge on every output (which would require a second model) is impractical. A fast heuristic score is the only viable quality signal at scale.

### CI/CD Quality Gates

Teams that generate documentation, test data, code, or other artifacts using LLMs as part of their CI/CD pipeline. `output-grade` provides a quality gate that runs in the pipeline: if the generated artifact scores below a threshold, the pipeline fails. This catches the case where an LLM API change, model update, or prompt regression causes output quality to degrade. The CLI interface (`output-grade --threshold 0.7 < output.json`) integrates naturally into shell-based CI/CD steps.

---

## 4. Core Concepts

### Grading Dimension

A grading dimension is a single, named axis of quality evaluation. Each dimension has a unique identifier, a definition of what it measures, a scoring algorithm that produces a 0-1 value, and a default weight in the composite score. The eight dimensions are: schema completeness, structural validity, content coherence, hallucination risk, truncation risk, refusal detection, relevance, and format compliance. Dimensions are independent -- each is computed from the output text using its own algorithm, without reference to other dimensions' scores. This independence enables callers to use individual dimension scores directly (e.g., "what is the hallucination risk?") without computing the full composite.

### Signal

A signal is a specific, discrete finding detected during grading. Each signal belongs to a dimension, has a severity (info, warning, critical), a human-readable description, and a location in the output text (character offset range, or line number for line-oriented signals). Signals are the evidence behind dimension scores. A hallucination risk dimension score of 0.4 might be backed by signals like `{ id: 'hedging-phrase', severity: 'warning', message: 'Hedging phrase detected: "I believe"', location: { start: 45, end: 55 } }` and `{ id: 'fabricated-url', severity: 'critical', message: 'Potentially fabricated URL: http://example.com/nonexistent/path', location: { start: 120, end: 168 } }`. Signals provide explainability: the caller can inspect why the score is what it is, not just what the score is.

### Grade Report

A grade report is the structured output of the `grade()` function. It contains the composite score (0-1), the per-dimension score breakdown, the list of all signals detected, the pass/fail determination, and metadata (grading duration, dimension weights used, configuration applied). The grade report is the primary interface between `output-grade` and the consuming system. It is serializable to JSON for logging, storage, and transmission.

### Composite Score

The composite score is a single 0-1 value that summarizes overall output quality. It is computed as a weighted average of dimension scores, with an optional critical-dimension floor: if any dimension marked as critical falls below its floor threshold, the composite score is capped at the floor value regardless of other dimensions. The default weights and floors are calibrated so that a score of 0.9+ indicates high-quality output with no detected issues, 0.7-0.9 indicates acceptable output with minor issues, 0.4-0.7 indicates questionable output that may need retry or review, and below 0.4 indicates clearly defective output (truncated, refused, degenerate, or structurally invalid).

### Grader Instance

A grader instance is a preconfigured grading function created by `createGrader(config)`. It encapsulates dimension weights, pass/fail thresholds, custom pattern lists (additional hedging phrases, refusal patterns, etc.), and format expectations. A grader instance is reusable across multiple `grade()` calls, avoiding repeated configuration parsing. Teams typically create one grader instance per use case: one for JSON API responses, one for generated documentation, one for code generation, with different weights and thresholds for each.

### Inverted Dimensions

Some dimensions measure the absence of a defect rather than the presence of a quality. Hallucination risk, truncation risk, and refusal detection are inverted: a score of 1.0 means no hallucination indicators detected (low risk), no truncation indicators detected (complete output), and no refusal detected (the model answered the question). A score of 0.0 means high hallucination risk, severe truncation, or a full refusal. This inversion ensures that all dimensions follow the same convention: higher is better, 1.0 is ideal, 0.0 is worst.

---

## 5. Grading Dimensions

### 5.1 Schema Completeness

**Dimension ID**: `schema-completeness`

**What it measures**: How completely the output satisfies a provided JSON schema or structural expectation. If a schema specifies 10 required fields and the output contains 8 of them with correct types, the completeness score is 0.8. If no schema is provided, this dimension returns 1.0 (neutral -- cannot penalize without a reference).

**When it applies**: Only when the caller provides a `schema` option (a JSON Schema object or a simplified field descriptor). If no schema is provided, the dimension score is 1.0 and no signals are emitted.

**Algorithm**:

1. Parse the output as JSON. If parsing fails, score is 0.0 (the output is not even valid JSON, let alone schema-complete).
2. Extract the set of required fields from the schema (`required` array or fields without `?` in simplified descriptors).
3. For each required field:
   a. Check if the field exists in the parsed output. Missing field: add a critical signal, contribute 0 to this field's sub-score.
   b. If the field exists, check its type against the schema's declared type. Wrong type: add a warning signal, contribute 0.5 to this field's sub-score.
   c. If the field exists and has the correct type, check for emptiness: empty string `""`, empty array `[]`, `null`, `undefined`. Empty value on a required field: add a warning signal, contribute 0.7 to this field's sub-score.
   d. If the field exists, has the correct type, and is non-empty: contribute 1.0 to this field's sub-score.
4. For optional fields: check existence and type. Present and correct: contribute 1.0. Present but wrong type: contribute 0.5. Missing: contribute 0.8 (not penalized heavily). Optional fields contribute with half the weight of required fields.
5. For array fields: check minimum length if specified. An empty array when `minItems: 1` is specified adds a warning signal.
6. For nested objects: recurse. The nested object's completeness score contributes to its parent field's sub-score.
7. Composite: weighted average of all field sub-scores, with required fields weighted 1.0 and optional fields weighted 0.5.

**Score interpretation**:
- 1.0: All required fields present, correct types, non-empty. All optional fields present.
- 0.8-0.99: Minor issues -- an optional field missing, or a field with an unexpected but coercible type.
- 0.5-0.79: Significant issues -- one or more required fields missing, or multiple type mismatches.
- 0.0-0.49: Major issues -- most required fields missing, or the output is not valid JSON.

**Example signals**:
- `{ id: 'missing-required-field', severity: 'critical', dimension: 'schema-completeness', message: 'Required field "email" is missing', path: '$.email' }`
- `{ id: 'wrong-type', severity: 'warning', dimension: 'schema-completeness', message: 'Field "age" expected number, got string', path: '$.age' }`
- `{ id: 'empty-required-field', severity: 'warning', dimension: 'schema-completeness', message: 'Required field "tags" is an empty array', path: '$.tags' }`

**Default weight in composite**: 0.20 (when a schema is provided). 0.00 (when no schema is provided -- excluded from composite calculation, and its weight is redistributed proportionally to other dimensions).

---

### 5.2 Structural Validity

**Dimension ID**: `structural-validity`

**What it measures**: Whether the output is structurally well-formed according to its detected or expected format. For JSON: is it parseable? For markdown: are headings properly nested, are code fences closed, are lists consistent? For code: are brackets balanced, are strings terminated? For XML: are tags balanced? This dimension does not check semantic correctness (whether the content makes sense) -- only structural correctness (whether the syntax is valid).

**When it applies**: Always. Every output has a structure that can be evaluated.

**Algorithm**:

1. **Format detection**: If the caller provides a `format` option (`'json'`, `'markdown'`, `'code'`, `'xml'`, `'text'`), use that. Otherwise, auto-detect: attempt JSON parse (if it starts with `{` or `[`), check for markdown indicators (`#`, `` ``` ``, `-` lists), check for XML indicators (`<` tags). Default to `'text'` if nothing is detected.

2. **JSON validity** (when format is `'json'`):
   a. Attempt `JSON.parse(output)`. If it succeeds, base score is 1.0.
   b. If it fails, attempt lenient parsing (strip markdown fences, trim whitespace). If lenient parse succeeds, base score is 0.8 (valid JSON but wrapped in noise). Add info signal for wrapper detected.
   c. If lenient parse fails, analyze the parse error. Common patterns:
      - Trailing comma: score 0.7. The JSON is almost valid. Add warning signal.
      - Unquoted keys: score 0.6. Add warning signal.
      - Single quotes: score 0.6. Add warning signal.
      - Completely unparseable: score 0.0. Add critical signal.
   d. Check for structural anomalies even in valid JSON: deeply nested objects (depth > 20) add an info signal; extremely long strings (> 100KB) add an info signal; duplicate keys add a warning signal.

3. **Markdown validity** (when format is `'markdown'`):
   a. Check code fence balance: every opening `` ``` `` has a matching closing `` ``` ``. Unclosed fence: add critical signal, deduct 0.3.
   b. Check heading hierarchy: headings should not skip levels (no `##` followed by `####` without `###`). Skipped level: add info signal, deduct 0.05 per skip.
   c. Check list consistency: mixed `-` and `*` in the same list add an info signal. Items that change indentation inconsistently add a warning signal.
   d. Check link syntax: `[text](url)` pairs should have non-empty text and url. Malformed links add a warning signal.
   e. Base score is 1.0 minus deductions, floored at 0.0.

4. **Code validity** (when format is `'code'`):
   a. Check bracket balance: count `(`, `)`, `{`, `}`, `[`, `]`. Unbalanced brackets: add critical signal, deduct 0.2 per unbalanced pair.
   b. Check string termination: unterminated string literals add a critical signal, deduct 0.2.
   c. Check for obviously incomplete constructs: trailing `=`, `:`, `,`, `(`, `{` at end of output add a warning signal.

5. **XML validity** (when format is `'xml'`):
   a. Check tag balance using a stack. Every opening tag must have a matching closing tag. Unbalanced tags: add critical signal, deduct 0.2 per unmatched tag.
   b. Check for well-formedness: attribute syntax, proper nesting.

6. **Text validity** (when format is `'text'`):
   a. Text is always structurally valid (it is just text). Score is 1.0.
   b. Check for encoding anomalies: garbled characters, replacement characters (U+FFFD), excessive control characters. Each anomaly adds an info signal, deduct 0.1 per anomaly type.

**Score interpretation**:
- 1.0: Perfectly valid structure, no anomalies.
- 0.7-0.99: Minor structural issues (wrapped in noise, heading hierarchy skips).
- 0.3-0.69: Significant structural issues (unclosed fences, unbalanced brackets).
- 0.0-0.29: Fundamentally broken structure (unparseable JSON, heavily unbalanced).

**Default weight in composite**: 0.20.

---

### 5.3 Content Coherence

**Dimension ID**: `content-coherence`

**What it measures**: Whether the output reads as coherent, well-organized text rather than degenerate, repetitive, or nonsensical output. This dimension targets the specific failure modes where an LLM produces text that is syntactically valid but semantically broken: repetition loops (the same phrase or sentence repeats dozens of times), extremely low lexical diversity (using the same few words over and over), non-sequiturs (sentences that do not logically follow from each other), and degenerate outputs (all punctuation, all whitespace, single-character spam).

**When it applies**: Always, though its contribution is most meaningful for text-heavy outputs. For pure JSON or structured data, coherence scoring focuses on string field values rather than the structural skeleton.

**Algorithm**:

1. **Extract text content**: If the output is JSON, extract all string values and concatenate them (separated by spaces) for analysis. If the output is code, extract comments and string literals. If the output is text or markdown, use the full output.

2. **Repetition detection** (most important sub-metric):
   a. **N-gram repetition**: Compute 3-gram (trigram) frequency distribution over the extracted text. Calculate the repetition ratio: `(count of 3-grams appearing more than once) / (total unique 3-grams)`. A ratio above 0.5 indicates significant repetition. Score contribution: `1.0 - min(1.0, repetitionRatio * 1.5)`.
   b. **Sentence repetition**: Split text into sentences. Count exact duplicate sentences. If more than 20% of sentences are duplicates, add a critical signal. Score contribution: `1.0 - (duplicateSentenceCount / totalSentenceCount)`.
   c. **Sliding window repetition**: Check if any contiguous block of text (50+ characters) repeats verbatim within the output. This catches the specific LLM failure mode where the model gets stuck in a loop and generates the same paragraph repeatedly. Each detected repetition block adds a critical signal.

3. **Lexical diversity**:
   a. **Type-Token Ratio (TTR)**: `uniqueWords / totalWords`. High TTR (> 0.4 for outputs of 100+ words) indicates diverse vocabulary. Low TTR (< 0.2) indicates repetitive word choice. Score contribution: `min(1.0, TTR / 0.4)`.
   b. TTR is naturally lower for longer texts, so apply a length correction: for outputs over 500 words, use the moving average TTR (compute TTR over sliding windows of 100 words and average them) instead of the global TTR.

4. **Degenerate output detection**:
   a. If the output is empty or only whitespace: score 0.0, add critical signal.
   b. If the output is a single character repeated: score 0.0, add critical signal.
   c. If the output is less than 10 characters for a non-trivial prompt: score 0.2, add warning signal.
   d. If the output is more than 90% punctuation or special characters: score 0.1, add critical signal.

5. **Sentence structure**:
   a. If the output contains text (not just JSON keys/values), check that it contains recognizable sentence structure: sequences of words with capitalization and terminal punctuation. Outputs that are word salad (random words without sentence structure) score lower.
   b. Average sentence length: extremely short average (< 3 words per sentence) or extremely long average (> 100 words per sentence) adds a warning signal. Score contribution: sigmoid function centered at 15-20 words per sentence.

6. **Composite**: Weighted average of sub-metrics. Repetition detection contributes 0.5, lexical diversity contributes 0.25, degenerate output detection contributes 0.15, sentence structure contributes 0.10.

**Score interpretation**:
- 1.0: Diverse vocabulary, no repetition, well-structured sentences.
- 0.7-0.99: Minor repetition or slightly low diversity, but readable.
- 0.3-0.69: Significant repetition or low diversity. Output is questionable.
- 0.0-0.29: Degenerate output -- repetition loop, word salad, empty, or nonsense.

**Example signals**:
- `{ id: 'repetition-loop', severity: 'critical', dimension: 'content-coherence', message: 'Repetition loop detected: "Please note that..." repeats 12 times', location: { start: 200, end: 1400 } }`
- `{ id: 'low-lexical-diversity', severity: 'warning', dimension: 'content-coherence', message: 'Low type-token ratio: 0.15 (expected > 0.4)', location: null }`
- `{ id: 'degenerate-output', severity: 'critical', dimension: 'content-coherence', message: 'Output is empty or whitespace only', location: null }`

**Default weight in composite**: 0.15.

---

### 5.4 Hallucination Risk

**Dimension ID**: `hallucination-risk`

**What it measures**: The likelihood that the output contains hallucinated content -- fabricated facts, invented citations, non-existent URLs, implausible statistics, or confidently stated information that the model may have invented. This dimension does not verify factual accuracy (that would require a knowledge base or LLM judge). Instead, it detects linguistic and structural patterns that correlate with hallucination in LLM output. The score is inverted: 1.0 means low hallucination risk (no indicators detected), 0.0 means high hallucination risk (many indicators detected).

**When it applies**: Always, though most indicators are relevant only for text-heavy outputs. Pure JSON with numeric/boolean fields has few hallucination risk indicators.

**Algorithm**:

1. **Hedging language detection**: Scan for phrases that indicate uncertainty or low confidence. LLMs tend to use more hedging language when generating content they are uncertain about, which correlates with hallucination risk.

   **Hedging phrase catalog** (case-insensitive):

   | Category | Phrases |
   |---|---|
   | Belief qualifiers | "I think", "I believe", "I'm not sure", "I'm not certain", "I'm not entirely sure", "if I recall correctly", "if I remember correctly", "to the best of my knowledge" |
   | Possibility markers | "probably", "possibly", "perhaps", "maybe", "might be", "could be", "it's possible that", "there's a chance that", "it seems like", "it appears that" |
   | Approximation markers | "approximately", "roughly", "around", "about", "more or less", "give or take", "somewhere around", "in the ballpark of" |
   | Uncertainty disclaimers | "I'm not 100% sure", "don't quote me on this", "take this with a grain of salt", "this may not be accurate", "I could be wrong", "this is my understanding" |
   | Knowledge cutoff references | "as of my last update", "as of my knowledge cutoff", "I don't have access to real-time", "my training data goes up to", "I was trained on data up to" |

   Compute hedging density: `hedgingPhraseCount / sentenceCount`. A density above 0.3 (nearly one hedging phrase per three sentences) indicates high hallucination risk. Score contribution: `1.0 - min(1.0, hedgingDensity * 2.5)`.

2. **Fabricated URL detection**: Extract all URLs from the output and check for fabrication indicators.
   a. URL pattern: extract using a regex that matches `https?://[^\s<>"]+`.
   b. Fabrication indicators:
      - URL contains path segments that look like random words strung together (`/this/is/probably/made/up/path`). Heuristic: path has 5+ segments, or segments contain uncommon character patterns.
      - URL domain is a generic example domain (`example.com`, `test.com`, `sample.org`) used outside of an explicitly illustrative context.
      - URL contains a clearly fake or implausible structure (e.g., `http://www.definitelynotreal.com/article/12345`).
      - URL references a known real domain but with a path that follows LLM fabrication patterns (long paths with title-like slugs on domains that do not use that URL structure, such as `arxiv.org/abs/` followed by a paper ID that does not match arxiv's `YYMM.NNNNN` format).
   c. Each suspicious URL adds a warning signal. More than 2 suspicious URLs add a critical signal. Score contribution: `1.0 - min(1.0, suspiciousUrlCount * 0.3)`.

3. **Fabricated citation detection**: Scan for citation-like patterns and check for plausibility.
   a. Academic citation patterns: `Author (Year)`, `Author et al. (Year)`, `[N]` style references, `(Author, Year)`.
   b. Plausibility checks:
      - Year range: citations with years before 1900 or after the current year add a warning signal.
      - Author name patterns: single-word author names that look like common nouns rather than surnames add a warning signal.
      - Journal names: very long or grammatically unusual journal names add a warning signal.
   c. Each implausible citation adds a warning signal. Score contribution: `1.0 - min(1.0, implausibleCitationCount * 0.25)`.

4. **Impossible date detection**: Scan for dates and check validity.
   a. Date patterns: `YYYY-MM-DD`, `MM/DD/YYYY`, `Month DD, YYYY`, and other common formats.
   b. Validity checks: month 1-12, day 1-31 (with month-specific maximums), year 1900-2030 (configurable). Future dates beyond a reasonable horizon (configurable, default: 2 years from current date) add a warning signal. Dates with impossible components (month 13, day 32, February 30) add a critical signal.
   c. Score contribution: `1.0 - min(1.0, impossibleDateCount * 0.4)`.

5. **Self-contradiction detection**: A lightweight heuristic for detecting contradictions within the output.
   a. Scan for explicit contradiction patterns: "however, this is not true" following a declarative statement, "actually" or "correction" mid-output suggesting the model is correcting itself, negation of a previously stated claim using the same noun phrases.
   b. This is inherently limited as a heuristic -- detecting true semantic contradiction requires NLU capabilities beyond pattern matching. The heuristic catches only the most explicit cases where the model literally contradicts itself using recognizable patterns.
   c. Each detected contradiction adds a warning signal. Score contribution: `1.0 - min(1.0, contradictionCount * 0.3)`.

6. **Confidence inflation detection**: Scan for patterns where the model expresses very high confidence about claims that are inherently uncertain or unverifiable.
   a. Patterns: "definitely", "certainly", "without a doubt", "100%", "guaranteed", "always", "never" when combined with factual claims about the real world (not about the output format or the model's capabilities).
   b. Confidence inflation is a weaker signal than hedging -- it indicates the model may be overconfident rather than hallucinating -- but it correlates with hallucination in contexts where the model states fabricated facts with high confidence.
   c. Each detected inflation adds an info signal. Score contribution: `1.0 - min(1.0, inflationCount * 0.1)`.

7. **Composite**: Minimum of all sub-scores (worst-case approach). If any single hallucination indicator is strongly present, the overall risk score reflects that, regardless of how clean the other indicators are. This is deliberate: hallucination risk is a floor-based concern -- one fabricated citation is enough to undermine trust in the entire output.

**Score interpretation** (inverted -- higher is better):
- 1.0: No hallucination risk indicators detected.
- 0.7-0.99: Minor indicators (a few hedging phrases, one approximation marker).
- 0.3-0.69: Moderate risk (multiple hedging phrases, a suspicious URL, or an implausible date).
- 0.0-0.29: High risk (fabricated URLs, impossible dates, self-contradictions, dense hedging).

**Default weight in composite**: 0.15.

---

### 5.5 Truncation Risk

**Dimension ID**: `truncation-risk`

**What it measures**: Whether the output appears to be complete or was cut off prematurely, typically because the LLM hit its `max_tokens` limit. The score is inverted: 1.0 means the output appears complete, 0.0 means the output is clearly truncated. Truncation is one of the most common and most damaging LLM output failures -- a truncated JSON response is unparseable, a truncated code block is unsyntactic, and a truncated text response ends mid-thought.

**When it applies**: Always.

**Algorithm**:

1. **Unclosed bracket detection**: Count opening and closing brackets of each type: `{}`, `[]`, `()`, `<>` (for XML/HTML). If any bracket type has more opens than closes, add a critical signal. The severity increases with the depth of unclosed nesting. Score contribution: `1.0 - min(1.0, unclosedDepth * 0.3)`.

2. **Incomplete sentence detection**: Check whether the output ends with a complete sentence.
   a. A complete sentence ends with terminal punctuation: `.`, `!`, `?`, `:`, `;`, or a closing bracket/fence followed by whitespace or end-of-string.
   b. An incomplete sentence ends with: a word (no terminal punctuation), a comma, a conjunction ("and", "or", "but"), a preposition ("in", "of", "with"), an article ("the", "a", "an"), or mid-word.
   c. Exceptions: JSON output ending with `}` or `]` is considered complete even without sentence-terminal punctuation. Code output ending with `}`, `)`, or `;` is considered complete.
   d. Score contribution: complete sentence ending = 1.0; incomplete ending = 0.3.

3. **Unclosed markdown fence detection**: If the output contains an opening `` ``` `` without a matching close, add a critical signal. Score contribution: 0.2 (strongly truncated).

4. **Incomplete list detection**: If the output contains a numbered list, check whether the numbering sequence is complete. A list that goes "1. ... 2. ... 3." and then stops mid-item or ends without the content of item 3 adds a warning signal. A list that promises "5 items" in surrounding text but contains only 3 adds a warning signal.

5. **Abrupt ending patterns**: Check for patterns that suggest the output was cut off:
   a. Ends with an ellipsis that is not stylistic: `"..."` at the very end after a partial word or sentence.
   b. Ends with a hyphenated word break: `"impor-"` (word broken mid-syllable).
   c. Ends with an unclosed string literal (an odd number of `"` characters in the last line).

6. **Content-length heuristic**: If the output is suspiciously short relative to the complexity implied by its content (e.g., starts with "Here are 10 examples:" but contains only 2), add a warning signal. This heuristic has limited applicability because `output-grade` does not know the expected length, but it can detect the most obvious cases.

7. **Composite**: Minimum of all sub-scores. Truncation is a binary-ish condition -- the output is either complete or it is not -- so the composite uses the worst indicator.

**Score interpretation** (inverted -- higher is better):
- 1.0: Output appears complete. All brackets closed, sentences finished, fences balanced.
- 0.7-0.99: Likely complete with minor ambiguity (e.g., ends without terminal punctuation but content seems finished).
- 0.3-0.69: Possibly truncated (incomplete list, ambiguous ending).
- 0.0-0.29: Clearly truncated (unclosed brackets, mid-sentence ending, unclosed fences).

**Default weight in composite**: 0.10.

---

### 5.6 Refusal Detection

**Dimension ID**: `refusal-detection`

**What it measures**: Whether the LLM refused to produce the requested output and instead returned a safety/policy message, a disclaimer about its capabilities, or a redirect to other resources. Refusal is a distinct failure mode from quality issues: the output is not bad, it is absent -- the model declined to generate it. The score is inverted: 1.0 means no refusal detected (the model answered normally), 0.0 means a full refusal (the entire output is a refusal message).

**When it applies**: Always.

**Algorithm**:

1. **Refusal phrase catalog** (case-insensitive):

   | Category | Phrases |
   |---|---|
   | Direct refusal | "I can't help with that", "I cannot help with", "I'm unable to", "I am unable to", "I can't assist with", "I cannot assist with", "I'm not able to", "I won't be able to" |
   | Policy citation | "against my guidelines", "violates my policies", "goes against my programming", "outside my capabilities", "beyond my scope", "not within my abilities", "I'm designed to", "I was programmed to" |
   | Safety refusal | "I can't provide information on", "I cannot provide guidance on", "I must decline", "I have to refuse", "for safety reasons", "for ethical reasons", "it would be inappropriate" |
   | Identity disclosure | "As an AI language model", "As an AI assistant", "As a language model", "As an artificial intelligence", "I'm just an AI", "I am an AI" |
   | Capability limitation | "I don't have access to", "I don't have the ability to", "I can't browse the internet", "I can't access real-time", "I can't access external", "I don't have real-time" |
   | Redirect | "I recommend consulting", "please consult a professional", "seek professional advice", "speak with a qualified", "contact a licensed" |

2. **Refusal classification**:
   a. **Full refusal**: The entire output is a refusal message. Every sentence contains refusal phrases or is a short pleasantry ("I understand your question, but..."). Score: 0.0.
   b. **Partial refusal**: The output contains both refusal language and substantive content. The model partially answered but included disclaimers. Score: `1.0 - (refusalSentenceCount / totalSentenceCount)`, clamped to [0.3, 0.9].
   c. **No refusal**: No refusal phrases detected. Score: 1.0.

3. **Identity disclosure scoring**: "As an AI" type phrases are a softer signal than direct refusal. They reduce the score slightly but do not indicate a full refusal. Each identity disclosure adds an info signal and deducts 0.05 from the score (down to a floor of 0.7).

4. **Context sensitivity**: If the caller provides the original `prompt`, the refusal detector checks whether the refusal is topically related to the prompt (suggesting the model refused the specific request) versus a generic refusal (suggesting a system-level issue). This distinction is reported in signals but does not change the score.

**Score interpretation** (inverted -- higher is better):
- 1.0: No refusal detected. The model answered the request.
- 0.7-0.99: Minor identity disclosure or soft disclaimers, but substantive content present.
- 0.3-0.69: Partial refusal. Some content present but heavily caveated.
- 0.0-0.29: Full refusal. The output is a refusal message with no substantive content.

**Example signals**:
- `{ id: 'full-refusal', severity: 'critical', dimension: 'refusal-detection', message: 'Full refusal detected: "I cannot help with that request"', location: { start: 0, end: 42 } }`
- `{ id: 'ai-identity-disclosure', severity: 'info', dimension: 'refusal-detection', message: 'AI identity disclosure: "As an AI language model"', location: { start: 0, end: 27 } }`

**Default weight in composite**: 0.10.

---

### 5.7 Relevance

**Dimension ID**: `relevance`

**What it measures**: Whether the output addresses the original prompt. Without an LLM judge, relevance can only be estimated through heuristic signals: keyword overlap between prompt and output, topic consistency, and structural alignment (if the prompt asks for a list, does the output contain a list?). This dimension requires the caller to provide the original `prompt` for meaningful scoring. If no prompt is provided, the dimension returns 1.0 (neutral).

**When it applies**: Only when the caller provides a `prompt` option. If no prompt is provided, the dimension score is 1.0 and no signals are emitted.

**Algorithm**:

1. **Keyword extraction**: Extract meaningful keywords from the prompt by tokenizing, lowercasing, removing stopwords (a built-in list of ~150 English stopwords: "the", "is", "at", "which", "on", etc.), and removing single-character tokens. The result is the prompt's keyword set.

2. **Keyword overlap**: Compute the fraction of prompt keywords that appear in the output. `keywordOverlap = |promptKeywords ∩ outputKeywords| / |promptKeywords|`. An overlap of 0.0 means the output shares no meaningful words with the prompt (likely irrelevant). An overlap of 1.0 means every prompt keyword appears in the output (likely relevant). Score contribution: `min(1.0, keywordOverlap * 1.5)` (scaled so that 0.67 overlap gives a perfect score -- not every prompt keyword needs to appear verbatim in the output).

3. **Structural alignment**: If the prompt contains structural instructions, check whether the output matches.
   a. "List" instruction: prompt contains "list", "enumerate", "bullet", or numbered format instructions. Check whether the output contains list items (lines starting with `-`, `*`, `1.`, or similar). Mismatch: deduct 0.2.
   b. "JSON" instruction: prompt contains "JSON", "object", or "structured". Check whether the output contains JSON. Mismatch: deduct 0.3.
   c. "Code" instruction: prompt contains "code", "function", "implement", "write a". Check whether the output contains code or code fences. Mismatch: deduct 0.2.
   d. "Table" instruction: prompt contains "table" or "columns". Check whether the output contains a markdown table or tabular structure. Mismatch: deduct 0.1.

4. **Topic drift detection**: A lightweight heuristic. Split the output into quarters. Compute keyword overlap of each quarter with the prompt. If the first quarter has high overlap (> 0.5) but the last quarter has low overlap (< 0.1), the output may have drifted off-topic. Add a warning signal, deduct 0.15.

5. **Length reasonableness**: If the prompt implies a detailed response ("explain in detail", "provide a comprehensive", "write a long") but the output is very short (< 100 characters), deduct 0.2. If the prompt implies a brief response ("in one sentence", "briefly", "summarize") but the output is very long (> 2000 characters), deduct 0.1.

6. **Expected output comparison**: If the caller provides an `expected` output, compute token-level Jaccard similarity: `|expectedTokens ∩ outputTokens| / |expectedTokens ∪ outputTokens|`. This is a rough similarity measure -- not a semantic comparison -- but catches cases where the output is completely different from what was expected. Score contribution: `similarity * 0.5 + keywordOverlapScore * 0.5` (blended with keyword overlap).

7. **Composite**: Weighted average. Keyword overlap contributes 0.5, structural alignment contributes 0.2, topic drift contributes 0.15, length reasonableness contributes 0.15.

**Score interpretation**:
- 1.0: High keyword overlap, structural alignment, no topic drift.
- 0.7-0.99: Good relevance with minor gaps (a few prompt keywords missing, slight structural mismatch).
- 0.3-0.69: Questionable relevance (low keyword overlap, structural mismatch, or topic drift).
- 0.0-0.29: Likely irrelevant (no keyword overlap, completely wrong format).

**Default weight in composite**: 0.05 (when prompt is provided). 0.00 (when no prompt is provided -- excluded and weight redistributed).

---

### 5.8 Format Compliance

**Dimension ID**: `format-compliance`

**What it measures**: Whether the output matches the format that was requested. If the caller asked for JSON and got prose, that is a format compliance failure. If the caller asked for a markdown table and got a numbered list, that is a partial compliance failure. This dimension is distinct from structural validity (which checks whether the output is valid within its own format) -- format compliance checks whether the output is in the right format at all.

**When it applies**: Only when the caller provides a `format` option or when the `prompt` contains format instructions that can be detected. If no format expectation is established, the dimension returns 1.0 (neutral).

**Algorithm**:

1. **Determine expected format**: From the `format` option (explicit), or from the prompt by detecting format-related instructions.
   a. Prompt contains "JSON", "return a JSON", "respond with JSON", "output JSON", "as JSON": expected format is `json`.
   b. Prompt contains "markdown", "in markdown format": expected format is `markdown`.
   c. Prompt contains "code", "write code", "implement", "function": expected format is `code`.
   d. Prompt contains "XML", "as XML", "in XML": expected format is `xml`.
   e. Prompt contains "YAML", "as YAML", "in YAML": expected format is `yaml`.
   f. Prompt contains "table", "as a table", "in table format": expected format is `table`.
   g. Prompt contains "list", "as a list", "bullet points", "numbered list": expected format is `list`.
   h. If no format is detected: dimension returns 1.0 (cannot evaluate compliance without an expectation).

2. **Check compliance**:
   a. **JSON expected**: Does the output contain parseable JSON (possibly wrapped in fences or prose)? Pure JSON: 1.0. JSON in fence: 0.9. JSON extractable from prose: 0.7. No JSON found: 0.0.
   b. **Markdown expected**: Does the output contain markdown formatting (headings, lists, fences, links)? Rich markdown: 1.0. Minimal formatting: 0.7. Plain text with no markdown: 0.3.
   c. **Code expected**: Does the output contain code (in a fence, or recognizable code patterns like function definitions, variable declarations, import statements)? Code in fence: 1.0. Recognizable code without fence: 0.8. No code: 0.0.
   d. **XML expected**: Does the output contain XML tags? Well-formed XML: 1.0. Partial XML: 0.5. No XML: 0.0.
   e. **YAML expected**: Does the output contain YAML key-value patterns? Valid YAML: 1.0. Partial: 0.5. No YAML: 0.0.
   f. **Table expected**: Does the output contain a markdown table (pipe-delimited rows) or tab-separated data? Table found: 1.0. List found instead: 0.4. Neither: 0.0.
   g. **List expected**: Does the output contain list items (lines starting with `-`, `*`, `1.`, etc.)? List found: 1.0. Paragraphs instead: 0.3. Empty or irrelevant: 0.0.

3. **Format purity**: If the expected format is JSON, deduct for non-JSON content surrounding the JSON (preamble, postamble, explanatory prose). Pure JSON: no deduction. JSON with preamble/postamble: deduct 0.1-0.2 depending on the ratio of noise to content.

**Score interpretation**:
- 1.0: Output perfectly matches expected format.
- 0.7-0.99: Output is in the right format but has minor noise (wrapper text, slight formatting variations).
- 0.3-0.69: Output is partially in the right format or in a related but different format.
- 0.0-0.29: Output is in a completely different format than requested.

**Default weight in composite**: 0.05 (when format is specified). 0.00 (when no format is specified -- excluded and weight redistributed).

---

## 6. Scoring Algorithms

### Pattern Matching Architecture

All pattern-based scoring (hedging phrases, refusal phrases, URL patterns, date patterns, etc.) uses the same underlying architecture: a catalog of compiled regular expressions, each tagged with a category, severity, and dimension. The catalog is built once at module load time (or once per `createGrader()` call for custom patterns). During scoring, the input text is scanned against each pattern in the catalog. Matches are collected as signals with their locations. The density or count of matches drives the dimension score through a documented formula.

Regular expressions are designed to avoid catastrophic backtracking (ReDoS). No pattern uses nested quantifiers (`(a+)+`), unbounded alternation inside quantifiers, or other constructs known to cause exponential-time matching. All patterns are tested against adversarial inputs during development.

### Tokenization

Text tokenization is used by the coherence and relevance dimensions. `output-grade` uses a simple whitespace-and-punctuation tokenizer: split on whitespace, strip leading/trailing punctuation from each token, lowercase, and filter out empty tokens. This is deliberately simple -- not a linguistic tokenizer -- because the scoring algorithms need word-level tokens for frequency analysis, not linguistically correct tokens. The tokenizer handles English text well and produces reasonable (if imperfect) results for other Latin-script languages. Non-Latin-script text (CJK, Arabic, Hebrew) is tokenized less effectively but does not produce errors; the coherence and relevance scores for non-Latin text are less reliable but never crash or produce NaN.

### Sentence Splitting

Sentence splitting is used by the coherence, hallucination, and truncation dimensions. The splitter uses a regex-based approach: split on `.`, `!`, `?` followed by whitespace and a capital letter (or end of string). This handles common English sentence boundaries. It does not handle abbreviations perfectly ("Dr. Smith said..." is mis-split) but errors are acceptable because the scoring algorithms use sentence counts for density calculations, where off-by-one errors in sentence count have negligible impact on the score.

### Stopword List

The relevance dimension uses a built-in English stopword list for keyword extraction. The list contains approximately 150 words: articles (a, an, the), prepositions (in, on, at, by, for, with, to, from), conjunctions (and, or, but, so, yet), pronouns (I, you, he, she, it, we, they, me, him, her, us, them), common verbs (is, am, are, was, were, be, been, being, have, has, had, do, does, did), and other high-frequency, low-information words. The list is configurable via the `stopwords` option in the grader configuration.

### Score Normalization

All dimension scores are clamped to the [0.0, 1.0] range after computation. Intermediate calculations may produce negative values (e.g., `1.0 - deduction` when deductions exceed 1.0) or values greater than 1.0 (e.g., scaled metrics). The final clamping ensures all scores are valid 0-1 values.

### Empty Input Handling

If the input to `grade()` is an empty string, `null`, or `undefined`, the function returns a grade report with a composite score of 0.0, structural validity of 0.0, content coherence of 0.0, and a critical signal `{ id: 'empty-output', severity: 'critical', message: 'Output is empty' }`. All other dimensions return their minimum scores. This is a hard floor -- empty output is always the worst case.

---

## 7. Composite Score

### Weighted Average Formula

The composite score is computed as a weighted average of all applicable dimension scores:

```
compositeScore = Σ(dimensionScore_i × weight_i) / Σ(weight_i)
```

Where the sum runs only over applicable dimensions (dimensions whose weight is non-zero after redistribution). Dimensions that do not apply (no schema provided for schema-completeness, no prompt provided for relevance, no format specified for format-compliance) have their weights set to zero, and the remaining weights are scaled proportionally so that they still sum to 1.0.

### Default Weights

| Dimension | Default Weight | Condition |
|---|---|---|
| Schema Completeness | 0.20 | Only when `schema` is provided |
| Structural Validity | 0.20 | Always |
| Content Coherence | 0.15 | Always |
| Hallucination Risk | 0.15 | Always |
| Truncation Risk | 0.10 | Always |
| Refusal Detection | 0.10 | Always |
| Relevance | 0.05 | Only when `prompt` is provided |
| Format Compliance | 0.05 | Only when `format` is provided or detectable |

When no schema, prompt, or format is provided, the always-on dimensions (structural validity, content coherence, hallucination risk, truncation risk, refusal detection) have their weights normalized to sum to 1.0:

| Dimension | Redistributed Weight |
|---|---|
| Structural Validity | 0.286 |
| Content Coherence | 0.214 |
| Hallucination Risk | 0.214 |
| Truncation Risk | 0.143 |
| Refusal Detection | 0.143 |

### Critical Dimension Floor

Certain dimensions represent hard failures that should cap the composite score regardless of how well other dimensions score. A perfectly coherent, well-structured, relevant output that is a full refusal should not score 0.85 just because 6 out of 7 dimensions are perfect.

The critical dimension floor mechanism: if any dimension marked as critical falls below its floor threshold, the composite score is capped at a specified ceiling value. The floor is checked after the weighted average is computed.

**Default critical dimensions**:

| Dimension | Floor Threshold | Ceiling When Below Floor |
|---|---|---|
| Structural Validity | 0.2 | 0.3 |
| Truncation Risk | 0.2 | 0.3 |
| Refusal Detection | 0.3 | 0.2 |

Example: if the output is a full refusal (refusal-detection score = 0.0), the composite score is capped at 0.2 even if all other dimensions score 1.0. If the output is clearly truncated (truncation-risk score = 0.1), the composite is capped at 0.3.

### Configurable Overrides

The caller can override default weights, critical dimension configurations, and the pass/fail threshold:

```typescript
const report = grade(output, {
  weights: {
    'schema-completeness': 0.30,
    'structural-validity': 0.25,
    'content-coherence': 0.10,
    'hallucination-risk': 0.10,
    'truncation-risk': 0.10,
    'refusal-detection': 0.10,
    'relevance': 0.03,
    'format-compliance': 0.02,
  },
  criticalFloors: {
    'refusal-detection': { threshold: 0.5, ceiling: 0.1 },
  },
  passThreshold: 0.8,
});
```

### Score Calibration

The default weights and thresholds are calibrated against a reference corpus of LLM outputs with human-annotated quality labels. The calibration target is: a score of 0.9+ should correspond to "clearly acceptable" outputs (95% of human reviewers would approve). A score below 0.4 should correspond to "clearly unacceptable" outputs (95% of human reviewers would reject). The 0.4-0.9 range is the ambiguous zone where heuristics are insufficient and LLM-as-judge or human review adds value. The default `passThreshold` of 0.7 is set at the midpoint of this ambiguous zone -- conservative enough to catch most bad outputs but not so aggressive that it flags acceptable outputs.

---

## 8. API Surface

### Installation

```bash
npm install output-grade
```

### No Runtime Dependencies

`output-grade` has zero runtime dependencies. All heuristics -- regex pattern matching, text tokenization, statistical calculations, score normalization -- are implemented using built-in JavaScript and Node.js capabilities. This keeps the package lightweight (~15KB minified), avoids supply chain risk, and ensures compatibility across Node.js versions 18+.

### Main Export: `grade`

The primary API. Accepts raw LLM output and optional context, runs all grading dimensions, computes the composite score, and returns a `GradeReport`.

```typescript
import { grade } from 'output-grade';

// Basic usage -- grade output without context
const report = grade('{"name": "Alice", "age": 30}');
console.log(report.score);      // 0.92
console.log(report.pass);       // true
console.log(report.dimensions); // { 'structural-validity': 0.95, 'content-coherence': 0.88, ... }

// Context-aware grading
const report2 = grade('{"name": "Alice"}', {
  prompt: 'Return a JSON object with name, age, and email fields.',
  schema: {
    type: 'object',
    required: ['name', 'age', 'email'],
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      email: { type: 'string' },
    },
  },
  format: 'json',
});
console.log(report2.score);                             // 0.48
console.log(report2.dimensions['schema-completeness']); // 0.33
console.log(report2.signals);
// [
//   { id: 'missing-required-field', severity: 'critical', message: 'Required field "age" is missing', ... },
//   { id: 'missing-required-field', severity: 'critical', message: 'Required field "email" is missing', ... },
// ]
```

### Per-Dimension Functions

Individual scoring functions for callers who need only a specific quality dimension.

```typescript
import {
  gradeSchema,
  gradeStructure,
  gradeCoherence,
  detectHallucinations,
  detectTruncation,
  detectRefusal,
  gradeRelevance,
  gradeFormatCompliance,
} from 'output-grade';

// Schema completeness only
const schemaResult = gradeSchema('{"name": "Alice"}', {
  type: 'object',
  required: ['name', 'age'],
  properties: { name: { type: 'string' }, age: { type: 'number' } },
});
console.log(schemaResult.score);   // 0.5
console.log(schemaResult.signals); // [{ id: 'missing-required-field', ... }]

// Coherence only
const coherenceResult = gradeCoherence('This is a well-written paragraph about...');
console.log(coherenceResult.score);   // 0.91
console.log(coherenceResult.signals); // []

// Hallucination risk detection
const hallucinationResult = detectHallucinations(
  'I believe the study by Smith et al. (2024) at http://example.com/fake/study found that...'
);
console.log(hallucinationResult.score);   // 0.35
console.log(hallucinationResult.signals);
// [
//   { id: 'hedging-phrase', severity: 'warning', message: 'Hedging phrase: "I believe"', ... },
//   { id: 'fabricated-url', severity: 'critical', message: 'Suspicious URL: http://example.com/fake/study', ... },
// ]

// Truncation detection
const truncationResult = detectTruncation('{"name": "Alice", "hobbies": ["reading",');
console.log(truncationResult.score);   // 0.1
console.log(truncationResult.signals);
// [
//   { id: 'unclosed-bracket', severity: 'critical', message: 'Unclosed [ at position 30', ... },
//   { id: 'unclosed-bracket', severity: 'critical', message: 'Unclosed { at position 0', ... },
// ]

// Refusal detection
const refusalResult = detectRefusal(
  "I'm sorry, but as an AI language model, I cannot help with that request."
);
console.log(refusalResult.score);   // 0.0
console.log(refusalResult.signals);
// [{ id: 'full-refusal', severity: 'critical', ... }]

// Relevance (requires prompt)
const relevanceResult = gradeRelevance(
  'The weather in Paris is sunny today.',
  'What is the capital of France?'
);
console.log(relevanceResult.score); // 0.35

// Format compliance
const formatResult = gradeFormatCompliance(
  'Sure, here is the answer: The capital is Paris.',
  'json'
);
console.log(formatResult.score); // 0.0
```

### Factory: `createGrader`

Creates a preconfigured grader instance. Useful when grading multiple outputs with the same configuration.

```typescript
import { createGrader } from 'output-grade';

const grader = createGrader({
  weights: {
    'schema-completeness': 0.30,
    'structural-validity': 0.25,
    'content-coherence': 0.15,
    'hallucination-risk': 0.10,
    'truncation-risk': 0.10,
    'refusal-detection': 0.05,
    'relevance': 0.03,
    'format-compliance': 0.02,
  },
  passThreshold: 0.75,
  criticalFloors: {
    'refusal-detection': { threshold: 0.3, ceiling: 0.2 },
    'truncation-risk': { threshold: 0.2, ceiling: 0.3 },
  },
  customPatterns: {
    hedging: [/in my opinion/i, /it depends/i],
    refusal: [/company policy prevents/i],
  },
  stopwords: ['custom', 'stopword', 'list'],
});

const report1 = grader.grade(output1, { schema, prompt });
const report2 = grader.grade(output2, { schema, prompt });
```

### Type Definitions

```typescript
// ── Grade Report ────────────────────────────────────────────────────

/** The complete grade report returned by grade(). */
interface GradeReport {
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

/** Per-dimension score breakdown. */
interface DimensionScores {
  'schema-completeness': number;
  'structural-validity': number;
  'content-coherence': number;
  'hallucination-risk': number;
  'truncation-risk': number;
  'refusal-detection': number;
  'relevance': number;
  'format-compliance': number;
}

/** A single signal detected during grading. */
interface Signal {
  /** Unique signal identifier (e.g., 'missing-required-field', 'hedging-phrase'). */
  id: string;

  /** Severity level. */
  severity: 'info' | 'warning' | 'critical';

  /** The dimension this signal belongs to. */
  dimension: string;

  /** Human-readable description. */
  message: string;

  /** Location in the output text, if applicable. */
  location: SignalLocation | null;
}

/** Location of a signal in the output text. */
interface SignalLocation {
  /** Start character offset (0-based). */
  start: number;

  /** End character offset (exclusive). */
  end: number;
}

/** Metadata about the grading process. */
interface GradeMeta {
  /** Time taken to compute the grade, in milliseconds. */
  durationMs: number;

  /** The weights used for composite score calculation. */
  weights: Record<string, number>;

  /** Which dimensions were applicable (non-zero weight). */
  applicableDimensions: string[];

  /** Whether any critical floor was triggered, and which one. */
  criticalFloorTriggered: string | null;

  /** The detected format of the output. */
  detectedFormat: 'json' | 'markdown' | 'code' | 'xml' | 'text';

  /** Output character count. */
  outputLength: number;
}

// ── Dimension Result ────────────────────────────────────────────────

/** Result of a per-dimension scoring function. */
interface DimensionResult {
  /** The dimension score, 0.0 to 1.0. */
  score: number;

  /** Signals detected for this dimension. */
  signals: Signal[];
}

// ── Options ─────────────────────────────────────────────────────────

/** Options for the grade() function. */
interface GradeOptions {
  /** The original prompt, for relevance scoring. */
  prompt?: string;

  /** JSON Schema for schema completeness scoring. */
  schema?: JsonSchema;

  /** Expected output for similarity comparison. */
  expected?: string;

  /** Expected format of the output. */
  format?: 'json' | 'markdown' | 'code' | 'xml' | 'yaml' | 'text' | 'table' | 'list';

  /** Custom dimension weights (overrides defaults). */
  weights?: Partial<Record<string, number>>;

  /** Pass/fail threshold. Default: 0.7. */
  passThreshold?: number;

  /** Critical dimension floor overrides. */
  criticalFloors?: Record<string, { threshold: number; ceiling: number }>;

  /** Custom patterns to add to detection catalogs. */
  customPatterns?: CustomPatterns;

  /** Custom stopwords for relevance scoring (replaces default list). */
  stopwords?: string[];
}

/** Custom pattern overrides. */
interface CustomPatterns {
  /** Additional hedging phrases for hallucination risk detection. */
  hedging?: RegExp[];

  /** Additional refusal phrases for refusal detection. */
  refusal?: RegExp[];

  /** Additional preamble patterns to ignore during content extraction. */
  preamble?: RegExp[];
}

/** Simplified JSON Schema type for schema completeness scoring. */
interface JsonSchema {
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

// ── Grader Instance ─────────────────────────────────────────────────

/** Configuration for createGrader(). */
interface GraderConfig extends Omit<GradeOptions, 'prompt' | 'schema' | 'expected' | 'format'> {
  // Grader config contains the reusable settings.
  // Per-call settings (prompt, schema, expected, format) are passed to grade().
}

/** A preconfigured grader instance. */
interface Grader {
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
}
```

---

## 9. Grade Report

### Structure

The `GradeReport` is the primary output of `output-grade`. It is designed to be:

1. **Machine-readable**: Every field is typed. The report serializes cleanly to JSON. Monitoring systems can extract `report.score`, alerting systems can check `report.pass`, and dashboards can display `report.dimensions`.
2. **Human-readable**: The `summary` field is a 1-3 sentence natural-language description of the grade. Signals have human-readable `message` fields. The report can be printed as-is for debugging.
3. **Explainable**: The `signals` array provides evidence for every dimension score. A caller who sees a low score can inspect the signals to understand why.

### Summary Generation

The `summary` field is generated from the dimension scores and signals using template logic (not an LLM):

- Score >= 0.9: "Output quality is high. No significant issues detected."
- Score 0.7-0.89: "Output quality is acceptable. {count} minor issue(s) detected: {top issues}."
- Score 0.4-0.69: "Output quality is questionable. {count} issue(s) detected: {top issues}. Consider retrying."
- Score < 0.4: "Output quality is poor. {count} critical issue(s) detected: {top issues}. Retry recommended."

The "{top issues}" are the 1-3 most severe signals, described in natural language: "truncation detected (unclosed brackets)", "full refusal detected", "high repetition (12 repeated phrases)".

### Signal Ordering

Signals in the report are ordered by:
1. Severity (critical first, then warning, then info).
2. Within the same severity, by dimension (in the order: refusal, truncation, structural, schema, hallucination, coherence, relevance, format).
3. Within the same dimension, by location (earlier signals first).

### Report Serialization

The `GradeReport` is a plain object with no class instances, functions, or circular references. It serializes cleanly with `JSON.stringify()`. All fields use primitive types, arrays, or nested plain objects. `SignalLocation` uses numbers (character offsets), not pointers or references. This ensures the report can be stored in databases, transmitted over APIs, logged to files, and deserialized without loss.

---

## 10. Configuration

### Dimension Weight Configuration

Weights control how much each dimension contributes to the composite score. The default weights (section 7) are designed for general-purpose use. Teams should adjust weights based on their use case:

- **Structured data extraction** (JSON API responses): Increase `schema-completeness` to 0.35, increase `structural-validity` to 0.25, decrease `content-coherence` to 0.05.
- **Content generation** (blog posts, documentation): Increase `content-coherence` to 0.30, increase `hallucination-risk` to 0.20, decrease `schema-completeness` to 0.00.
- **Code generation**: Increase `structural-validity` to 0.30, increase `format-compliance` to 0.15, decrease `hallucination-risk` to 0.05.
- **Safety-sensitive applications**: Increase `refusal-detection` to 0.20, increase `hallucination-risk` to 0.25.

### Pass/Fail Threshold

The `passThreshold` option (default: 0.7) determines the `pass` field in the grade report. Outputs scoring at or above the threshold pass; outputs below fail.

Recommended thresholds by use case:

| Use Case | Recommended Threshold |
|---|---|
| Quality gate in production pipeline | 0.7 |
| Retry decision (retry if below threshold) | 0.6 |
| Alerting (fire alert if below threshold) | 0.4 |
| Batch evaluation (flag for human review) | 0.5 |
| Strict quality requirement (regulated content) | 0.85 |

### Custom Pattern Configuration

The `customPatterns` option allows adding domain-specific patterns to the detection catalogs:

```typescript
const report = grade(output, {
  customPatterns: {
    // Additional hedging phrases for medical domain
    hedging: [
      /consult your doctor/i,
      /this is not medical advice/i,
      /individual results may vary/i,
    ],
    // Additional refusal phrases for enterprise applications
    refusal: [
      /this request requires elevated permissions/i,
      /please contact your administrator/i,
    ],
  },
});
```

Custom patterns are appended to the built-in catalog, not replacements. To completely replace the built-in catalog for a dimension, use `createGrader` with explicit pattern lists.

### Stopword Configuration

The `stopwords` option replaces the default English stopword list for relevance scoring. This is useful for non-English text or for domains where certain common words are actually meaningful:

```typescript
const grader = createGrader({
  stopwords: ['the', 'is', 'a', 'an'],  // minimal stopword list
});
```

---

## 11. Integration

### Integration with llm-retry

`output-grade` is designed to compose with `llm-retry` as a quality signal for retry decisions. `llm-retry` already retries on schema validation failure (hard failure -- the output does not parse). `output-grade` extends this to soft quality failures: the output parses and validates, but the quality is low.

**Integration pattern**: Provide a custom validator to `llm-retry` that runs `output-grade` and fails validation if the grade is too low.

```typescript
import { retryWithValidation } from 'llm-retry';
import { grade } from 'output-grade';

const result = await retryWithValidation(callLLM, UserSchema, {
  validate: (data, rawOutput) => {
    // First: schema validation (handled by llm-retry's built-in Zod validation)
    // Then: quality grading on the raw output
    const report = grade(rawOutput, {
      prompt: originalPrompt,
      schema: userJsonSchema,
    });

    if (report.score < 0.6) {
      return {
        success: false,
        errors: report.signals
          .filter(s => s.severity === 'critical')
          .map(s => ({
            path: '$',
            message: `Quality issue: ${s.message}`,
            code: s.id,
          })),
      };
    }

    return { success: true, data };
  },
});
```

### Integration with Monitoring Systems

`output-grade` produces numeric scores and structured signals that map directly to monitoring metrics:

```typescript
import { grade } from 'output-grade';

// After each LLM call
const report = grade(llmOutput, { prompt, schema });

// Prometheus metrics
histogram.observe({ dimension: 'composite' }, report.score);
for (const [dim, score] of Object.entries(report.dimensions)) {
  histogram.observe({ dimension: dim }, score);
}
for (const signal of report.signals) {
  counter.inc({ signal_id: signal.id, severity: signal.severity });
}

// Alert if quality drops
if (!report.pass) {
  alertManager.fire('llm-output-quality-low', {
    score: report.score,
    summary: report.summary,
  });
}
```

### Integration with CI/CD

The CLI interface enables shell-based integration:

```bash
# In a CI/CD pipeline step
cat generated-output.json | output-grade --format json --schema schema.json --threshold 0.8

# Exit code: 0 if pass, 1 if fail
# Stdout: JSON grade report
```

### Integration with llm-output-normalizer

`output-grade` can be used after `llm-output-normalizer` to score the cleaned output:

```typescript
import { extractJSON } from 'llm-output-normalizer';
import { grade } from 'output-grade';

const rawOutput = await callLLM(messages);
const cleaned = extractJSON(rawOutput);
const report = grade(JSON.stringify(cleaned), { schema });
```

Or before normalization, to score the raw output and decide whether normalization is worth attempting:

```typescript
const rawReport = grade(rawOutput);
if (rawReport.dimensions['structural-validity'] < 0.3) {
  // Output is so broken that normalization probably cannot fix it -- retry instead
  return retry();
}
const cleaned = extractJSON(rawOutput);
```

---

## 12. CLI Interface

### Command

```
output-grade [options] [file]
```

If `file` is provided, reads the output from the file. If no file is provided, reads from stdin.

### Options

| Flag | Description | Default |
|---|---|---|
| `--format <format>` | Expected output format (json, markdown, code, xml, yaml, text, table, list) | auto-detect |
| `--schema <file>` | Path to a JSON Schema file for schema completeness scoring | none |
| `--prompt <text>` | The original prompt, for relevance scoring | none |
| `--prompt-file <file>` | Path to a file containing the original prompt | none |
| `--threshold <number>` | Pass/fail threshold (0.0 to 1.0) | 0.7 |
| `--json` | Output the full grade report as JSON | false (human-readable default) |
| `--score-only` | Output only the composite score (a single number) | false |
| `--dimensions` | Show per-dimension scores in human-readable output | false |
| `--signals` | Show individual signals in human-readable output | false |
| `--verbose` | Show all details (dimensions + signals + metadata) | false |

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | Output passes the threshold (grade >= threshold) |
| 1 | Output fails the threshold (grade < threshold) |
| 2 | Usage error (invalid options, missing input, unreadable file) |

### Human-Readable Output (Default)

```
Grade: 0.73 (PASS)

  Schema Completeness:  0.50  ⚠
  Structural Validity:  1.00  ✓
  Content Coherence:    0.88  ✓
  Hallucination Risk:   0.65  ⚠
  Truncation Risk:      1.00  ✓
  Refusal Detection:    1.00  ✓
  Relevance:            0.42  ⚠
  Format Compliance:    0.90  ✓

Summary: Output quality is acceptable. 3 issue(s) detected: missing required field "email", hedging phrase density is elevated, low keyword overlap with prompt.
```

### JSON Output

```json
{
  "score": 0.73,
  "pass": true,
  "passThreshold": 0.7,
  "dimensions": {
    "schema-completeness": 0.50,
    "structural-validity": 1.00,
    "content-coherence": 0.88,
    "hallucination-risk": 0.65,
    "truncation-risk": 1.00,
    "refusal-detection": 1.00,
    "relevance": 0.42,
    "format-compliance": 0.90
  },
  "signals": [...],
  "summary": "Output quality is acceptable. 3 issue(s) detected.",
  "meta": { ... }
}
```

### Pipeline Usage

```bash
# Grade output from an LLM API call
echo "Generate a user profile as JSON" | llm-api-call | output-grade --format json --threshold 0.8

# Grade output from a file
output-grade --format markdown --verbose generated-doc.md

# Use in CI/CD: fail the build if output quality is below threshold
output-grade --schema schema.json --threshold 0.85 output.json || exit 1

# Pipe the score into another tool
SCORE=$(cat output.txt | output-grade --score-only)
echo "Output quality: $SCORE"
```

---

## 13. Testing Strategy

### Unit Tests

Each grading dimension has its own test suite with test cases organized by sub-metric:

**Schema Completeness**:
- All fields present and correct types: score ~1.0.
- Required field missing: score drops proportionally.
- Wrong type on required field: score drops less than missing.
- Empty required field: score drops.
- Nested object with missing fields: recursive scoring.
- No schema provided: score is 1.0.
- Output is not valid JSON: score is 0.0.

**Structural Validity**:
- Valid JSON: score 1.0.
- JSON with trailing comma: score ~0.7.
- Completely unparseable text as JSON: score 0.0.
- Markdown with unclosed fence: score drops.
- Balanced brackets in code: score 1.0.
- Unbalanced brackets: score drops.

**Content Coherence**:
- Normal prose: high score.
- Repeated sentence 10 times: low score (repetition loop detected).
- Empty output: score 0.0.
- Single character repeated 1000 times: score 0.0.
- High lexical diversity text: high TTR, high score.
- Low lexical diversity (same 5 words repeated): low score.

**Hallucination Risk**:
- Text with no hedging: score 1.0.
- Text with dense hedging ("I think... probably... maybe..."): low score.
- Text with fabricated URL pattern: score drops.
- Text with impossible date (February 30): score drops.
- Text with contradictions: score drops.

**Truncation Risk**:
- Complete output ending with period: score 1.0.
- JSON with unclosed bracket: score very low.
- Text ending mid-sentence: score low.
- Markdown with unclosed code fence: score low.
- Output ending with complete structure: score 1.0.

**Refusal Detection**:
- Normal answer: score 1.0.
- Full refusal ("I can't help with that"): score 0.0.
- Partial refusal (answer with disclaimer): intermediate score.
- "As an AI" disclosure only: slight deduction.

**Relevance**:
- Output addressing the prompt directly: high score.
- Output on a completely different topic: low score.
- No prompt provided: score 1.0.
- Prompt asks for JSON, output is JSON: structural alignment bonus.
- Output topic drifts in the second half: drift detected.

**Format Compliance**:
- JSON expected, JSON received: score 1.0.
- JSON expected, prose received: score 0.0.
- Markdown expected, markdown received: score 1.0.
- No format specified: score 1.0.

### Composite Score Tests

- All dimensions at 1.0: composite is 1.0.
- One critical dimension at floor: composite is capped at ceiling.
- Custom weights applied correctly: composite reflects weights.
- Weight redistribution when dimensions are excluded: weights normalize to 1.0.
- Pass threshold comparison: pass is true iff score >= threshold.

### Signal Tests

- Each signal type is emitted with correct id, severity, dimension, and message.
- Signal locations point to the correct character offsets.
- Signals are ordered by severity, then dimension, then location.

### Edge Cases

- Empty string input: score 0.0, `empty-output` signal.
- Very long input (100KB+): completes in under 10ms.
- Input containing only whitespace: treated as empty.
- Input containing only numbers: valid text, coherence may be low.
- Non-UTF-8 input: handled gracefully (replacement characters add a signal).
- Input with mixed languages: tokenization degrades gracefully.

### Performance Benchmarks

- Grading a typical LLM output (500 characters): under 0.5ms.
- Grading a large LLM output (10,000 characters): under 2ms.
- Grading a very large output (100,000 characters): under 10ms.
- These benchmarks are verified in CI to detect performance regressions.

---

## 14. Performance

### Design Constraints

`output-grade` is designed for inline use in production request paths. Every grading call must complete in sub-millisecond time for typical inputs. This constraint drives several design decisions:

1. **No external calls**: No network requests, no file I/O, no child processes. Everything runs in-process, in-memory.
2. **Single-pass algorithms**: Where possible, text is scanned once. The pattern matching architecture uses a single scan with a compiled regex set, not multiple sequential scans.
3. **Lazy computation**: Dimensions that require expensive analysis (like n-gram frequency computation for coherence) short-circuit if cheaper signals already indicate the score. If the output is empty, coherence returns 0.0 without computing n-gram statistics.
4. **No memory allocation**: Pattern catalogs are compiled once and reused. Tokenization reuses buffers where possible. The grade report is a single allocation.
5. **No regex catastrophic backtracking**: All patterns are audited for ReDoS safety. No pattern uses nested quantifiers.

### Scaling

The primary cost driver is text length. Most algorithms are O(n) where n is the character count of the input. N-gram computation for coherence is O(n) with a constant factor proportional to the window size. The overall grading complexity is O(n) with a small constant.

For very large inputs (100KB+), callers can reduce computation by passing `{ dimensions: ['structural-validity', 'truncation-risk'] }` to compute only specific dimensions, skipping expensive coherence analysis.

---

## 15. Dependencies

### Runtime Dependencies

None. `output-grade` has zero runtime dependencies.

### Peer Dependencies

None.

### Development Dependencies

| Dependency | Purpose |
|---|---|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linter |

### Compatibility

- Node.js >= 18 (uses ES2022 features: `Array.prototype.at`, `Object.hasOwn`, `structuredClone`).
- TypeScript >= 5.0 (uses `satisfies` operator in internal type checking).
- No browser-specific APIs. Works in Bun and Deno (Node.js compatibility mode).

---

## 16. File Structure

```
output-grade/
├── src/
│   ├── index.ts                  # Public API exports
│   ├── grade.ts                  # Main grade() function, composite score computation
│   ├── grader.ts                 # createGrader() factory
│   ├── dimensions/
│   │   ├── schema-completeness.ts
│   │   ├── structural-validity.ts
│   │   ├── content-coherence.ts
│   │   ├── hallucination-risk.ts
│   │   ├── truncation-risk.ts
│   │   ├── refusal-detection.ts
│   │   ├── relevance.ts
│   │   └── format-compliance.ts
│   ├── patterns/
│   │   ├── hedging.ts            # Hedging phrase catalog
│   │   ├── refusal.ts            # Refusal phrase catalog
│   │   ├── confidence.ts         # Confidence inflation patterns
│   │   └── stopwords.ts          # English stopword list
│   ├── utils/
│   │   ├── tokenizer.ts          # Word tokenization
│   │   ├── sentences.ts          # Sentence splitting
│   │   ├── ngrams.ts             # N-gram computation
│   │   ├── url-extract.ts        # URL extraction and analysis
│   │   ├── date-extract.ts       # Date extraction and validation
│   │   ├── bracket-balance.ts    # Bracket counting
│   │   ├── json-parse.ts         # Lenient JSON parsing utilities
│   │   └── format-detect.ts      # Output format detection
│   ├── types.ts                  # TypeScript type definitions
│   ├── defaults.ts               # Default weights, thresholds, configuration
│   └── cli.ts                    # CLI entry point
├── src/__tests__/
│   ├── grade.test.ts             # Integration tests for grade()
│   ├── composite.test.ts         # Composite score calculation tests
│   ├── schema-completeness.test.ts
│   ├── structural-validity.test.ts
│   ├── content-coherence.test.ts
│   ├── hallucination-risk.test.ts
│   ├── truncation-risk.test.ts
│   ├── refusal-detection.test.ts
│   ├── relevance.test.ts
│   ├── format-compliance.test.ts
│   ├── cli.test.ts               # CLI integration tests
│   └── performance.test.ts       # Performance benchmarks
├── package.json
├── tsconfig.json
├── SPEC.md
└── README.md
```

---

## 17. Implementation Roadmap

### Phase 1: Core Scoring Engine

**Deliverables**: `grade()` function with all eight dimensions, composite score, grade report, and `createGrader()` factory.

**Order of implementation**:

1. **Types and defaults** (`types.ts`, `defaults.ts`): Define all interfaces, default weights, default thresholds.
2. **Utility functions** (`utils/`): Tokenizer, sentence splitter, bracket balance, URL extraction, date extraction, format detection.
3. **Pattern catalogs** (`patterns/`): Hedging phrases, refusal phrases, stopwords.
4. **Individual dimensions** (in order of dependency):
   a. `structural-validity.ts` -- foundational, needed by other dimensions to detect output format.
   b. `truncation-risk.ts` -- uses bracket balance utilities.
   c. `refusal-detection.ts` -- uses pattern catalog, independent of other dimensions.
   d. `content-coherence.ts` -- uses tokenizer, n-grams, sentence splitter.
   e. `hallucination-risk.ts` -- uses pattern catalog, URL extraction, date extraction.
   f. `schema-completeness.ts` -- uses JSON parsing utilities.
   g. `relevance.ts` -- uses tokenizer, stopwords.
   h. `format-compliance.ts` -- uses format detection.
5. **Composite score and grade()** (`grade.ts`): Weighted average, critical floors, report generation.
6. **Factory** (`grader.ts`): `createGrader()` with custom configuration.
7. **Public API** (`index.ts`): Export `grade`, `createGrader`, and all per-dimension functions.

### Phase 2: CLI

**Deliverables**: `output-grade` CLI with all options described in section 12.

1. Parse command-line arguments (using a lightweight argument parser -- no dependencies).
2. Read input from file or stdin.
3. Run `grade()` with options from CLI flags.
4. Format output as JSON or human-readable.
5. Exit with appropriate code.

### Phase 3: Testing and Calibration

**Deliverables**: Full test suite, performance benchmarks, score calibration.

1. Write unit tests for every dimension with the test cases described in section 13.
2. Write integration tests for `grade()` with various output types and configurations.
3. Write performance benchmarks and add them to CI.
4. Calibrate default weights and thresholds against a reference corpus of annotated LLM outputs. Adjust heuristic parameters until the 0.9+/0.4- correspondence targets are met.

### Phase 4: Documentation and Publishing

**Deliverables**: README, API documentation, npm publish.

1. Write README with quick start, API reference, and examples.
2. Add JSDoc comments to all public exports.
3. Publish to npm.

---

## 18. Example Use Cases

### Example 1: High-Quality JSON Output

**Input**:
```json
{"name": "Alice Johnson", "age": 32, "email": "alice@example.com", "hobbies": ["reading", "hiking", "photography"]}
```

**Context**: `schema` with required fields `name` (string), `age` (number), `email` (string), `hobbies` (string[]). `format`: `'json'`.

**Grade Report**:
```
score: 0.97
pass: true
dimensions:
  schema-completeness: 1.00  (all required fields present, correct types, non-empty)
  structural-validity: 1.00  (valid JSON)
  content-coherence: 0.88   (limited text to analyze, but string values are reasonable)
  hallucination-risk: 1.00  (no hedging, no suspicious URLs/dates)
  truncation-risk: 1.00     (complete, balanced brackets)
  refusal-detection: 1.00   (no refusal language)
  relevance: 0.95           (schema fields match output fields)
  format-compliance: 1.00   (JSON expected, JSON received)
signals: []
summary: "Output quality is high. No significant issues detected."
```

### Example 2: Truncated JSON Output

**Input**:
```
{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age
```

**Context**: `format`: `'json'`.

**Grade Report**:
```
score: 0.18
pass: false
dimensions:
  schema-completeness: 1.00  (no schema provided)
  structural-validity: 0.00  (unparseable JSON)
  content-coherence: 0.80   (text content in string values seems coherent)
  hallucination-risk: 1.00  (no hallucination indicators)
  truncation-risk: 0.10     (unclosed brackets at depth 3, mid-value truncation)
  refusal-detection: 1.00   (no refusal)
  relevance: 1.00           (no prompt provided)
  format-compliance: 0.20   (JSON expected, but JSON is not parseable)
signals:
  - { id: 'unclosed-bracket', severity: 'critical', message: 'Unclosed { at position 0' }
  - { id: 'unclosed-bracket', severity: 'critical', message: 'Unclosed [ at position 10' }
  - { id: 'unclosed-bracket', severity: 'critical', message: 'Unclosed { at position 42' }
  - { id: 'incomplete-value', severity: 'critical', message: 'Value truncated mid-token at end of output' }
summary: "Output quality is poor. 4 critical issue(s) detected: unclosed brackets at depth 3, output truncated mid-value. Retry recommended."
```

### Example 3: Full Refusal

**Input**:
```
I'm sorry, but as an AI language model, I cannot help with that request. It goes against my guidelines to provide information on that topic. I recommend consulting a qualified professional for assistance with your question.
```

**Context**: `prompt`: `'How do I pick a lock?'`.

**Grade Report**:
```
score: 0.05
pass: false
dimensions:
  schema-completeness: 1.00  (no schema provided)
  structural-validity: 1.00  (valid text)
  content-coherence: 0.92   (well-formed sentences, no repetition)
  hallucination-risk: 0.85  (minor: "as an AI language model" is a knowledge-cutoff-adjacent phrase)
  truncation-risk: 1.00     (complete sentences)
  refusal-detection: 0.00   (full refusal detected)
  relevance: 0.15           (low keyword overlap, output does not address the prompt)
  format-compliance: 1.00   (no format specified)
signals:
  - { id: 'full-refusal', severity: 'critical', message: 'Full refusal detected' }
  - { id: 'ai-identity-disclosure', severity: 'info', message: 'AI identity disclosure: "as an AI language model"' }
  - { id: 'refusal-phrase', severity: 'critical', message: 'Refusal phrase: "I cannot help with that request"' }
  - { id: 'refusal-phrase', severity: 'critical', message: 'Refusal phrase: "goes against my guidelines"' }
  - { id: 'refusal-redirect', severity: 'warning', message: 'Redirect detected: "I recommend consulting a qualified professional"' }
summary: "Output quality is poor. Full refusal detected. The model declined to answer the request. Retry recommended."
```

### Example 4: Repetition Loop

**Input**:
```
The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42. The answer is 42.
```

**Context**: `prompt`: `'What is the meaning of life?'`.

**Grade Report**:
```
score: 0.22
pass: false
dimensions:
  schema-completeness: 1.00  (no schema provided)
  structural-validity: 1.00  (valid text)
  content-coherence: 0.05   (extreme repetition: one sentence repeated 12 times, TTR: 0.08)
  hallucination-risk: 1.00  (no hallucination indicators)
  truncation-risk: 1.00     (complete)
  refusal-detection: 1.00   (no refusal)
  relevance: 0.40           (some keyword overlap: "answer", "meaning")
  format-compliance: 1.00   (no format specified)
signals:
  - { id: 'repetition-loop', severity: 'critical', message: 'Sentence "The answer is 42." repeats 12 times' }
  - { id: 'low-lexical-diversity', severity: 'critical', message: 'Type-token ratio: 0.08 (expected > 0.4)' }
summary: "Output quality is poor. Degenerate repetition loop detected: same sentence repeats 12 times. Retry recommended."
```

### Example 5: Hedging-Heavy Output with Fabricated Citation

**Input**:
```
I think the population of France is probably around 67 million people, though I'm not entirely sure about the exact figure. According to a study by Johnson et al. (2025) published in the International Journal of Population Demographics (http://www.ijpd-journal.org/articles/2025/population-france), the number might be approximately 66.9 million as of their last census. However, I believe these numbers could have changed since then.
```

**Context**: `prompt`: `'What is the population of France?'`.

**Grade Report**:
```
score: 0.41
pass: false
dimensions:
  schema-completeness: 1.00  (no schema provided)
  structural-validity: 1.00  (valid text)
  content-coherence: 0.85   (reasonable sentence structure, good lexical diversity)
  hallucination-risk: 0.20  (dense hedging: 4 hedging phrases in 3 sentences; suspicious URL; future-dated citation 2025)
  truncation-risk: 1.00     (complete)
  refusal-detection: 1.00   (no refusal)
  relevance: 0.80           (good keyword overlap: "population", "France")
  format-compliance: 1.00   (no format specified)
signals:
  - { id: 'hedging-phrase', severity: 'warning', message: 'Hedging phrase: "I think"' }
  - { id: 'hedging-phrase', severity: 'warning', message: 'Hedging phrase: "probably"' }
  - { id: 'hedging-phrase', severity: 'warning', message: 'Hedging phrase: "I\'m not entirely sure"' }
  - { id: 'hedging-phrase', severity: 'warning', message: 'Hedging phrase: "I believe"' }
  - { id: 'hedging-phrase', severity: 'warning', message: 'Hedging phrase: "approximately"' }
  - { id: 'fabricated-url', severity: 'critical', message: 'Suspicious URL: http://www.ijpd-journal.org/articles/2025/population-france' }
  - { id: 'implausible-citation', severity: 'warning', message: 'Citation dated 2025 may be fabricated (beyond current date)' }
summary: "Output quality is questionable. High hallucination risk: 5 hedging phrases detected, suspicious URL, implausible citation date. Consider retrying."
```

### Example 6: Good Markdown with Minor Issues

**Input**:
```markdown
# User Guide

## Installation

Install the package using npm:

```bash
npm install my-package
```

## Usage

Import the function and call it:

```typescript
import { greet } from 'my-package';

console.log(greet('world'));
```

## API

| Function | Description |
|---|---|
| `greet(name)` | Returns a greeting string |
| `farewell(name)` | Returns a farewell string |

#### Advanced Configuration

You can configure the package by...
```

**Context**: `format`: `'markdown'`, `prompt`: `'Write a user guide for my-package with installation, usage, and API sections'`.

**Grade Report**:
```
score: 0.89
pass: true
dimensions:
  schema-completeness: 1.00  (no schema)
  structural-validity: 0.90  (heading level skips from ## to ####)
  content-coherence: 0.92   (well-structured, good diversity)
  hallucination-risk: 1.00  (no indicators)
  truncation-risk: 0.85     (ends with "by..." -- possibly incomplete)
  refusal-detection: 1.00   (no refusal)
  relevance: 0.95           (strong keyword overlap: "install", "usage", "API", "package")
  format-compliance: 1.00   (markdown expected, markdown received)
signals:
  - { id: 'heading-level-skip', severity: 'info', message: 'Heading jumps from level 2 to level 4' }
  - { id: 'incomplete-sentence', severity: 'warning', message: 'Output ends with incomplete sentence: "You can configure the package by..."' }
summary: "Output quality is acceptable. 2 minor issue(s) detected: heading level skip, possibly incomplete ending."
```
