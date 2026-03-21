import { describe, it, expect } from 'vitest';
import { scoreHallucinationRisk } from '../../dimensions/hallucination-risk';

// ── Clean Factual Output ────────────────────────────────────────────────────

describe('scoreHallucinationRisk — clean factual output', () => {
  it('scores clean factual output highly (~1.0)', () => {
    const text =
      'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. ' +
      'It was developed by Microsoft and first released in October 2012. ' +
      'The language adds optional static typing and class-based object-oriented programming.';
    const result = scoreHallucinationRisk(text);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it('returns 1.0 for empty output', () => {
    const result = scoreHallucinationRisk('');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('returns high score for normal text without hedging or confidence inflation', () => {
    const text =
      'The Eiffel Tower is located in Paris, France. ' +
      'It was constructed from 1887 to 1889 as the centerpiece of the 1889 World Fair. ' +
      'The tower stands 324 meters tall and is the most visited paid monument in the world.';
    const result = scoreHallucinationRisk(text);
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });
});

// ── Hedging Language Detection ──────────────────────────────────────────────

describe('scoreHallucinationRisk — hedging detection', () => {
  it('detects heavy hedging and lowers score', () => {
    const text =
      'I think this might be correct. ' +
      'I believe it could be the answer. ' +
      'Perhaps this is roughly right. ' +
      'Probably the result is approximately what you need.';
    const result = scoreHallucinationRisk(text);
    expect(result.score).toBeLessThan(0.5);
    expect(
      result.signals.some((s) => s.id.startsWith('hallucination-hedging-')),
    ).toBe(true);
  });

  it('computes hedging density correctly relative to sentence count', () => {
    // 1 hedging phrase across many sentences should have minimal impact
    const sentences = [
      'I think this is correct.',
      'The sky is blue.',
      'Water boils at 100 degrees Celsius.',
      'The Earth orbits the Sun.',
      'Light travels at approximately 300,000 km per second.',
      'Gravity keeps us on the ground.',
      'The moon orbits the Earth.',
      'Plants need sunlight to grow.',
      'Fish live in water.',
      'Birds can fly.',
    ];
    const text = sentences.join(' ');
    const result = scoreHallucinationRisk(text);
    // Low density = high score
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it('emits signals with correct hedging category IDs', () => {
    const text = 'I think this is probably correct. Perhaps it is right.';
    const result = scoreHallucinationRisk(text);
    const hedgingSignals = result.signals.filter((s) =>
      s.id.startsWith('hallucination-hedging-'),
    );
    expect(hedgingSignals.length).toBeGreaterThan(0);
    for (const signal of hedgingSignals) {
      expect(signal.dimension).toBe('hallucination-risk');
      expect(signal.message).toMatch(/Hedging phrase:/);
    }
  });
});

// ── Confidence Inflation Detection ──────────────────────────────────────────

describe('scoreHallucinationRisk — confidence inflation', () => {
  it('detects confidence inflation and deducts score', () => {
    const text =
      'This is definitely the correct answer. ' +
      'It is absolutely guaranteed to work. ' +
      'Without a doubt, this is always true and never fails. ' +
      'This is certainly 100% accurate.';
    const result = scoreHallucinationRisk(text);
    const inflationSignals = result.signals.filter(
      (s) => s.id === 'hallucination-confidence-inflation',
    );
    expect(inflationSignals.length).toBeGreaterThan(0);
    // 8 confidence patterns matched * 0.1 = 0.8 deduction -> score 0.2
    expect(result.score).toBeLessThan(0.5);
  });

  it('emits info severity for confidence inflation signals', () => {
    const text = 'This is definitely the right approach.';
    const result = scoreHallucinationRisk(text);
    const inflationSignals = result.signals.filter(
      (s) => s.id === 'hallucination-confidence-inflation',
    );
    for (const signal of inflationSignals) {
      expect(signal.severity).toBe('info');
      expect(signal.dimension).toBe('hallucination-risk');
    }
  });
});

// ── Suspicious URL Detection ────────────────────────────────────────────────

describe('scoreHallucinationRisk — suspicious URLs', () => {
  it('flags example.com URLs as suspicious', () => {
    const text =
      'For more information, visit https://example.com/page. ' +
      'This is a factual statement.';
    const result = scoreHallucinationRisk(text);
    expect(
      result.signals.some((s) => s.id === 'hallucination-suspicious-url'),
    ).toBe(true);
    const urlSignal = result.signals.find(
      (s) => s.id === 'hallucination-suspicious-url',
    )!;
    expect(urlSignal.severity).toBe('warning');
  });

  it('flags URLs with 5+ path segments as suspicious', () => {
    const text =
      'See https://realsite.org/a/b/c/d/e for details. ' +
      'This is accurate information.';
    const result = scoreHallucinationRisk(text);
    expect(
      result.signals.some((s) => s.id === 'hallucination-suspicious-url'),
    ).toBe(true);
  });

  it('escalates to critical severity for more than 2 suspicious URLs', () => {
    const text =
      'See https://example.com/a for info. ' +
      'Also check https://test.com/b for more. ' +
      'And https://foo.com/c has details. ' +
      'These are reliable sources.';
    const result = scoreHallucinationRisk(text);
    const urlSignals = result.signals.filter(
      (s) => s.id === 'hallucination-suspicious-url',
    );
    expect(urlSignals.length).toBe(3);
    // Third URL should be critical (suspiciousUrls > 2 at that point)
    expect(urlSignals.some((s) => s.severity === 'critical')).toBe(true);
  });

  it('does not flag legitimate URLs with short paths', () => {
    const text =
      'Visit https://github.com/user/repo for the source code. ' +
      'The documentation is well-maintained.';
    const result = scoreHallucinationRisk(text);
    expect(
      result.signals.some((s) => s.id === 'hallucination-suspicious-url'),
    ).toBe(false);
  });
});

// ── Self-Contradiction Detection ────────────────────────────────────────────

describe('scoreHallucinationRisk — self-contradiction', () => {
  it('detects "however...this is not true" pattern', () => {
    const text =
      'The Earth is flat. However, this is not true according to science. ' +
      'The Earth is actually round.';
    const result = scoreHallucinationRisk(text);
    expect(
      result.signals.some((s) => s.id === 'hallucination-contradiction'),
    ).toBe(true);
    const contradictionSignal = result.signals.find(
      (s) => s.id === 'hallucination-contradiction',
    )!;
    expect(contradictionSignal.severity).toBe('warning');
  });

  it('detects "actually...incorrect" pattern', () => {
    const text =
      'Python is a compiled language. Actually, that is incorrect. ' +
      'Python is an interpreted language.';
    const result = scoreHallucinationRisk(text);
    expect(
      result.signals.some((s) => s.id === 'hallucination-contradiction'),
    ).toBe(true);
  });

  it('detects "correction:" pattern', () => {
    const text =
      'The capital of Australia is Sydney. ' +
      'Correction: The capital of Australia is Canberra.';
    const result = scoreHallucinationRisk(text);
    expect(
      result.signals.some((s) => s.id === 'hallucination-contradiction'),
    ).toBe(true);
  });

  it('does not flag text without contradiction patterns', () => {
    const text =
      'Rust is a systems programming language. ' +
      'It focuses on safety, concurrency, and performance. ' +
      'The borrow checker enforces memory safety at compile time.';
    const result = scoreHallucinationRisk(text);
    expect(
      result.signals.some((s) => s.id === 'hallucination-contradiction'),
    ).toBe(false);
  });
});

// ── Mixed Signals ───────────────────────────────────────────────────────────

describe('scoreHallucinationRisk — mixed signals', () => {
  it('uses worst score when hedging and confidence both present', () => {
    const text =
      'I think this is definitely the answer. ' +
      'It is probably guaranteed to work. ' +
      'Perhaps it is absolutely correct.';
    const result = scoreHallucinationRisk(text);
    // Both hedging density and confidence inflation should contribute
    // The composite uses minimum, so the worst sub-score wins
    expect(result.score).toBeLessThan(0.7);
    expect(
      result.signals.some((s) => s.id.startsWith('hallucination-hedging-')),
    ).toBe(true);
    expect(
      result.signals.some(
        (s) => s.id === 'hallucination-confidence-inflation',
      ),
    ).toBe(true);
  });
});

// ── Signal Shape ────────────────────────────────────────────────────────────

describe('scoreHallucinationRisk — signal shape', () => {
  it('emits signals with correct structure (id, severity, dimension, message, location)', () => {
    const text = 'I think this is probably correct.';
    const result = scoreHallucinationRisk(text);
    expect(result.signals.length).toBeGreaterThan(0);
    for (const signal of result.signals) {
      expect(signal).toHaveProperty('id');
      expect(signal).toHaveProperty('severity');
      expect(signal).toHaveProperty('dimension');
      expect(signal).toHaveProperty('message');
      expect(signal).toHaveProperty('location');
      expect(signal.dimension).toBe('hallucination-risk');
      expect(signal.location).toBeNull();
      expect(typeof signal.id).toBe('string');
      expect(typeof signal.message).toBe('string');
      expect(['info', 'warning', 'critical']).toContain(signal.severity);
    }
  });

  it('all signals have dimension set to hallucination-risk', () => {
    const text =
      'I think this is definitely correct. ' +
      'Visit https://example.com/test for more.';
    const result = scoreHallucinationRisk(text);
    for (const signal of result.signals) {
      expect(signal.dimension).toBe('hallucination-risk');
    }
  });
});

// ── Score Clamping ──────────────────────────────────────────────────────────

describe('scoreHallucinationRisk — score clamping', () => {
  it('never returns score below 0', () => {
    // Extreme case: many hedging + confidence + URLs + contradictions
    const text =
      'I think I believe this is probably perhaps definitely guaranteed. ' +
      'Correction: Actually, that is incorrect. ' +
      'See https://example.com/a and https://test.com/b and https://foo.com/c for details.';
    const result = scoreHallucinationRisk(text);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('never returns score above 1', () => {
    const text =
      'The speed of light in a vacuum is approximately 299,792,458 meters per second. ' +
      'This value is a fundamental constant of nature.';
    const result = scoreHallucinationRisk(text);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('score is always a finite number', () => {
    const inputs = [
      '',
      'hello',
      'I think probably maybe.',
      'Definitely always guaranteed.',
      'Normal factual text about programming languages.',
    ];
    for (const input of inputs) {
      const result = scoreHallucinationRisk(input);
      expect(Number.isFinite(result.score)).toBe(true);
    }
  });
});
