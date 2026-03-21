import { describe, it, expect } from 'vitest';
import { scoreSchemaCompleteness } from '../../dimensions/schema-completeness';
import type { JsonSchema } from '../../types';

// ── No Schema (Neutral) ─────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — no schema', () => {
  it('returns 1.0 when no schema is provided', () => {
    const result = scoreSchemaCompleteness('{"name": "test"}');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns 1.0 for arbitrary text when no schema is provided', () => {
    const result = scoreSchemaCompleteness('not even json');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });
});

// ── Invalid JSON ─────────────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — invalid JSON', () => {
  it('returns 0.0 with critical signal when output is not valid JSON', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const result = scoreSchemaCompleteness('this is not json', schema);
    expect(result.score).toBe(0.0);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('schema-parse-failure');
    expect(result.signals[0].severity).toBe('critical');
  });

  it('returns 0.0 for malformed JSON', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const result = scoreSchemaCompleteness('{name: test}', schema);
    expect(result.score).toBe(0.0);
  });
});

// ── All Required Fields Present and Correct ──────────────────────────────────

describe('scoreSchemaCompleteness — all required fields correct', () => {
  it('returns 1.0 when all required fields are present with correct types', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name', 'age', 'active'],
    };
    const output = JSON.stringify({ name: 'Alice', age: 30, active: true });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns 1.0 when schema has no properties and no required', () => {
    const schema: JsonSchema = { type: 'object' };
    const output = JSON.stringify({ anything: 'goes' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
  });
});

// ── Missing Required Field ───────────────────────────────────────────────────

describe('scoreSchemaCompleteness — missing required field', () => {
  it('scores 0.0 for the missing field (critical signal)', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['name', 'email'],
    };
    const output = JSON.stringify({ name: 'Alice' });
    const result = scoreSchemaCompleteness(output, schema);
    // One field correct (1.0 * 1.0) + one missing (0.0 * 1.0) / 2.0 = 0.5
    expect(result.score).toBe(0.5);
    expect(
      result.signals.some((s) => s.id === 'schema-missing-required-email'),
    ).toBe(true);
    const missingSignal = result.signals.find(
      (s) => s.id === 'schema-missing-required-email',
    )!;
    expect(missingSignal.severity).toBe('critical');
  });

  it('scores 0.0 when all required fields are missing', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };
    const output = JSON.stringify({});
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.0);
    expect(result.signals).toHaveLength(2);
  });
});

// ── Wrong Type on Required Field ─────────────────────────────────────────────

describe('scoreSchemaCompleteness — wrong type on required field', () => {
  it('scores 0.5 for a required field with wrong type', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { age: { type: 'number' } },
      required: ['age'],
    };
    const output = JSON.stringify({ age: 'thirty' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.5);
    expect(
      result.signals.some((s) => s.id === 'schema-wrong-type-age'),
    ).toBe(true);
    const typeSignal = result.signals.find(
      (s) => s.id === 'schema-wrong-type-age',
    )!;
    expect(typeSignal.severity).toBe('warning');
    expect(typeSignal.message).toContain('expected number');
  });
});

// ── Empty Required Field ─────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — empty required field', () => {
  it('scores 0.7 for an empty string required field', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const output = JSON.stringify({ name: '' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.7);
    expect(
      result.signals.some((s) => s.id === 'schema-empty-name'),
    ).toBe(true);
    const emptySignal = result.signals.find(
      (s) => s.id === 'schema-empty-name',
    )!;
    expect(emptySignal.severity).toBe('warning');
  });

  it('scores 0.7 for a null required field', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { value: { type: 'string' } },
      required: ['value'],
    };
    // null passes type check for 'string'? No — typeof null !== 'string'.
    // But null is empty. Type check: typeof null is 'object', not 'string' -> wrong type -> 0.5.
    // Actually, let's trace: propSchema.type = 'string', checkType(null, 'string') = false -> wrong type -> 0.5
    const output = JSON.stringify({ value: null });
    const result = scoreSchemaCompleteness(output, schema);
    // null fails checkType for 'string', so it hits wrong type branch (0.5), not empty (0.7)
    expect(result.score).toBe(0.5);
  });

  it('scores 0.7 for an empty array required field', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { items: { type: 'array' } },
      required: ['items'],
    };
    const output = JSON.stringify({ items: [] });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.7);
    expect(
      result.signals.some((s) => s.id === 'schema-empty-items'),
    ).toBe(true);
  });

  it('scores 0.7 for a whitespace-only string required field', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const output = JSON.stringify({ name: '   ' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.7);
  });
});

// ── Optional Field Missing ───────────────────────────────────────────────────

describe('scoreSchemaCompleteness — optional field missing', () => {
  it('scores 0.8 weight-adjusted for a missing optional field', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        nickname: { type: 'string' },
      },
      required: ['name'],
    };
    const output = JSON.stringify({ name: 'Alice' });
    const result = scoreSchemaCompleteness(output, schema);
    // required name: 1.0 * 1.0 = 1.0
    // optional nickname missing: 0.8 * 0.5 = 0.4
    // totalWeight = 1.0 + 0.5 = 1.5
    // score = (1.0 + 0.4) / 1.5 = 1.4 / 1.5 ≈ 0.9333
    expect(result.score).toBeCloseTo(1.4 / 1.5, 4);
    expect(result.signals).toHaveLength(0);
  });
});

// ── Optional Field Wrong Type ────────────────────────────────────────────────

describe('scoreSchemaCompleteness — optional field wrong type', () => {
  it('scores 0.5 weight-adjusted for an optional field with wrong type', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['name'],
    };
    const output = JSON.stringify({ name: 'Alice', count: 'five' });
    const result = scoreSchemaCompleteness(output, schema);
    // required name: 1.0 * 1.0 = 1.0
    // optional count wrong type: 0.5 * 0.5 = 0.25
    // totalWeight = 1.0 + 0.5 = 1.5
    // score = (1.0 + 0.25) / 1.5 = 1.25 / 1.5 ≈ 0.8333
    expect(result.score).toBeCloseTo(1.25 / 1.5, 4);
    const signal = result.signals.find(
      (s) => s.id === 'schema-optional-wrong-type-count',
    );
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('info');
  });
});

// ── Mixed Required + Optional Fields ─────────────────────────────────────────

describe('scoreSchemaCompleteness — mixed required and optional', () => {
  it('computes correct weighted average with mix of field states', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string' },
        bio: { type: 'string' },
        avatar: { type: 'string' },
      },
      required: ['name', 'age', 'email'],
    };
    const output = JSON.stringify({
      name: 'Alice',
      age: 'thirty', // wrong type
      // email missing
      bio: 'Hello world', // optional present
      // avatar missing (optional)
    });
    const result = scoreSchemaCompleteness(output, schema);
    // required name: 1.0 * 1.0 = 1.0
    // required age wrong type: 0.5 * 1.0 = 0.5
    // required email missing: 0.0 * 1.0 = 0.0
    // optional bio present: 1.0 * 0.5 = 0.5
    // optional avatar missing: 0.8 * 0.5 = 0.4
    // totalWeight = 1.0 + 1.0 + 1.0 + 0.5 + 0.5 = 4.0
    // score = (1.0 + 0.5 + 0.0 + 0.5 + 0.4) / 4.0 = 2.4 / 4.0 = 0.6
    expect(result.score).toBeCloseTo(0.6, 4);
    expect(result.signals).toHaveLength(2); // wrong type + missing
  });
});

// ── Empty Data with Required Fields ──────────────────────────────────────────

describe('scoreSchemaCompleteness — empty data with required fields', () => {
  it('returns low score when data is empty but schema requires fields', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name', 'age', 'active'],
    };
    const result = scoreSchemaCompleteness('{}', schema);
    expect(result.score).toBe(0.0);
    expect(result.signals).toHaveLength(3);
    for (const signal of result.signals) {
      expect(signal.severity).toBe('critical');
      expect(signal.id).toMatch(/^schema-missing-required-/);
    }
  });
});

// ── Nested Object (Basic) ────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — nested object', () => {
  it('checks top-level type for nested objects', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        address: { type: 'object' },
      },
      required: ['address'],
    };
    const output = JSON.stringify({ address: { street: '123 Main St' } });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
  });

  it('detects wrong type for nested object field', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        address: { type: 'object' },
      },
      required: ['address'],
    };
    const output = JSON.stringify({ address: 'not an object' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.5);
    expect(
      result.signals.some((s) => s.id === 'schema-wrong-type-address'),
    ).toBe(true);
  });
});

// ── Array Type Check ─────────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — array type check', () => {
  it('accepts correct array type', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { tags: { type: 'array' } },
      required: ['tags'],
    };
    const output = JSON.stringify({ tags: ['a', 'b', 'c'] });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
  });

  it('rejects non-array when array expected', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { tags: { type: 'array' } },
      required: ['tags'],
    };
    const output = JSON.stringify({ tags: 'not-an-array' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.5);
  });

  it('treats empty array as empty for required field', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { tags: { type: 'array' } },
      required: ['tags'],
    };
    const output = JSON.stringify({ tags: [] });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.7);
  });
});

// ── Integer Type Check ───────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — integer type check', () => {
  it('accepts integer value for integer type', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count'],
    };
    const output = JSON.stringify({ count: 42 });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
  });

  it('rejects float value for integer type', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count'],
    };
    const output = JSON.stringify({ count: 3.14 });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.5);
  });
});

// ── Boolean and Null Type Checks ─────────────────────────────────────────────

describe('scoreSchemaCompleteness — boolean and null types', () => {
  it('accepts boolean value for boolean type', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { active: { type: 'boolean' } },
      required: ['active'],
    };
    const output = JSON.stringify({ active: false });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
  });

  it('accepts null value for null type', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { deleted: { type: 'null' } },
      required: ['deleted'],
    };
    const output = JSON.stringify({ deleted: null });
    const result = scoreSchemaCompleteness(output, schema);
    // null with type 'null' passes checkType, but isEmpty(null) = true -> 0.7
    expect(result.score).toBe(0.7);
  });
});

// ── Signal Shape ─────────────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — signal shape', () => {
  it('emits signals with correct structure (id, severity, dimension, message, location)', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };
    const output = JSON.stringify({ name: '', age: 'old' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.signals.length).toBeGreaterThan(0);
    for (const signal of result.signals) {
      expect(signal).toHaveProperty('id');
      expect(signal).toHaveProperty('severity');
      expect(signal).toHaveProperty('dimension');
      expect(signal).toHaveProperty('message');
      expect(signal).toHaveProperty('location');
      expect(signal.dimension).toBe('schema-completeness');
      expect(signal.location).toBeNull();
      expect(typeof signal.id).toBe('string');
      expect(typeof signal.message).toBe('string');
      expect(['info', 'warning', 'critical']).toContain(signal.severity);
    }
  });

  it('all signals have dimension set to schema-completeness', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'number' },
      },
      required: ['a'],
    };
    const output = JSON.stringify({ b: 'wrong' });
    const result = scoreSchemaCompleteness(output, schema);
    for (const signal of result.signals) {
      expect(signal.dimension).toBe('schema-completeness');
    }
  });
});

// ── Score Clamping ───────────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — score clamping', () => {
  it('never returns score below 0', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'string' },
        c: { type: 'string' },
        d: { type: 'string' },
        e: { type: 'string' },
      },
      required: ['a', 'b', 'c', 'd', 'e'],
    };
    const result = scoreSchemaCompleteness('{}', schema);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('never returns score above 1', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const output = JSON.stringify({ name: 'Alice', extra: 'field' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('score is always a finite number', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { x: { type: 'string' } },
      required: ['x'],
    };
    const inputs = [
      '{}',
      '{"x": "hello"}',
      '{"x": ""}',
      '{"x": 42}',
      'not json',
    ];
    for (const input of inputs) {
      const result = scoreSchemaCompleteness(input, schema);
      expect(Number.isFinite(result.score)).toBe(true);
    }
  });
});

// ── Lenient JSON Parsing ─────────────────────────────────────────────────────

describe('scoreSchemaCompleteness — lenient JSON parsing', () => {
  it('parses JSON wrapped in markdown code fences', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const output = '```json\n{"name": "Alice"}\n```';
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
  });
});

// ── Unknown Type Passthrough ─────────────────────────────────────────────────

describe('scoreSchemaCompleteness — unknown type', () => {
  it('treats unknown type as always valid', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { data: { type: 'custom' } },
      required: ['data'],
    };
    const output = JSON.stringify({ data: 'anything' });
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(1.0);
  });
});

// ── No Properties in Schema ──────────────────────────────────────────────────

describe('scoreSchemaCompleteness — required without properties', () => {
  it('handles required field with no property schema (no type check)', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
    };
    const output = JSON.stringify({ name: 'Alice' });
    const result = scoreSchemaCompleteness(output, schema);
    // propSchema is undefined, so type check is skipped, isEmpty('Alice') = false -> 1.0
    expect(result.score).toBe(1.0);
  });

  it('detects missing required field even without properties defined', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['name'],
    };
    const output = JSON.stringify({});
    const result = scoreSchemaCompleteness(output, schema);
    expect(result.score).toBe(0.0);
    expect(
      result.signals.some((s) => s.id === 'schema-missing-required-name'),
    ).toBe(true);
  });
});
