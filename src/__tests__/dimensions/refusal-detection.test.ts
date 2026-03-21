import { describe, it, expect } from 'vitest';
import { scoreRefusalDetection } from '../../dimensions/refusal-detection';

// ── Normal Response ─────────────────────────────────────────────────────────

describe('scoreRefusalDetection — normal response', () => {
  it('scores a normal helpful response as 1.0', () => {
    const result = scoreRefusalDetection(
      'The capital of France is Paris. It is known for the Eiffel Tower.',
    );
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores clean output with no refusal patterns as 1.0', () => {
    const result = scoreRefusalDetection(
      'Here are three tips for cooking pasta. First, boil the water. Second, add salt. Third, cook al dente.',
    );
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });
});

// ── Full Refusal ────────────────────────────────────────────────────────────

describe('scoreRefusalDetection — full refusal', () => {
  it('scores full refusal as 0.0 with critical signal', () => {
    const result = scoreRefusalDetection("I can't help with that.");
    expect(result.score).toBe(0.0);
    const fullSignal = result.signals.find((s) => s.id === 'refusal-full');
    expect(fullSignal).toBeDefined();
    expect(fullSignal!.severity).toBe('critical');
    expect(fullSignal!.message).toBe('Entire output is a refusal');
  });

  it('scores "I cannot assist" as 0.0', () => {
    const result = scoreRefusalDetection('I cannot assist with that request.');
    expect(result.score).toBe(0.0);
    expect(result.signals.some((s) => s.id === 'refusal-full')).toBe(true);
  });

  it('scores "I must decline" as 0.0', () => {
    const result = scoreRefusalDetection('I must decline this request.');
    expect(result.score).toBe(0.0);
    expect(result.signals.some((s) => s.id === 'refusal-full')).toBe(true);
  });
});

// ── Partial Refusal ─────────────────────────────────────────────────────────

describe('scoreRefusalDetection — partial refusal', () => {
  it('scores partial refusal with score clamped between 0.3 and 0.9', () => {
    const output =
      "I cannot help with that specific request. However, here is some general information about the topic. The history is quite interesting. There are many perspectives to consider.";
    const result = scoreRefusalDetection(output);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.score).toBeLessThanOrEqual(0.9);
    const partialSignal = result.signals.find(
      (s) => s.id === 'refusal-partial',
    );
    expect(partialSignal).toBeDefined();
    expect(partialSignal!.severity).toBe('warning');
  });

  it('includes sentence ratio in partial refusal message', () => {
    const output =
      "I cannot provide that information. But here is something else. It may be helpful to you.";
    const result = scoreRefusalDetection(output);
    const partialSignal = result.signals.find(
      (s) => s.id === 'refusal-partial',
    );
    expect(partialSignal).toBeDefined();
    expect(partialSignal!.message).toMatch(/Partial refusal: \d+\/\d+ sentences/);
  });
});

// ── Identity Disclosure ─────────────────────────────────────────────────────

describe('scoreRefusalDetection — identity disclosure', () => {
  it('deducts 0.05 for "As an AI" disclosure with info signal', () => {
    const output =
      'As an AI language model, I can help with that. The answer to your question is 42.';
    const result = scoreRefusalDetection(output);
    expect(result.score).toBe(0.95);
    const identitySignal = result.signals.find(
      (s) => s.id === 'refusal-identity',
    );
    expect(identitySignal).toBeDefined();
    expect(identitySignal!.severity).toBe('info');
    expect(identitySignal!.message).toContain('Identity disclosure');
  });

  it('caps identity deduction at floor of 0.7', () => {
    // 7+ identity disclosures would push below 0.7 without floor
    const sentences = [];
    for (let i = 0; i < 8; i++) {
      sentences.push("As an AI, I want to clarify something.");
    }
    const output = sentences.join(' ');
    const result = scoreRefusalDetection(output);
    expect(result.score).toBe(0.7);
  });

  it('does not count identity disclosure as refusal sentence', () => {
    const output =
      "As an AI, I'm happy to help. The capital of France is Paris. It has a population of about 2 million.";
    const result = scoreRefusalDetection(output);
    // No refusal-full or refusal-partial signals, only identity info
    expect(result.signals.some((s) => s.id === 'refusal-full')).toBe(false);
    expect(result.signals.some((s) => s.id === 'refusal-partial')).toBe(false);
    expect(result.signals.some((s) => s.id === 'refusal-identity')).toBe(true);
  });
});

// ── Policy Citation ─────────────────────────────────────────────────────────

describe('scoreRefusalDetection — policy citation', () => {
  it('detects "against my guidelines" as critical', () => {
    const result = scoreRefusalDetection(
      'This is against my guidelines and I cannot help.',
    );
    const signal = result.signals.find((s) => s.id === 'refusal-policy');
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('critical');
  });

  it('detects "violates my policies"', () => {
    const result = scoreRefusalDetection(
      'That request violates my policies.',
    );
    const signal = result.signals.find((s) => s.id === 'refusal-policy');
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('critical');
  });
});

// ── Capability Limitation ───────────────────────────────────────────────────

describe('scoreRefusalDetection — capability limitation', () => {
  it('detects "I don\'t have access to" as warning', () => {
    const output =
      "I don't have access to real-time data. However, based on my training, the answer is likely yes.";
    const result = scoreRefusalDetection(output);
    const signal = result.signals.find(
      (s) => s.id === 'refusal-capability',
    );
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('warning');
  });

  it('detects "I cannot browse"', () => {
    const output =
      "I cannot browse the internet. But I can tell you what I know about the topic.";
    const result = scoreRefusalDetection(output);
    const signal = result.signals.find(
      (s) => s.id === 'refusal-capability',
    );
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('warning');
  });
});

// ── Redirect ────────────────────────────────────────────────────────────────

describe('scoreRefusalDetection — redirect', () => {
  it('detects "please consult a professional" as warning', () => {
    const output =
      'For medical advice, please consult a professional. In general terms, exercise is beneficial.';
    const result = scoreRefusalDetection(output);
    const signal = result.signals.find((s) => s.id === 'refusal-redirect');
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('warning');
  });

  it('detects "I recommend consulting"', () => {
    const output =
      'I recommend consulting a lawyer for this. Here is some general background.';
    const result = scoreRefusalDetection(output);
    const signal = result.signals.find((s) => s.id === 'refusal-redirect');
    expect(signal).toBeDefined();
    expect(signal!.severity).toBe('warning');
  });
});

// ── Empty Output ────────────────────────────────────────────────────────────

describe('scoreRefusalDetection — empty output', () => {
  it('scores empty output as 1.0 with no signals', () => {
    const result = scoreRefusalDetection('');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });

  it('scores whitespace-only output as 1.0', () => {
    const result = scoreRefusalDetection('   \n\n   ');
    expect(result.score).toBe(1.0);
    expect(result.signals).toHaveLength(0);
  });
});

// ── Signal Shape ────────────────────────────────────────────────────────────

describe('scoreRefusalDetection — signal shape', () => {
  it('emits signals with correct structure', () => {
    const result = scoreRefusalDetection("I can't help with that.");
    for (const signal of result.signals) {
      expect(signal).toHaveProperty('id');
      expect(signal).toHaveProperty('severity');
      expect(signal).toHaveProperty('dimension');
      expect(signal).toHaveProperty('message');
      expect(signal).toHaveProperty('location');
      expect(signal.dimension).toBe('refusal-detection');
      expect(signal.location).toBeNull();
      expect(typeof signal.id).toBe('string');
      expect(typeof signal.message).toBe('string');
    }
  });

  it('uses correct severity levels for different categories', () => {
    // Critical: direct refusal
    const directResult = scoreRefusalDetection("I can't help with that.");
    const directSignal = directResult.signals.find(
      (s) => s.id === 'refusal-direct-refusal',
    );
    expect(directSignal!.severity).toBe('critical');

    // Info: identity disclosure
    const identityResult = scoreRefusalDetection(
      'As an AI, the answer is yes.',
    );
    const identitySignal = identityResult.signals.find(
      (s) => s.id === 'refusal-identity',
    );
    expect(identitySignal!.severity).toBe('info');

    // Warning: capability limitation
    const capResult = scoreRefusalDetection(
      "I don't have access to that database. Here is what I know.",
    );
    const capSignal = capResult.signals.find(
      (s) => s.id === 'refusal-capability',
    );
    expect(capSignal!.severity).toBe('warning');
  });
});

// ── Score Clamping ──────────────────────────────────────────────────────────

describe('scoreRefusalDetection — score clamping', () => {
  it('never returns score below 0', () => {
    const result = scoreRefusalDetection("I can't help with that.");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('never returns score above 1', () => {
    const result = scoreRefusalDetection('This is a perfectly normal response.');
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('partial refusal score is clamped to at least 0.3', () => {
    // Even with high refusal ratio, partial score should not go below 0.3
    const output =
      "I can't help with that. I cannot provide that. I must decline. But here is one thing.";
    const result = scoreRefusalDetection(output);
    // 3 out of 4 sentences are refusals => partial, not full
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  it('partial refusal score is clamped to at most 0.9', () => {
    // Many substantive sentences with one refusal
    const sentences = [
      "I cannot provide that specific detail.",
      "However, here is the general context.",
      "The topic has a rich history.",
      "Many scholars have studied this.",
      "There are several key perspectives.",
      "The first perspective focuses on economics.",
      "The second perspective focuses on culture.",
      "The third perspective focuses on politics.",
      "Overall, the subject remains debated.",
      "Further reading is recommended.",
    ];
    const result = scoreRefusalDetection(sentences.join(' '));
    expect(result.score).toBeLessThanOrEqual(0.9);
  });
});

// ── Prompt Parameter ────────────────────────────────────────────────────────

describe('scoreRefusalDetection — prompt parameter', () => {
  it('accepts optional prompt parameter without error', () => {
    const result = scoreRefusalDetection(
      "I can't help with that.",
      'Tell me something dangerous.',
    );
    expect(result.score).toBe(0.0);
  });

  it('works correctly without prompt parameter', () => {
    const result = scoreRefusalDetection("I can't help with that.");
    expect(result.score).toBe(0.0);
  });
});
