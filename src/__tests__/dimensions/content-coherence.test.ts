import { describe, it, expect } from 'vitest';
import { scoreContentCoherence } from '../../dimensions/content-coherence';

// ── Normal / Diverse Text ────────────────────────────────────────────────────

describe('scoreContentCoherence — normal text', () => {
  it('scores diverse, well-structured text highly', () => {
    const text =
      'The quick brown fox jumps over the lazy dog. ' +
      'Modern software engineering requires careful attention to design patterns. ' +
      'Distributed systems present unique challenges for consistency and availability. ' +
      'Functional programming emphasizes immutability and pure functions. ' +
      'Testing strategies should cover unit, integration, and end-to-end scenarios.';
    const result = scoreContentCoherence(text);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
    expect(result.signals.filter((s) => s.severity === 'critical')).toHaveLength(0);
  });

  it('returns score between 0 and 1 for normal text', () => {
    const text = 'This is a reasonable paragraph about technology and programming.';
    const result = scoreContentCoherence(text);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ── Degenerate Output ────────────────────────────────────────────────────────

describe('scoreContentCoherence — degenerate output', () => {
  it('scores empty output as 0.0 with critical signal', () => {
    const result = scoreContentCoherence('');
    expect(result.score).toBe(0.0);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('coherence-empty');
    expect(result.signals[0].severity).toBe('critical');
  });

  it('scores whitespace-only output as 0.0', () => {
    const result = scoreContentCoherence('   \n\t  \n  ');
    expect(result.score).toBe(0.0);
    expect(result.signals[0].id).toBe('coherence-empty');
  });

  it('scores single character repeated as 0.0 with critical signal', () => {
    const result = scoreContentCoherence('aaaaaaaaaaaaaaaa');
    expect(result.score).toBe(0.0);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].id).toBe('coherence-single-char-repeat');
    expect(result.signals[0].severity).toBe('critical');
  });

  it('scores 90%+ special characters as 0.1 with critical signal', () => {
    // 50 special characters + 2 alphanumeric = 96% special
    const specialChars = '!@#$%^&*()!@#$%^&*()!@#$%^&*()!@#$%^&*()!@#$%^&*()';
    const input = specialChars + 'ab';
    const result = scoreContentCoherence(input);
    expect(result.score).toBe(0.1);
    expect(result.signals.some((s) => s.id === 'coherence-mostly-special')).toBe(true);
    expect(result.signals.find((s) => s.id === 'coherence-mostly-special')!.severity).toBe(
      'critical',
    );
  });
});

// ── N-gram Repetition ────────────────────────────────────────────────────────

describe('scoreContentCoherence — n-gram repetition', () => {
  it('emits warning for high n-gram repetition', () => {
    // Repeat the same phrase many times to create high trigram repetition
    const phrase = 'the quick fox ';
    const text = phrase.repeat(30);
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-ngram-repetition')).toBe(true);
    expect(result.signals.find((s) => s.id === 'coherence-ngram-repetition')!.severity).toBe(
      'warning',
    );
    expect(result.score).toBeLessThan(0.8);
  });

  it('does not emit n-gram warning for diverse text', () => {
    const text =
      'Artificial intelligence is transforming industries across the globe. ' +
      'Machine learning algorithms can process vast amounts of data efficiently. ' +
      'Natural language processing enables computers to understand human speech. ' +
      'Computer vision allows machines to interpret and analyze visual information.';
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-ngram-repetition')).toBe(false);
  });

  it('handles text with fewer than 3 tokens gracefully', () => {
    const result = scoreContentCoherence('hello world');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ── Sentence Repetition ──────────────────────────────────────────────────────

describe('scoreContentCoherence — sentence repetition', () => {
  it('emits critical signal for >20% duplicate sentences', () => {
    const text =
      'The sky is blue. The sky is blue. The sky is blue. ' +
      'The sky is blue. The grass is green.';
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-sentence-repetition')).toBe(true);
    expect(
      result.signals.find((s) => s.id === 'coherence-sentence-repetition')!.severity,
    ).toBe('critical');
  });

  it('produces lower score for highly repetitive sentences', () => {
    const text =
      'I am a sentence. I am a sentence. I am a sentence. ' +
      'I am a sentence. I am a sentence.';
    const result = scoreContentCoherence(text);
    expect(result.score).toBeLessThan(0.7);
  });

  it('does not penalize unique sentences', () => {
    const text =
      'First sentence here. Second unique sentence. Third distinct sentence. Fourth original thought.';
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-sentence-repetition')).toBe(false);
  });
});

// ── Sliding Window Repetition ────────────────────────────────────────────────

describe('scoreContentCoherence — sliding window repetition', () => {
  it('emits critical signal for 50+ char repeated block', () => {
    const block = 'This is a repeated block of text that is at least fifty characters long and will be detected. ';
    // Repeat the same block with enough surrounding text
    const text = block + 'Some intervening text here to separate. ' + block;
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-sliding-repeat')).toBe(true);
    expect(
      result.signals.find((s) => s.id === 'coherence-sliding-repeat')!.severity,
    ).toBe('critical');
    expect(result.score).toBeLessThanOrEqual(0.5);
  });

  it('does not flag short text under 100 chars', () => {
    const text = 'Short text.';
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-sliding-repeat')).toBe(false);
  });
});

// ── Lexical Diversity ────────────────────────────────────────────────────────

describe('scoreContentCoherence — lexical diversity', () => {
  it('emits warning for low lexical diversity', () => {
    // Many repetitions of the same few words
    const text = Array(50).fill('the the the cat cat').join(' ');
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-low-diversity')).toBe(true);
    expect(result.signals.find((s) => s.id === 'coherence-low-diversity')!.severity).toBe(
      'warning',
    );
  });

  it('does not warn for diverse vocabulary', () => {
    const text =
      'The remarkable advancement of quantum computing challenges traditional encryption methodologies. ' +
      'Researchers explore novel algorithms designed for unprecedented parallel processing capabilities. ' +
      'Superconducting qubits demonstrate improved coherence times enabling complex simulations.';
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-low-diversity')).toBe(false);
  });
});

// ── JSON Format ──────────────────────────────────────────────────────────────

describe('scoreContentCoherence — JSON format', () => {
  it('extracts string values from JSON for analysis', () => {
    const json = JSON.stringify({
      title: 'A diverse and interesting title about technology',
      body: 'The body contains varied vocabulary and well-structured sentences.',
      tags: ['artificial intelligence', 'machine learning', 'data science'],
    });
    const result = scoreContentCoherence(json, 'json');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    // Should not flag as degenerate since there are real strings inside
    expect(result.signals.some((s) => s.id === 'coherence-empty')).toBe(false);
  });

  it('handles invalid JSON gracefully (falls back to raw text)', () => {
    const input = '{"broken json';
    const result = scoreContentCoherence(input, 'json');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('extracts nested JSON string values', () => {
    const json = JSON.stringify({
      level1: {
        level2: {
          message: 'Deeply nested content with sufficient vocabulary diversity for analysis.',
        },
      },
      items: ['first item', 'second item', 'third item'],
    });
    const result = scoreContentCoherence(json, 'json');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.signals.some((s) => s.id === 'coherence-empty')).toBe(false);
  });
});

// ── Short Text / Edge Cases ──────────────────────────────────────────────────

describe('scoreContentCoherence — edge cases', () => {
  it('handles single word input', () => {
    const result = scoreContentCoherence('hello');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('handles single sentence', () => {
    const result = scoreContentCoherence('This is a single sentence with enough words.');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('handles two identical characters that are not single-char-repeat', () => {
    const result = scoreContentCoherence('ab');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.signals.some((s) => s.id === 'coherence-single-char-repeat')).toBe(false);
  });
});

// ── Signal Shape ─────────────────────────────────────────────────────────────

describe('scoreContentCoherence — signal shape', () => {
  it('emits signals with correct structure', () => {
    const result = scoreContentCoherence('');
    const signal = result.signals[0];
    expect(signal).toHaveProperty('id');
    expect(signal).toHaveProperty('severity');
    expect(signal).toHaveProperty('dimension');
    expect(signal).toHaveProperty('message');
    expect(signal).toHaveProperty('location');
    expect(signal.dimension).toBe('content-coherence');
    expect(signal.location).toBeNull();
    expect(typeof signal.id).toBe('string');
    expect(typeof signal.message).toBe('string');
  });

  it('all signals have dimension set to content-coherence', () => {
    // Generate output that triggers multiple signals
    const phrase = 'the quick fox ';
    const text = phrase.repeat(30);
    const result = scoreContentCoherence(text);
    for (const signal of result.signals) {
      expect(signal.dimension).toBe('content-coherence');
    }
  });

  it('uses correct severity levels (critical, warning, info)', () => {
    // Critical: empty
    const emptyResult = scoreContentCoherence('');
    expect(emptyResult.signals[0].severity).toBe('critical');

    // Critical: single char repeat
    const repeatResult = scoreContentCoherence('zzzzzzzzzz');
    expect(repeatResult.signals[0].severity).toBe('critical');
  });
});

// ── Score Clamping ───────────────────────────────────────────────────────────

describe('scoreContentCoherence — score clamping', () => {
  it('never returns score below 0', () => {
    const result = scoreContentCoherence('');
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('never returns score above 1', () => {
    const text =
      'The diverse vocabulary ensures high quality coherent output. ' +
      'Multiple unique sentences demonstrate excellent writing structure. ' +
      'Technical concepts are explained clearly and concisely.';
    const result = scoreContentCoherence(text);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('score is always a finite number', () => {
    const inputs = ['', 'a', 'hello world', 'x'.repeat(500)];
    for (const input of inputs) {
      const result = scoreContentCoherence(input);
      expect(Number.isFinite(result.score)).toBe(true);
    }
  });
});

// ── Sentence Structure ───────────────────────────────────────────────────────

describe('scoreContentCoherence — sentence structure', () => {
  it('warns about very short average sentence length', () => {
    // Create text that splits into many very short sentences
    const text = 'Go. Run. Now. Stop. Wait. Go. Help. Run. Fast. Slow.';
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-short-sentences')).toBe(true);
  });

  it('does not warn about normal sentence length', () => {
    const text =
      'This sentence has a reasonable number of words in it. ' +
      'Another sentence also contains enough words for analysis.';
    const result = scoreContentCoherence(text);
    expect(result.signals.some((s) => s.id === 'coherence-short-sentences')).toBe(false);
    expect(result.signals.some((s) => s.id === 'coherence-long-sentences')).toBe(false);
  });
});

// ── Format Auto-Detection ────────────────────────────────────────────────────

describe('scoreContentCoherence — format detection', () => {
  it('auto-detects JSON and extracts strings', () => {
    const json = '{"message": "Hello world from the JSON format"}';
    const result = scoreContentCoherence(json);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('handles plain text when no format specified', () => {
    const text = 'Just a plain text paragraph with reasonable content.';
    const result = scoreContentCoherence(text);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
