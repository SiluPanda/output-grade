# output-grade — Task Breakdown

## Phase 1: Project Scaffolding & Types

- [x] **Define TypeScript type definitions** — Create `src/types.ts` with all interfaces from the spec: `GradeReport`, `DimensionScores`, `Signal`, `SignalLocation`, `GradeMeta`, `DimensionResult`, `GradeOptions`, `CustomPatterns`, `JsonSchema`, `GraderConfig`, `Grader`. Include the severity union type `'info' | 'warning' | 'critical'`, the format union type `'json' | 'markdown' | 'code' | 'xml' | 'yaml' | 'text' | 'table' | 'list'`, and the dimension ID string literal union. All fields must match the spec exactly (section 8, Type Definitions). | Status: done

- [x] **Define default configuration constants** — Create `src/defaults.ts` with: default dimension weights (schema-completeness: 0.20, structural-validity: 0.20, content-coherence: 0.15, hallucination-risk: 0.15, truncation-risk: 0.10, refusal-detection: 0.10, relevance: 0.05, format-compliance: 0.05), redistributed weights for when optional dimensions are excluded, default pass threshold (0.7), default critical floor configurations (structural-validity: threshold 0.2/ceiling 0.3, truncation-risk: threshold 0.2/ceiling 0.3, refusal-detection: threshold 0.3/ceiling 0.2). | Status: done

- [x] **Set up development dependencies** — Install `typescript`, `vitest`, and `eslint` as dev dependencies. Configure ESLint for the project. Verify `npm run build`, `npm run test`, and `npm run lint` scripts all work with the empty project skeleton. | Status: done

- [x] **Create directory structure** — Create the directories `src/dimensions/`, `src/patterns/`, `src/utils/`, and `src/__tests__/` as specified in section 16 (File Structure). | Status: done

---

## Phase 2: Utility Functions

- [x] **Implement word tokenizer** — Create `src/utils/tokenizer.ts`. Split text on whitespace, strip leading/trailing punctuation from each token, lowercase, filter empty tokens. Must handle English text well and degrade gracefully (no crashes, no NaN) for non-Latin scripts (CJK, Arabic, Hebrew). This is a simple whitespace-and-punctuation tokenizer, not a linguistic tokenizer. | Status: done

- [x] **Implement sentence splitter** — Create `src/utils/sentences.ts`. Split text on `.`, `!`, `?` followed by whitespace and a capital letter (or end of string). Acceptable to mis-split abbreviations like "Dr. Smith" since off-by-one errors in sentence count have negligible impact on density calculations. | Status: done

- [x] **Implement n-gram computation** — Create `src/utils/ngrams.ts`. Compute n-gram frequency distributions (default: trigrams/3-grams) from a list of tokens. Return the frequency map and compute the repetition ratio: `(count of n-grams appearing more than once) / (total unique n-grams)`. | Status: done

- [ ] **Implement URL extraction and analysis** — Create `src/utils/url-extract.ts`. Extract URLs using regex `https?://[^\s<>"]+`. Analyze each URL for fabrication indicators: 5+ path segments, generic example domains (example.com, test.com, sample.org), implausible structure, known-domain path pattern mismatches (e.g., arxiv.org/abs/ with non-matching paper ID format). Return URLs with their positions and suspicion flags. | Status: not_done

- [ ] **Implement date extraction and validation** — Create `src/utils/date-extract.ts`. Extract dates in common formats: `YYYY-MM-DD`, `MM/DD/YYYY`, `Month DD, YYYY`, etc. Validate: month 1-12, day 1-31 with month-specific maximums, year 1900-2030 (configurable). Flag impossible dates (February 30, month 13, day 32) and future dates beyond a configurable horizon (default: 2 years from current date). Return dates with positions and validity flags. | Status: not_done

- [x] **Implement bracket balance checker** — Create `src/utils/bracket-balance.ts`. Count opening and closing brackets for each type: `{}`, `[]`, `()`, `<>`. Return the balance (opens minus closes) for each bracket type and the maximum unclosed nesting depth. | Status: done

- [x] **Implement lenient JSON parsing utilities** — Create `src/utils/json-parse.ts`. Attempt `JSON.parse()` first. On failure, attempt lenient parsing: strip markdown fences, trim whitespace. If lenient parse succeeds, report the wrapper. If it fails, analyze the parse error to detect common patterns: trailing commas, unquoted keys, single quotes. Return parse result with status and error details. | Status: done

- [x] **Implement output format detection** — Create `src/utils/format-detect.ts`. Auto-detect format if not provided by caller: attempt JSON parse (starts with `{` or `[`), check for markdown indicators (`#`, triple backticks, `-` lists), check for XML indicators (`<` tags). Default to `'text'` if nothing detected. Return the detected format string. | Status: done

---

## Phase 3: Pattern Catalogs

- [x] **Implement hedging phrase catalog** — Create `src/patterns/hedging.ts`. Build a catalog of compiled regular expressions (case-insensitive) for hedging phrases across five categories: belief qualifiers ("I think", "I believe", "I'm not sure", etc.), possibility markers ("probably", "possibly", "perhaps", etc.), approximation markers ("approximately", "roughly", etc.), uncertainty disclaimers ("I'm not 100% sure", "don't quote me on this", etc.), knowledge cutoff references ("as of my last update", "as of my knowledge cutoff", etc.). Each pattern tagged with category, severity, and dimension. All patterns must be ReDoS-safe (no nested quantifiers). | Status: done

- [x] **Implement refusal phrase catalog** — Create `src/patterns/refusal.ts`. Build compiled regex catalog for refusal phrases across six categories: direct refusal ("I can't help with that", "I cannot help with", etc.), policy citation ("against my guidelines", "violates my policies", etc.), safety refusal ("I can't provide information on", "I must decline", etc.), identity disclosure ("As an AI language model", "As an AI assistant", etc.), capability limitation ("I don't have access to", "I can't browse the internet", etc.), redirect ("I recommend consulting", "please consult a professional", etc.). All patterns ReDoS-safe. | Status: done

- [x] **Implement confidence inflation patterns** — Create `src/patterns/confidence.ts`. Build compiled regex catalog for confidence inflation phrases: "definitely", "certainly", "without a doubt", "100%", "guaranteed", "always", "never" when combined with factual claims. All patterns ReDoS-safe. | Status: done

- [x] **Implement English stopword list** — Create `src/patterns/stopwords.ts`. Export a list of ~150 English stopwords: articles (a, an, the), prepositions (in, on, at, by, for, with, to, from), conjunctions (and, or, but, so, yet), pronouns (I, you, he, she, it, we, they, me, him, her, us, them), common verbs (is, am, are, was, were, be, been, being, have, has, had, do, does, did), and other high-frequency, low-information words. List must be configurable/replaceable via grader config. | Status: done

---

## Phase 4: Grading Dimensions

### 4a: Structural Validity

- [x] **Implement JSON validity scoring** — In `src/dimensions/structural-validity.ts`, implement JSON validity checks: `JSON.parse()` success (1.0), lenient parse success (0.8), trailing comma (0.7), unquoted keys (0.6), single quotes (0.6), completely unparseable (0.0). Detect structural anomalies in valid JSON: deeply nested (depth > 20), extremely long strings (> 100KB), duplicate keys. Emit appropriate signals with locations. | Status: done

- [x] **Implement Markdown validity scoring** — In `structural-validity.ts`, add markdown checks: code fence balance (unclosed fence deducts 0.3, critical signal), heading hierarchy (skipped levels deduct 0.05 each, info signal), list consistency (mixed markers info signal, inconsistent indentation warning), link syntax validation (malformed `[text](url)` pairs warning signal). Base score 1.0 minus deductions, floored at 0.0. | Status: done

- [x] **Implement Code validity scoring** — In `structural-validity.ts`, add code checks: bracket balance (deduct 0.2 per unbalanced pair, critical signal), unterminated string literals (deduct 0.2, critical signal), incomplete constructs at end of output (trailing `=`, `:`, `,`, `(`, `{` — warning signal). | Status: done

- [x] **Implement XML validity scoring** — In `structural-validity.ts`, add XML checks: tag balance using a stack (deduct 0.2 per unmatched tag, critical signal), well-formedness checks (attribute syntax, proper nesting). | Status: done

- [x] **Implement Text validity scoring** — In `structural-validity.ts`, add text checks: text is always structurally valid (score 1.0). Check for encoding anomalies: garbled characters, replacement characters (U+FFFD), excessive control characters. Each anomaly type deducts 0.1 (info signal). | Status: done

- [x] **Implement format detection integration in structural validity** — Wire up format auto-detection in the structural validity dimension. If caller provides `format`, use that. Otherwise, call `format-detect.ts` to auto-detect and score accordingly. | Status: done

### 4b: Truncation Risk

- [x] **Implement unclosed bracket detection for truncation** — In `src/dimensions/truncation-risk.ts`, detect unclosed brackets using `bracket-balance.ts`. Severity increases with nesting depth. Score contribution: `1.0 - min(1.0, unclosedDepth * 0.3)`. Emit critical signals for each unclosed bracket type. | Status: done

- [x] **Implement incomplete sentence detection** — Detect whether the output ends with a complete sentence (terminal punctuation: `.`, `!`, `?`, `:`, `;`). Handle exceptions: JSON ending with `}` or `]` is complete; code ending with `}`, `)`, or `;` is complete. Incomplete ending: score 0.3. Add appropriate signals. | Status: done

- [x] **Implement unclosed markdown fence detection for truncation** — Detect opening triple backticks without matching close. Score contribution: 0.2 (strongly truncated). Emit critical signal. | Status: done

- [x] **Implement incomplete list detection** — Detect numbered lists with incomplete sequences: list that stops mid-item, or promises N items but contains fewer. Emit warning signals. | Status: done

- [x] **Implement abrupt ending pattern detection** — Detect: ellipsis at end after partial word/sentence, hyphenated word break ("impor-"), unclosed string literal (odd number of `"` in last line). Emit appropriate signals. | Status: done

- [x] **Implement content-length heuristic for truncation** — Detect obvious cases where output is suspiciously short relative to its content (e.g., starts with "Here are 10 examples:" but contains only 2). Emit warning signals when detected. | Status: done

- [x] **Implement truncation risk composite** — Combine sub-scores using minimum (worst-case approach). Truncation is binary-ish — the output is either complete or not — so the composite uses the worst indicator. Clamp final score to [0.0, 1.0]. | Status: done

### 4c: Refusal Detection

- [x] **Implement refusal phrase scanning** — In `src/dimensions/refusal-detection.ts`, scan output against the refusal phrase catalog. Collect all matches with locations and categories. | Status: done

- [x] **Implement refusal classification logic** — Classify as: full refusal (entire output is refusal messages, score 0.0), partial refusal (mix of refusal and substantive content, score: `1.0 - (refusalSentenceCount / totalSentenceCount)` clamped to [0.3, 0.9]), or no refusal (score 1.0). | Status: done

- [x] **Implement identity disclosure scoring** — "As an AI" type phrases: softer signal, deduct 0.05 per occurrence down to a floor of 0.7. Emit info signals for each disclosure. | Status: done

- [x] **Implement context-sensitive refusal detection** — When caller provides the original `prompt`, check whether the refusal is topically related to the prompt vs. a generic refusal. Report distinction in signals (does not change score). | Status: done

### 4d: Content Coherence

- [x] **Implement text content extraction for coherence** — In `src/dimensions/content-coherence.ts`, extract text content appropriately by format: JSON — extract all string values and concatenate; code — extract comments and string literals; text/markdown — use full output. | Status: done

- [x] **Implement n-gram repetition detection** — Compute 3-gram frequency distribution. Calculate repetition ratio: `(count of 3-grams appearing >1) / (total unique 3-grams)`. Ratio above 0.5 indicates significant repetition. Score: `1.0 - min(1.0, repetitionRatio * 1.5)`. | Status: done

- [x] **Implement sentence repetition detection** — Split into sentences, count exact duplicates. If >20% are duplicates, emit critical signal. Score: `1.0 - (duplicateSentenceCount / totalSentenceCount)`. | Status: done

- [x] **Implement sliding window repetition detection** — Check if any contiguous block of 50+ characters repeats verbatim within the output. Catches LLM repetition loops. Each detected block emits a critical signal. | Status: done

- [x] **Implement lexical diversity (Type-Token Ratio)** — Compute `uniqueWords / totalWords`. For outputs >500 words, use moving average TTR (sliding windows of 100 words). Score: `min(1.0, TTR / 0.4)`. Emit warning signal when TTR < 0.2. | Status: done

- [x] **Implement degenerate output detection** — Check for: empty/whitespace only (score 0.0, critical), single character repeated (score 0.0, critical), less than 10 chars for non-trivial prompt (score 0.2, warning), more than 90% punctuation/special characters (score 0.1, critical). | Status: done

- [x] **Implement sentence structure analysis** — Check for recognizable sentence structure (capitalization, terminal punctuation). Compute average sentence length. Extremely short (<3 words) or extremely long (>100 words) average adds warning signal. Score: sigmoid centered at 15-20 words per sentence. | Status: done

- [x] **Implement content coherence composite** — Weighted average of sub-metrics: repetition detection 0.5, lexical diversity 0.25, degenerate output 0.15, sentence structure 0.10. Clamp to [0.0, 1.0]. | Status: done

### 4e: Hallucination Risk

- [x] **Implement hedging language detection** — In `src/dimensions/hallucination-risk.ts`, scan for hedging phrases using the hedging catalog. Compute hedging density: `hedgingPhraseCount / sentenceCount`. Score: `1.0 - min(1.0, hedgingDensity * 2.5)`. Emit warning signals for each phrase with location. | Status: done

- [x] **Implement fabricated URL detection** — Extract URLs using `url-extract.ts`. Check each for fabrication indicators (5+ path segments, generic example domains, implausible structure, known-domain path mismatches). Each suspicious URL emits warning signal. More than 2 suspicious URLs emit critical signal. Score: `1.0 - min(1.0, suspiciousUrlCount * 0.3)`. | Status: done

- [x] **Implement fabricated citation detection** — Scan for academic citation patterns: `Author (Year)`, `Author et al. (Year)`, `[N]` references, `(Author, Year)`. Plausibility checks: year range (before 1900 or after current year), single-word author names that look like common nouns, very long/unusual journal names. Score: `1.0 - min(1.0, implausibleCitationCount * 0.25)`. | Status: done

- [x] **Implement impossible date detection** — Extract dates using `date-extract.ts`. Flag impossible dates (Feb 30, month 13, day 32) as critical signals, future dates beyond horizon as warning signals. Score: `1.0 - min(1.0, impossibleDateCount * 0.4)`. | Status: done

- [x] **Implement self-contradiction detection** — Scan for explicit contradiction patterns: "however, this is not true" after declarative statements, "actually" or "correction" mid-output, negation of previously stated claims with same noun phrases. Each contradiction emits warning signal. Score: `1.0 - min(1.0, contradictionCount * 0.3)`. | Status: done

- [x] **Implement confidence inflation detection** — Scan for high-confidence phrases ("definitely", "certainly", "without a doubt", "100%", "guaranteed", "always", "never") combined with factual claims. Each occurrence emits info signal. Score: `1.0 - min(1.0, inflationCount * 0.1)`. | Status: done

- [x] **Implement hallucination risk composite** — Combine sub-scores using minimum (worst-case approach). One strongly present indicator floors the entire score. Clamp to [0.0, 1.0]. | Status: done

### 4f: Schema Completeness

- [x] **Implement JSON parsing for schema scoring** — In `src/dimensions/schema-completeness.ts`, attempt to parse output as JSON. If parsing fails, return score 0.0 with critical signal. If no schema provided, return score 1.0 (neutral). | Status: done

- [x] **Implement required field checking** — For each required field in schema: check existence (missing = critical signal, sub-score 0), check type correctness (wrong type = warning signal, sub-score 0.5), check emptiness (empty string/array/null/undefined = warning signal, sub-score 0.7), correct field = sub-score 1.0. | Status: done

- [x] **Implement optional field checking** — For optional fields: present and correct type = 1.0, present but wrong type = 0.5, missing = 0.8 (not penalized heavily). Optional fields contribute with half the weight of required fields. | Status: done

- [x] **Implement array field validation** — Check minimum length when `minItems` is specified. Empty array when `minItems: 1` adds warning signal. | Status: done

- [x] **Implement nested object recursion** — For nested objects, recurse into the child schema. The nested object's completeness score contributes to the parent field's sub-score. | Status: done

- [x] **Implement schema completeness composite** — Weighted average of all field sub-scores: required fields weighted 1.0, optional fields weighted 0.5. Clamp to [0.0, 1.0]. | Status: done

### 4g: Relevance

- [x] **Implement keyword extraction from prompt** — In `src/dimensions/relevance.ts`, tokenize the prompt, lowercase, remove stopwords (using built-in or configured list), remove single-character tokens. Return the prompt's keyword set. If no prompt provided, return score 1.0 (neutral). | Status: done

- [x] **Implement keyword overlap scoring** — Compute: `keywordOverlap = |promptKeywords intersection outputKeywords| / |promptKeywords|`. Score: `min(1.0, keywordOverlap * 1.5)` (0.67 overlap gives perfect score). | Status: done

- [x] **Implement structural alignment checking** — Detect structural instructions in the prompt: "list"/"enumerate"/"bullet" -> check for list items; "JSON"/"object"/"structured" -> check for JSON; "code"/"function"/"implement" -> check for code/fences; "table"/"columns" -> check for table structure. Deduct 0.1-0.3 for mismatches. | Status: done

- [x] **Implement topic drift detection** — Split output into quarters. Compute keyword overlap of each quarter with the prompt. If first quarter has high overlap (>0.5) but last quarter has low overlap (<0.1), add warning signal and deduct 0.15. | Status: done

- [x] **Implement length reasonableness checking** — If prompt implies detailed response ("explain in detail", "comprehensive", "write a long") but output < 100 chars, deduct 0.2. If prompt implies brief response ("in one sentence", "briefly", "summarize") but output > 2000 chars, deduct 0.1. | Status: done

- [x] **Implement expected output comparison** — When caller provides `expected` output, compute token-level Jaccard similarity: `|expectedTokens intersection outputTokens| / |expectedTokens union outputTokens|`. Blend with keyword overlap: `similarity * 0.5 + keywordOverlapScore * 0.5`. | Status: done

- [x] **Implement relevance composite** — Weighted average: keyword overlap 0.5, structural alignment 0.2, topic drift 0.15, length reasonableness 0.15. Clamp to [0.0, 1.0]. | Status: done

### 4h: Format Compliance

- [x] **Implement expected format determination** — In `src/dimensions/format-compliance.ts`, determine expected format from the `format` option (explicit) or by detecting format instructions in the prompt: "JSON" -> json, "markdown" -> markdown, "code"/"function"/"implement" -> code, "XML" -> xml, "YAML" -> yaml, "table" -> table, "list"/"bullet points" -> list. If no format detected, return 1.0 (neutral). | Status: done

- [x] **Implement JSON compliance checking** — When JSON expected: pure JSON = 1.0, JSON in fence = 0.9, JSON extractable from prose = 0.7, no JSON found = 0.0. | Status: done

- [x] **Implement Markdown compliance checking** — When markdown expected: rich markdown formatting = 1.0, minimal formatting = 0.7, plain text with no markdown = 0.3. | Status: done

- [x] **Implement Code compliance checking** — When code expected: code in fence = 1.0, recognizable code without fence = 0.8, no code = 0.0. | Status: done

- [x] **Implement XML compliance checking** — When XML expected: well-formed XML = 1.0, partial XML = 0.5, no XML = 0.0. | Status: done

- [x] **Implement YAML compliance checking** — When YAML expected: valid YAML key-value patterns = 1.0, partial = 0.5, no YAML = 0.0. | Status: done

- [x] **Implement Table compliance checking** — When table expected: markdown table or tab-separated data = 1.0, list found instead = 0.4, neither = 0.0. | Status: done

- [x] **Implement List compliance checking** — When list expected: list items (lines starting with `-`, `*`, `1.`) = 1.0, paragraphs instead = 0.3, empty/irrelevant = 0.0. | Status: done

- [x] **Implement format purity scoring** — For JSON format: deduct 0.1-0.2 for non-JSON content surrounding the JSON (preamble, postamble, explanatory prose) based on the ratio of noise to content. | Status: done

---

## Phase 5: Composite Score & Grade Report

- [x] **Implement weight redistribution logic** — In `src/grade.ts`, implement the logic to set non-applicable dimension weights to zero (schema-completeness when no schema, relevance when no prompt, format-compliance when no format) and redistribute remaining weights proportionally so they sum to 1.0. | Status: done

- [x] **Implement weighted average composite score** — Compute: `compositeScore = sum(dimensionScore_i * weight_i) / sum(weight_i)` over all applicable dimensions. | Status: done

- [x] **Implement critical dimension floor capping** — After computing weighted average, check each critical dimension against its floor threshold. If any critical dimension is below its threshold, cap composite score at the configured ceiling value. Record which floor was triggered in `meta.criticalFloorTriggered`. | Status: done

- [x] **Implement summary generation** — Generate `summary` field using template logic (not LLM): score >= 0.9 -> "high quality, no significant issues"; 0.7-0.89 -> "acceptable, N minor issues: {top issues}"; 0.4-0.69 -> "questionable, N issues: {top issues}, consider retrying"; <0.4 -> "poor, N critical issues: {top issues}, retry recommended". Top issues are 1-3 most severe signals described in natural language. | Status: done

- [x] **Implement signal ordering** — Sort signals by: (1) severity (critical first, warning, info), (2) dimension order (refusal, truncation, structural, schema, hallucination, coherence, relevance, format), (3) location (earlier first). | Status: done

- [x] **Implement GradeReport assembly** — Assemble the complete `GradeReport` object: composite score, pass/fail determination (score >= passThreshold), passThreshold, dimension scores, ordered signals, summary, and meta (durationMs, weights used, applicable dimensions, critical floor triggered, detected format, output length). Ensure report is a plain object serializable with `JSON.stringify()`. | Status: done

- [x] **Implement the main `grade()` function** — Wire up the full pipeline: validate input, detect format, run all 8 dimension scorers, compute composite score with weight redistribution and critical floors, generate summary, assemble and return GradeReport. Handle empty/null/undefined input as a hard floor (score 0.0, all minimums, critical signal `empty-output`). | Status: done

- [x] **Implement pass/fail threshold logic** — The `pass` field is `true` when `score >= passThreshold`. Default passThreshold is 0.7, configurable via options. | Status: done

---

## Phase 6: Grader Factory

- [ ] **Implement `createGrader()` factory** — In `src/grader.ts`, implement `createGrader(config)` that accepts `GraderConfig` (weights, passThreshold, criticalFloors, customPatterns, stopwords). Returns a `Grader` instance whose `grade()` merges instance config with per-call options. Parse configuration once so it is reused across calls. | Status: not_done

- [ ] **Implement custom pattern merging in grader** — Custom patterns provided to `createGrader()` are appended to the built-in catalog (not replacements). Ensure the merged pattern catalog is built once at construction time and reused for all subsequent `grade()` calls. | Status: not_done

- [ ] **Implement per-dimension methods on grader instance** — Expose `gradeSchema`, `gradeStructure`, `gradeCoherence`, `detectHallucinations`, `detectTruncation`, `detectRefusal`, `gradeRelevance`, `gradeFormatCompliance` on the grader instance, each using the instance's custom configuration (custom patterns, stopwords). | Status: not_done

---

## Phase 7: Public API Exports

- [ ] **Implement public API in `src/index.ts`** — Export: `grade` (main function), `createGrader` (factory), and all per-dimension functions (`gradeSchema`, `gradeStructure`, `gradeCoherence`, `detectHallucinations`, `detectTruncation`, `detectRefusal`, `gradeRelevance`, `gradeFormatCompliance`). Also export all type interfaces for TypeScript consumers. Verify the module compiles and all exports resolve correctly. | Status: not_done

---

## Phase 8: CLI

- [ ] **Implement CLI argument parser** — In `src/cli.ts`, implement a lightweight argument parser (no dependencies) that handles all flags: `--format <format>`, `--schema <file>`, `--prompt <text>`, `--prompt-file <file>`, `--threshold <number>`, `--json`, `--score-only`, `--dimensions`, `--signals`, `--verbose`. Parse the positional argument as an optional file path. | Status: not_done

- [ ] **Implement CLI input reading** — Read LLM output from the file argument (if provided) or from stdin (if no file). Handle errors: unreadable file, empty stdin, etc. Exit with code 2 for usage errors. | Status: not_done

- [ ] **Implement CLI schema file loading** — When `--schema <file>` is provided, read and parse the JSON Schema file. Exit with code 2 if file is unreadable or not valid JSON. | Status: not_done

- [ ] **Implement CLI prompt file loading** — When `--prompt-file <file>` is provided, read the file contents as the prompt string. Exit with code 2 if file is unreadable. | Status: not_done

- [ ] **Implement CLI human-readable output** — Default output mode. Display: "Grade: X.XX (PASS/FAIL)", per-dimension scores with checkmark/warning indicators (when `--dimensions` or `--verbose`), signals list (when `--signals` or `--verbose`), summary text. Match the format shown in spec section 12. | Status: not_done

- [ ] **Implement CLI JSON output** — When `--json` is provided, output the full GradeReport as formatted JSON to stdout. | Status: not_done

- [ ] **Implement CLI score-only output** — When `--score-only` is provided, output only the composite score as a single number to stdout. | Status: not_done

- [ ] **Implement CLI exit codes** — Exit 0 when output passes threshold (grade >= threshold), exit 1 when output fails threshold (grade < threshold), exit 2 for usage errors (invalid options, missing input, unreadable file). | Status: not_done

- [ ] **Configure CLI bin entry point** — Add `"bin": { "output-grade": "dist/cli.js" }` to `package.json`. Ensure `cli.ts` has proper shebang (`#!/usr/bin/env node`) and is executable after build. | Status: not_done

---

## Phase 9: Unit Tests — Dimension Tests

### Schema Completeness Tests

- [ ] **Test schema completeness: all fields present and correct types** — Input with all required fields present, correct types, non-empty. Expect score ~1.0, no critical signals. | Status: not_done

- [ ] **Test schema completeness: required field missing** — Input missing one required field. Expect score drops proportionally, critical signal `missing-required-field`. | Status: not_done

- [ ] **Test schema completeness: wrong type on required field** — Field exists but has wrong type (e.g., string instead of number). Expect score drops less than missing, warning signal `wrong-type`. | Status: not_done

- [ ] **Test schema completeness: empty required field** — Required field present but empty (empty string, empty array, null). Expect warning signal `empty-required-field`, sub-score 0.7. | Status: not_done

- [ ] **Test schema completeness: nested object with missing fields** — Nested object schema with missing fields at the nested level. Verify recursive scoring works correctly. | Status: not_done

- [ ] **Test schema completeness: no schema provided** — No schema in options. Expect score 1.0, no signals. | Status: not_done

- [ ] **Test schema completeness: output is not valid JSON** — Invalid JSON input when schema is provided. Expect score 0.0, critical signal. | Status: not_done

- [ ] **Test schema completeness: optional fields handling** — Optional fields missing, present with correct type, and present with wrong type. Verify half-weight contribution and correct sub-scores (0.8 for missing, 0.5 for wrong type, 1.0 for correct). | Status: not_done

- [ ] **Test schema completeness: array minItems validation** — Array field with `minItems: 1` but empty array. Expect warning signal. | Status: not_done

### Structural Validity Tests

- [ ] **Test structural validity: valid JSON** — Well-formed JSON input. Expect score 1.0. | Status: not_done

- [ ] **Test structural validity: JSON with trailing comma** — JSON with trailing comma. Expect score ~0.7, warning signal. | Status: not_done

- [ ] **Test structural validity: completely unparseable text as JSON** — Garbage text when format is JSON. Expect score 0.0, critical signal. | Status: not_done

- [ ] **Test structural validity: JSON wrapped in markdown fences** — JSON inside triple backticks. Expect score ~0.8 (lenient parse succeeds), info signal for wrapper. | Status: not_done

- [ ] **Test structural validity: markdown with unclosed fence** — Markdown with opening triple backticks but no closing. Expect score drops by 0.3, critical signal. | Status: not_done

- [ ] **Test structural validity: markdown heading level skip** — Markdown jumping from `##` to `####`. Expect score drops by 0.05, info signal. | Status: not_done

- [ ] **Test structural validity: balanced brackets in code** — Code with all brackets balanced. Expect score 1.0. | Status: not_done

- [ ] **Test structural validity: unbalanced brackets in code** — Code with unbalanced brackets. Expect deduction 0.2 per pair, critical signal. | Status: not_done

- [ ] **Test structural validity: XML with balanced tags** — Well-formed XML. Expect score 1.0. | Status: not_done

- [ ] **Test structural validity: XML with unbalanced tags** — XML with unmatched tags. Expect deduction 0.2 per unmatched tag, critical signal. | Status: not_done

- [ ] **Test structural validity: text with encoding anomalies** — Text with replacement characters (U+FFFD). Expect deduction 0.1, info signal. | Status: not_done

- [ ] **Test structural validity: format auto-detection** — Test that format is correctly auto-detected when not explicitly provided. | Status: not_done

### Content Coherence Tests

- [ ] **Test coherence: normal prose** — Well-written paragraph with diverse vocabulary. Expect high score (>0.8). | Status: not_done

- [ ] **Test coherence: repeated sentence** — Same sentence repeated 10+ times. Expect low score, critical signal `repetition-loop`. | Status: not_done

- [ ] **Test coherence: empty output** — Empty string. Expect score 0.0, critical signal `degenerate-output`. | Status: not_done

- [ ] **Test coherence: single character repeated** — One character repeated 1000 times. Expect score 0.0, critical signal. | Status: not_done

- [ ] **Test coherence: high lexical diversity** — Text with many unique words. Expect high TTR, high score. | Status: not_done

- [ ] **Test coherence: low lexical diversity** — Same 5 words repeated many times. Expect low TTR, low score, warning signal `low-lexical-diversity`. | Status: not_done

- [ ] **Test coherence: sliding window repetition** — 50+ character block repeated verbatim. Expect critical signal. | Status: not_done

- [ ] **Test coherence: very short output** — Output less than 10 characters. Expect score 0.2, warning signal. | Status: not_done

- [ ] **Test coherence: 90%+ punctuation** — Output mostly punctuation/special characters. Expect score 0.1, critical signal. | Status: not_done

### Hallucination Risk Tests

- [ ] **Test hallucination: no hedging phrases** — Clean text with no hedging. Expect score 1.0, no signals. | Status: not_done

- [ ] **Test hallucination: dense hedging** — Text with many hedging phrases ("I think... probably... maybe..."). Expect low score, multiple warning signals. | Status: not_done

- [ ] **Test hallucination: fabricated URL** — Text containing a clearly fabricated URL with many path segments. Expect score drops, critical/warning signal `fabricated-url`. | Status: not_done

- [ ] **Test hallucination: impossible date** — Text with February 30 or similar impossible date. Expect score drops, critical signal. | Status: not_done

- [ ] **Test hallucination: future-dated citation** — Citation with year beyond current year. Expect warning signal `implausible-citation`. | Status: not_done

- [ ] **Test hallucination: self-contradiction** — Text that contradicts itself explicitly. Expect warning signal, score drops. | Status: not_done

- [ ] **Test hallucination: confidence inflation** — Text with "definitely", "without a doubt" on factual claims. Expect info signals, minor score deduction. | Status: not_done

- [ ] **Test hallucination: composite uses minimum** — Verify that the hallucination composite takes the minimum of all sub-scores, not an average. | Status: not_done

### Truncation Risk Tests

- [ ] **Test truncation: complete output ending with period** — Normal text ending with `.`. Expect score 1.0. | Status: not_done

- [ ] **Test truncation: JSON with unclosed bracket** — JSON missing closing brackets. Expect very low score, critical signals. | Status: not_done

- [ ] **Test truncation: text ending mid-sentence** — Text ending with a comma or conjunction. Expect low score. | Status: not_done

- [ ] **Test truncation: markdown with unclosed code fence** — Markdown with opening fence but no closing. Expect low score, critical signal. | Status: not_done

- [ ] **Test truncation: complete JSON structure** — Valid complete JSON. Expect score 1.0. | Status: not_done

- [ ] **Test truncation: incomplete numbered list** — Numbered list that stops mid-item or has fewer items than promised. Expect warning signal. | Status: not_done

- [ ] **Test truncation: abrupt ending with ellipsis** — Text ending with "..." after partial sentence. Expect signal for abrupt ending. | Status: not_done

- [ ] **Test truncation: hyphenated word break at end** — Text ending with "impor-". Expect signal for truncated word. | Status: not_done

### Refusal Detection Tests

- [ ] **Test refusal: normal answer** — Standard helpful response. Expect score 1.0, no refusal signals. | Status: not_done

- [ ] **Test refusal: full refusal** — "I can't help with that request." Expect score 0.0, critical signal `full-refusal`. | Status: not_done

- [ ] **Test refusal: partial refusal** — Answer with disclaimer/caveat mixed with substantive content. Expect intermediate score (0.3-0.9). | Status: not_done

- [ ] **Test refusal: AI identity disclosure only** — "As an AI language model" followed by a real answer. Expect slight deduction (floor 0.7), info signal. | Status: not_done

- [ ] **Test refusal: multiple refusal categories** — Output hitting multiple refusal categories (direct refusal + policy citation + redirect). Expect very low score. | Status: not_done

### Relevance Tests

- [ ] **Test relevance: output directly addresses prompt** — High keyword overlap between prompt and output. Expect high score. | Status: not_done

- [ ] **Test relevance: completely different topic** — Output has zero keyword overlap with prompt. Expect low score. | Status: not_done

- [ ] **Test relevance: no prompt provided** — No prompt in options. Expect score 1.0 (neutral). | Status: not_done

- [ ] **Test relevance: structural alignment match** — Prompt asks for JSON, output is JSON. Expect structural alignment bonus. | Status: not_done

- [ ] **Test relevance: structural alignment mismatch** — Prompt asks for JSON, output is prose. Expect deduction. | Status: not_done

- [ ] **Test relevance: topic drift** — Output starts on-topic but drifts off-topic in the second half. Expect warning signal, deduction. | Status: not_done

- [ ] **Test relevance: length reasonableness** — Prompt asks for detail, output is very short. Expect deduction. | Status: not_done

- [ ] **Test relevance: expected output comparison** — Caller provides expected output. Verify Jaccard similarity is computed and blended with keyword overlap. | Status: not_done

### Format Compliance Tests

- [x] **Test format compliance: JSON expected, JSON received** — Expect score 1.0. | Status: done

- [x] **Test format compliance: JSON expected, prose received** — Expect score 0.0. | Status: done

- [x] **Test format compliance: markdown expected, markdown received** — Expect score 1.0. | Status: done

- [x] **Test format compliance: no format specified** — Expect score 1.0 (neutral). | Status: done

- [x] **Test format compliance: JSON in fence** — JSON expected, JSON received inside code fence. Expect score 0.9. | Status: done

- [x] **Test format compliance: code expected, code in fence** — Expect score 1.0. | Status: done

- [x] **Test format compliance: table expected, list received** — Expect score 0.4. | Status: done

- [x] **Test format compliance: format purity** — JSON expected, JSON received with preamble text. Expect deduction of 0.1-0.2. | Status: done

- [x] **Test format compliance: format detected from prompt** — No explicit format option but prompt says "return JSON". Verify format is detected from prompt and compliance is evaluated. | Status: done

---

## Phase 10: Integration & Composite Tests

- [x] **Test composite: all dimensions at 1.0** — All dimensions score perfectly. Expect composite 1.0. | Status: done

- [x] **Test composite: critical dimension below floor caps composite** — Refusal detection at 0.0 should cap composite at 0.2 regardless of other scores. | Status: done

- [x] **Test composite: custom weights applied** — Provide custom weights, verify composite reflects them correctly. | Status: done

- [x] **Test composite: weight redistribution** — When schema, prompt, and format are all absent, verify the always-on dimensions have their weights normalized to sum to 1.0 (structural-validity: 0.286, content-coherence: 0.214, hallucination-risk: 0.214, truncation-risk: 0.143, refusal-detection: 0.143). | Status: done

- [x] **Test composite: pass threshold comparison** — Verify `pass` is true when `score >= threshold` and false when `score < threshold`. Test with custom threshold values. | Status: done

- [x] **Test grade(): full integration with JSON output** — Grade a well-formed JSON output with schema, prompt, and format. Verify all dimensions score, composite is computed, report is complete. Match Example 1 from spec section 18. | Status: done

- [ ] **Test grade(): full integration with truncated output** — Grade a truncated JSON output. Match Example 2 from spec section 18. | Status: not_done

- [x] **Test grade(): full integration with refusal output** — Grade a full refusal. Match Example 3 from spec section 18. | Status: done

- [ ] **Test grade(): full integration with repetition loop** — Grade a repetition loop output. Match Example 4 from spec section 18. | Status: not_done

- [ ] **Test grade(): full integration with hedging/hallucination** — Grade hedging-heavy output with fabricated citation. Match Example 5 from spec section 18. | Status: not_done

- [ ] **Test grade(): full integration with markdown output** — Grade markdown with minor issues. Match Example 6 from spec section 18. | Status: not_done

- [ ] **Test createGrader(): factory with custom config** — Create grader with custom weights, threshold, and custom patterns. Verify grade() uses merged config. | Status: not_done

- [ ] **Test createGrader(): custom patterns are appended** — Verify custom patterns are appended to built-in catalog, not replacements. | Status: not_done

- [ ] **Test createGrader(): per-dimension methods use custom config** — Call `grader.detectHallucinations()` with custom hedging patterns and verify they are used. | Status: not_done

---

## Phase 11: Signal Tests

- [ ] **Test signal structure** — Verify each signal type has correct `id`, `severity`, `dimension`, and `message` fields matching the spec. | Status: not_done

- [ ] **Test signal locations** — Verify signal locations (start/end character offsets) point to the correct positions in the output text. | Status: not_done

- [ ] **Test signal ordering in report** — Verify signals are ordered by severity (critical first), then dimension order, then location (earlier first). | Status: not_done

---

## Phase 12: Edge Case Tests

- [ ] **Test edge case: empty string input** — Empty string passed to `grade()`. Expect score 0.0, `empty-output` critical signal. | Status: not_done

- [ ] **Test edge case: null/undefined input** — `null` or `undefined` passed to `grade()`. Expect score 0.0, `empty-output` critical signal. | Status: not_done

- [ ] **Test edge case: whitespace-only input** — Input containing only spaces, tabs, newlines. Treated as empty. Expect score 0.0. | Status: not_done

- [ ] **Test edge case: very long input (100KB+)** — Verify grading completes without errors on large inputs. | Status: not_done

- [ ] **Test edge case: input containing only numbers** — Numeric-only text. Should be valid text with potentially low coherence. | Status: not_done

- [ ] **Test edge case: non-UTF-8/replacement characters** — Input with U+FFFD characters. Expect graceful handling, info signal for encoding anomalies. | Status: not_done

- [ ] **Test edge case: mixed language text** — Input with non-Latin script. Tokenization degrades gracefully, no crashes, no NaN. | Status: not_done

- [ ] **Test edge case: score normalization** — Verify all dimension scores are clamped to [0.0, 1.0]. No NaN, no negative values, no values >1.0. | Status: not_done

- [ ] **Test edge case: report serialization** — Verify `JSON.stringify(report)` produces valid JSON with no circular references, no functions, no class instances. | Status: not_done

---

## Phase 13: Performance Tests

- [ ] **Benchmark: typical output (500 chars)** — Grade a 500-character LLM output. Verify completion under 0.5ms. | Status: not_done

- [ ] **Benchmark: large output (10,000 chars)** — Grade a 10,000-character output. Verify completion under 2ms. | Status: not_done

- [ ] **Benchmark: very large output (100,000 chars)** — Grade a 100,000-character output. Verify completion under 10ms. | Status: not_done

- [ ] **Test ReDoS safety** — Run all pattern catalogs against adversarial inputs designed to trigger catastrophic backtracking. Verify no pattern takes more than 10ms. | Status: not_done

---

## Phase 14: CLI Tests

- [ ] **Test CLI: read from stdin** — Pipe output to CLI via stdin, verify correct grade report on stdout. | Status: not_done

- [ ] **Test CLI: read from file** — Pass a file path argument, verify CLI reads and grades it correctly. | Status: not_done

- [ ] **Test CLI: --json flag** — Verify JSON output mode produces valid, parseable JSON matching GradeReport structure. | Status: not_done

- [ ] **Test CLI: --score-only flag** — Verify only a single number is printed to stdout. | Status: not_done

- [ ] **Test CLI: --format flag** — Verify format option is passed through to `grade()`. | Status: not_done

- [ ] **Test CLI: --schema flag** — Verify schema file is loaded and used for grading. | Status: not_done

- [ ] **Test CLI: --prompt and --prompt-file flags** — Verify prompt is passed through correctly from both text and file sources. | Status: not_done

- [ ] **Test CLI: --threshold flag** — Verify custom threshold affects pass/fail determination and exit code. | Status: not_done

- [ ] **Test CLI: --dimensions flag** — Verify per-dimension scores are shown in human-readable output. | Status: not_done

- [ ] **Test CLI: --signals flag** — Verify signals are shown in human-readable output. | Status: not_done

- [ ] **Test CLI: --verbose flag** — Verify all details (dimensions + signals + metadata) are shown. | Status: not_done

- [ ] **Test CLI: exit code 0 for pass** — Output above threshold. Verify exit code 0. | Status: not_done

- [ ] **Test CLI: exit code 1 for fail** — Output below threshold. Verify exit code 1. | Status: not_done

- [ ] **Test CLI: exit code 2 for usage error** — Invalid options, missing input, unreadable file. Verify exit code 2. | Status: not_done

---

## Phase 15: Documentation

- [ ] **Write README** — Create `README.md` with: package description, installation instructions (`npm install output-grade`), quick start examples (basic usage, context-aware grading, per-dimension functions, createGrader factory), CLI usage with all flags, API reference for all exports, dimension descriptions with scoring ranges, configuration guide (weights, thresholds, custom patterns), integration examples (llm-retry, monitoring, CI/CD, llm-output-normalizer). | Status: not_done

- [ ] **Add JSDoc comments to all public exports** — Add comprehensive JSDoc comments to `grade()`, `createGrader()`, all per-dimension functions, and all exported interfaces/types. Include parameter descriptions, return type descriptions, and usage examples in JSDoc. | Status: not_done

---

## Phase 16: Final Integration & Publishing Prep

- [ ] **Verify zero runtime dependencies** — Confirm `package.json` has no `dependencies` field (only `devDependencies`). All heuristics use built-in JavaScript/Node.js capabilities. | Status: not_done

- [ ] **Verify TypeScript compilation** — Run `npm run build` and verify clean compilation with no errors or warnings. Check that `dist/` output includes `.js`, `.d.ts`, and `.d.ts.map` files. | Status: not_done

- [ ] **Verify all tests pass** — Run `npm run test` and verify 100% pass rate across all test suites. | Status: not_done

- [ ] **Verify lint passes** — Run `npm run lint` with no errors or warnings. | Status: not_done

- [ ] **Verify package.json metadata** — Ensure `name`, `version`, `description`, `main`, `types`, `files`, `bin`, `engines`, `license`, and `publishConfig` fields are all correct. | Status: not_done

- [ ] **Bump version in package.json** — Bump version appropriately before publishing (initial release: 1.0.0 or 0.1.0 depending on stability assessment). | Status: not_done

- [ ] **End-to-end smoke test** — Run the CLI against real LLM output samples (JSON, markdown, code, prose, refusal, truncated, repetitive). Verify scores are reasonable and match spec examples. | Status: not_done
