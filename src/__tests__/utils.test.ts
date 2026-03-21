import { describe, it, expect } from 'vitest';
import { tokenize } from '../utils/tokenizer';
import { splitSentences } from '../utils/sentences';
import { computeNgrams, repetitionRatio } from '../utils/ngrams';
import { detectFormat } from '../utils/format-detect';
import { checkBracketBalance } from '../utils/bracket-balance';
import { lenientJsonParse } from '../utils/json-parse';

// ── Tokenizer ────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('tokenizes English text into lowercase words', () => {
    const tokens = tokenize('Hello World, this is a Test.');
    expect(tokens).toEqual(['hello', 'world', 'this', 'is', 'a', 'test']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(tokenize('   \t\n  ')).toEqual([]);
  });

  it('strips leading and trailing punctuation', () => {
    const tokens = tokenize('"quoted" (parens) [brackets] {braces}');
    expect(tokens).toEqual(['quoted', 'parens', 'brackets', 'braces']);
  });

  it('handles mixed punctuation and text', () => {
    const tokens = tokenize('---hello--- ***world***');
    expect(tokens).toEqual(['hello', 'world']);
  });

  it('handles Unicode/non-Latin text without crashing', () => {
    // Should not throw; results may vary but must not crash or produce NaN
    const tokens = tokenize('hello world');
    expect(tokens).toBeInstanceOf(Array);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('handles CJK text without crashing', () => {
    const tokens = tokenize('something something');
    expect(tokens).toBeInstanceOf(Array);
  });

  it('handles Arabic text without crashing', () => {
    const tokens = tokenize('hello world');
    expect(tokens).toBeInstanceOf(Array);
  });

  it('handles numbers in text', () => {
    const tokens = tokenize('There are 42 items.');
    expect(tokens).toEqual(['there', 'are', '42', 'items']);
  });

  it('collapses multiple spaces', () => {
    const tokens = tokenize('hello    world');
    expect(tokens).toEqual(['hello', 'world']);
  });
});

// ── Sentences ────────────────────────────────────────────────────────────────

describe('splitSentences', () => {
  it('splits multiple sentences', () => {
    const sentences = splitSentences('Hello world. This is great! Is it? Yes.');
    expect(sentences).toHaveLength(4);
    expect(sentences[0]).toBe('Hello world.');
    expect(sentences[1]).toBe('This is great!');
    expect(sentences[2]).toBe('Is it?');
    expect(sentences[3]).toBe('Yes.');
  });

  it('returns single sentence when no split points', () => {
    const sentences = splitSentences('Hello world');
    expect(sentences).toEqual(['Hello world']);
  });

  it('returns single sentence for text without terminal punctuation', () => {
    const sentences = splitSentences('no punctuation at the end');
    expect(sentences).toEqual(['no punctuation at the end']);
  });

  it('handles empty string', () => {
    expect(splitSentences('')).toEqual([]);
  });

  it('does not split on lowercase after period', () => {
    const sentences = splitSentences('e.g. this should not split.');
    expect(sentences).toHaveLength(1);
  });

  it('handles multiple punctuation types', () => {
    const sentences = splitSentences('First! Second? Third.');
    expect(sentences).toHaveLength(3);
  });

  it('handles sentence ending at end of string', () => {
    const sentences = splitSentences('Single sentence.');
    expect(sentences).toEqual(['Single sentence.']);
  });
});

// ── N-grams ──────────────────────────────────────────────────────────────────

describe('computeNgrams', () => {
  it('computes trigrams from a token list', () => {
    const tokens = ['the', 'quick', 'brown', 'fox', 'jumps'];
    const grams = computeNgrams(tokens, 3);
    expect(grams.size).toBe(3);
    expect(grams.get('the quick brown')).toBe(1);
    expect(grams.get('quick brown fox')).toBe(1);
    expect(grams.get('brown fox jumps')).toBe(1);
  });

  it('counts repeated n-grams', () => {
    const tokens = ['a', 'b', 'c', 'a', 'b', 'c'];
    const grams = computeNgrams(tokens, 3);
    expect(grams.get('a b c')).toBe(2);
  });

  it('returns empty map for input shorter than n', () => {
    const grams = computeNgrams(['hello', 'world'], 3);
    expect(grams.size).toBe(0);
  });

  it('returns empty map for empty input', () => {
    expect(computeNgrams([], 3).size).toBe(0);
  });

  it('handles unigrams (n=1)', () => {
    const tokens = ['hello', 'world', 'hello'];
    const grams = computeNgrams(tokens, 1);
    expect(grams.get('hello')).toBe(2);
    expect(grams.get('world')).toBe(1);
  });

  it('handles bigrams (n=2)', () => {
    const tokens = ['a', 'b', 'c', 'a', 'b'];
    const grams = computeNgrams(tokens, 2);
    expect(grams.get('a b')).toBe(2);
    expect(grams.get('b c')).toBe(1);
    expect(grams.get('c a')).toBe(1);
  });
});

describe('repetitionRatio', () => {
  it('returns 0 for no repetition', () => {
    const tokens = ['a', 'b', 'c', 'd', 'e'];
    expect(repetitionRatio(tokens, 3)).toBe(0);
  });

  it('returns > 0 for repeated n-grams', () => {
    const tokens = ['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'];
    const ratio = repetitionRatio(tokens, 3);
    expect(ratio).toBeGreaterThan(0);
  });

  it('returns 0 for empty input', () => {
    expect(repetitionRatio([], 3)).toBe(0);
  });

  it('returns 0 for input shorter than n', () => {
    expect(repetitionRatio(['a', 'b'], 3)).toBe(0);
  });

  it('returns 1 when all n-grams repeat', () => {
    // "a b a b a b" => trigrams: "a b a", "b a b", "a b a", "b a b"
    // unique: "a b a" (count 2), "b a b" (count 2) => both repeat => ratio 1.0
    const tokens = ['a', 'b', 'a', 'b', 'a', 'b'];
    expect(repetitionRatio(tokens, 3)).toBe(1);
  });
});

// ── Format Detection ─────────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects valid JSON object', () => {
    expect(detectFormat('{"key": "value"}')).toBe('json');
  });

  it('detects valid JSON array', () => {
    expect(detectFormat('[1, 2, 3]')).toBe('json');
  });

  it('does not detect invalid JSON starting with {', () => {
    expect(detectFormat('{not json at all}')).not.toBe('json');
  });

  it('detects XML', () => {
    expect(detectFormat('<root><child>text</child></root>')).toBe('xml');
  });

  it('detects markdown with heading', () => {
    expect(detectFormat('# Hello World\n\nSome text.')).toBe('markdown');
  });

  it('detects markdown with code fence', () => {
    expect(detectFormat('Here is code:\n```\nconsole.log("hi");\n```')).toBe('markdown');
  });

  it('detects markdown with list', () => {
    expect(detectFormat('- item one\n- item two\n- item three')).toBe('markdown');
  });

  it('detects markdown with asterisk list', () => {
    expect(detectFormat('* first\n* second')).toBe('markdown');
  });

  it('falls back to text', () => {
    expect(detectFormat('Just some plain text here.')).toBe('text');
  });

  it('falls back to text for empty string', () => {
    expect(detectFormat('')).toBe('text');
  });

  it('handles JSON with leading whitespace', () => {
    expect(detectFormat('  {"key": "value"}')).toBe('json');
  });

  it('falls back to text for invalid JSON that starts with [', () => {
    expect(detectFormat('[not valid json')).not.toBe('json');
  });
});

// ── Bracket Balance ──────────────────────────────────────────────────────────

describe('checkBracketBalance', () => {
  it('reports zero balance for balanced brackets', () => {
    const result = checkBracketBalance('{ [ ( < > ) ] }');
    expect(result.curly).toBe(0);
    expect(result.square).toBe(0);
    expect(result.round).toBe(0);
    expect(result.angle).toBe(0);
  });

  it('reports positive balance for unclosed brackets', () => {
    const result = checkBracketBalance('{ [ (');
    expect(result.curly).toBe(1);
    expect(result.square).toBe(1);
    expect(result.round).toBe(1);
  });

  it('reports negative balance for extra closing brackets', () => {
    const result = checkBracketBalance('} ] )');
    expect(result.curly).toBe(-1);
    expect(result.square).toBe(-1);
    expect(result.round).toBe(-1);
  });

  it('tracks max nesting depth', () => {
    const result = checkBracketBalance('{ { { } } }');
    expect(result.maxDepth).toBe(3);
  });

  it('tracks max depth across mixed bracket types', () => {
    const result = checkBracketBalance('{ [ ( ) ] }');
    expect(result.maxDepth).toBe(3);
  });

  it('reports zero for empty string', () => {
    const result = checkBracketBalance('');
    expect(result.curly).toBe(0);
    expect(result.square).toBe(0);
    expect(result.round).toBe(0);
    expect(result.angle).toBe(0);
    expect(result.maxDepth).toBe(0);
  });

  it('handles text with no brackets', () => {
    const result = checkBracketBalance('hello world');
    expect(result.curly).toBe(0);
    expect(result.maxDepth).toBe(0);
  });

  it('handles deeply nested JSON-like structure', () => {
    const result = checkBracketBalance('{"a":{"b":{"c":[1,2,3]}}}');
    expect(result.curly).toBe(0);
    expect(result.square).toBe(0);
    expect(result.maxDepth).toBeGreaterThanOrEqual(4);
  });

  it('handles angle brackets', () => {
    const result = checkBracketBalance('<div><span></span></div>');
    expect(result.angle).toBe(0);
  });

  it('detects unbalanced angle brackets', () => {
    const result = checkBracketBalance('<div><span');
    expect(result.angle).toBeGreaterThan(0);
  });
});

// ── JSON Parse ───────────────────────────────────────────────────────────────

describe('lenientJsonParse', () => {
  it('parses valid JSON successfully', () => {
    const result = lenientJsonParse('{"key": "value"}');
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ key: 'value' });
    expect(result.lenient).toBeUndefined();
  });

  it('parses valid JSON array', () => {
    const result = lenientJsonParse('[1, 2, 3]');
    expect(result.success).toBe(true);
    expect(result.value).toEqual([1, 2, 3]);
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = lenientJsonParse(input);
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ key: 'value' });
    expect(result.lenient).toBe(true);
  });

  it('parses JSON wrapped in plain markdown fences', () => {
    const input = '```\n{"key": "value"}\n```';
    const result = lenientJsonParse(input);
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ key: 'value' });
    expect(result.lenient).toBe(true);
  });

  it('returns failure for invalid JSON', () => {
    const result = lenientJsonParse('not json at all');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.value).toBeUndefined();
  });

  it('returns failure for malformed JSON even after stripping fences', () => {
    const input = '```json\n{invalid json}\n```';
    const result = lenientJsonParse(input);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles empty string', () => {
    const result = lenientJsonParse('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('parses JSON string primitive', () => {
    const result = lenientJsonParse('"hello"');
    expect(result.success).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('parses JSON number primitive', () => {
    const result = lenientJsonParse('42');
    expect(result.success).toBe(true);
    expect(result.value).toBe(42);
  });

  it('parses JSON boolean primitive', () => {
    const result = lenientJsonParse('true');
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
  });

  it('parses JSON null', () => {
    const result = lenientJsonParse('null');
    expect(result.success).toBe(true);
    expect(result.value).toBe(null);
  });
});
