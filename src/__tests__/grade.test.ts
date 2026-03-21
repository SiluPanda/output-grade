import { describe, it, expect } from 'vitest';
import { grade } from '../grade';

// ── GradeReport Shape ────────────────────────────────────────────────────────

describe('grade() — report shape', () => {
  it('returns a GradeReport with all required fields', () => {
    const report = grade('Hello, this is a well-formed response.');
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('pass');
    expect(report).toHaveProperty('passThreshold');
    expect(report).toHaveProperty('dimensions');
    expect(report).toHaveProperty('signals');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('meta');
    expect(typeof report.score).toBe('number');
    expect(typeof report.pass).toBe('boolean');
    expect(typeof report.passThreshold).toBe('number');
    expect(typeof report.summary).toBe('string');
    expect(Array.isArray(report.signals)).toBe(true);
  });

  it('includes all 8 dimensions in the dimensions object', () => {
    const report = grade('A normal output.');
    const dims = Object.keys(report.dimensions);
    expect(dims).toContain('structural-validity');
    expect(dims).toContain('truncation-risk');
    expect(dims).toContain('refusal-detection');
    expect(dims).toContain('content-coherence');
    expect(dims).toContain('hallucination-risk');
    expect(dims).toContain('schema-completeness');
    expect(dims).toContain('relevance');
    expect(dims).toContain('format-compliance');
    expect(dims).toHaveLength(8);
  });

  it('meta has correct structure', () => {
    const report = grade('Some output.');
    expect(report.meta).toHaveProperty('durationMs');
    expect(report.meta).toHaveProperty('weights');
    expect(report.meta).toHaveProperty('applicableDimensions');
    expect(report.meta).toHaveProperty('criticalFloorTriggered');
    expect(report.meta).toHaveProperty('detectedFormat');
    expect(report.meta).toHaveProperty('outputLength');
    expect(typeof report.meta.durationMs).toBe('number');
    expect(typeof report.meta.outputLength).toBe('number');
  });

  it('report is JSON-serializable', () => {
    const report = grade('Some output.');
    const serialized = JSON.stringify(report);
    expect(typeof serialized).toBe('string');
    const parsed = JSON.parse(serialized);
    expect(parsed.score).toBe(report.score);
    expect(parsed.pass).toBe(report.pass);
  });
});

// ── Clean Output ─────────────────────────────────────────────────────────────

describe('grade() — clean output', () => {
  it('scores clean text highly and passes', () => {
    const output =
      'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. ' +
      'It adds optional static typing and class-based object-oriented programming. ' +
      'TypeScript is developed and maintained by Microsoft.';
    const report = grade(output);
    expect(report.score).toBeGreaterThanOrEqual(0.7);
    expect(report.pass).toBe(true);
  });

  it('scores valid JSON with schema and prompt highly', () => {
    const output = '{"name": "Alice", "age": 30}';
    const report = grade(output, {
      format: 'json',
      prompt: 'Return a JSON object with name and age',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      },
    });
    expect(report.score).toBeGreaterThanOrEqual(0.7);
    expect(report.pass).toBe(true);
  });
});

// ── Refusal Output ───────────────────────────────────────────────────────────

describe('grade() — refusal output', () => {
  it('scores refusal output low and fails', () => {
    const output =
      "I cannot help with that request. " +
      "I'm unable to provide that information. " +
      "This goes against my guidelines.";
    const report = grade(output);
    expect(report.score).toBeLessThanOrEqual(0.4);
    expect(report.pass).toBe(false);
  });
});

// ── Empty Output ─────────────────────────────────────────────────────────────

describe('grade() — empty output', () => {
  it('scores empty string as 0 with critical signal', () => {
    const report = grade('');
    expect(report.score).toBe(0);
    expect(report.pass).toBe(false);
    expect(report.signals.some((s) => s.id === 'empty-output')).toBe(true);
    expect(report.signals.some((s) => s.severity === 'critical')).toBe(true);
  });

  it('scores whitespace-only output as 0', () => {
    const report = grade('   \n  \t  ');
    expect(report.score).toBe(0);
    expect(report.pass).toBe(false);
  });
});

// ── Critical Floor Capping ───────────────────────────────────────────────────

describe('grade() — critical floor capping', () => {
  it('caps composite when refusal detection triggers floor', () => {
    // Full refusal -> refusal-detection score will be 0.0
    // Default floor: threshold 0.3, ceiling 0.2
    const output =
      "I cannot assist with that request. " +
      "I'm sorry, but I'm unable to help with this. " +
      "This is against my guidelines and policies.";
    const report = grade(output);
    expect(report.score).toBeLessThanOrEqual(0.2);
    expect(report.meta.criticalFloorTriggered).toBe('refusal-detection');
  });

  it('records which floor was triggered in meta', () => {
    const output =
      "I can't do that. I refuse to help. That goes against my policies.";
    const report = grade(output);
    if (report.meta.criticalFloorTriggered) {
      expect(typeof report.meta.criticalFloorTriggered).toBe('string');
    }
  });
});

// ── Weight Redistribution ────────────────────────────────────────────────────

describe('grade() — weight redistribution', () => {
  it('excludes schema-completeness when no schema provided', () => {
    const report = grade('Some output.');
    // No schema -> schema-completeness weight should be 0
    expect(report.meta.weights['schema-completeness']).toBe(0);
  });

  it('excludes relevance when no prompt provided', () => {
    const report = grade('Some output.');
    expect(report.meta.weights['relevance']).toBe(0);
  });

  it('excludes format-compliance when no format and no prompt', () => {
    const report = grade('Some output.');
    expect(report.meta.weights['format-compliance']).toBe(0);
  });

  it('includes all dimensions when schema, prompt, and format provided', () => {
    const report = grade('{"name": "test"}', {
      schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      prompt: 'Return a JSON object',
      format: 'json',
    });
    for (const dim of report.meta.applicableDimensions) {
      expect(report.meta.weights[dim]).toBeGreaterThan(0);
    }
  });

  it('applicable dimension weights sum to approximately 1.0', () => {
    const report = grade('Some output.');
    const sum = report.meta.applicableDimensions.reduce(
      (acc, dim) => acc + (report.meta.weights[dim] ?? 0),
      0,
    );
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

// ── Custom Weights ───────────────────────────────────────────────────────────

describe('grade() — custom weights', () => {
  it('applies custom weights when provided', () => {
    const report = grade('Normal text output.', {
      weights: {
        'structural-validity': 0.5,
        'content-coherence': 0.5,
        'hallucination-risk': 0,
        'truncation-risk': 0,
        'refusal-detection': 0,
        'schema-completeness': 0,
        'relevance': 0,
        'format-compliance': 0,
      },
    });
    // Only structural-validity and content-coherence have weight
    expect(report.meta.weights['structural-validity']).toBeGreaterThan(0);
    expect(report.meta.weights['content-coherence']).toBeGreaterThan(0);
  });
});

// ── Pass Threshold ───────────────────────────────────────────────────────────

describe('grade() — pass threshold', () => {
  it('uses default threshold of 0.7', () => {
    const report = grade('Normal text output.');
    expect(report.passThreshold).toBe(0.7);
  });

  it('respects custom pass threshold', () => {
    const output = 'A reasonable output text.';
    const strictReport = grade(output, { passThreshold: 0.99 });
    const lenientReport = grade(output, { passThreshold: 0.1 });
    expect(strictReport.passThreshold).toBe(0.99);
    expect(lenientReport.passThreshold).toBe(0.1);
    // Lenient should pass, strict likely not
    expect(lenientReport.pass).toBe(true);
  });

  it('pass is true when score equals threshold exactly', () => {
    // We can test that the logic is >= by using a threshold of 0
    const report = grade('Some output.', { passThreshold: 0 });
    expect(report.pass).toBe(true);
  });
});

// ── Signal Ordering ──────────────────────────────────────────────────────────

describe('grade() — signal ordering', () => {
  it('orders signals by severity (critical first)', () => {
    // Truncated JSON with issues to generate multiple signal severities
    const output = '{"key": "val';
    const report = grade(output, { format: 'json' });
    const severities = report.signals.map((s) => s.severity);
    const criticalIdx = severities.indexOf('critical');
    const infoIdx = severities.lastIndexOf('info');
    if (criticalIdx !== -1 && infoIdx !== -1) {
      expect(criticalIdx).toBeLessThan(infoIdx);
    }
  });
});

// ── Summary Generation ───────────────────────────────────────────────────────

describe('grade() — summary', () => {
  it('generates a non-empty summary string', () => {
    const report = grade('Some output.');
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('summary mentions quality for high-scoring output', () => {
    const output =
      'TypeScript provides static typing on top of JavaScript. ' +
      'It helps catch errors at compile time and improves developer experience.';
    const report = grade(output);
    if (report.score >= 0.9) {
      expect(report.summary.toLowerCase()).toContain('high quality');
    }
  });

  it('summary mentions retry for low-scoring output', () => {
    const report = grade('');
    expect(report.summary.toLowerCase()).toContain('retry');
  });
});

// ── Meta Fields ──────────────────────────────────────────────────────────────

describe('grade() — meta', () => {
  it('records output length', () => {
    const output = 'Hello world!';
    const report = grade(output);
    expect(report.meta.outputLength).toBe(output.length);
  });

  it('detects format correctly', () => {
    const report = grade('{"key": "value"}');
    expect(report.meta.detectedFormat).toBe('json');
  });

  it('durationMs is non-negative', () => {
    const report = grade('Some output.');
    expect(report.meta.durationMs).toBeGreaterThanOrEqual(0);
  });
});
