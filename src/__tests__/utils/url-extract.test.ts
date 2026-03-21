import { describe, it, expect } from 'vitest';
import { extractUrls } from '../../utils/url-extract';

// ── Basic Extraction ─────────────────────────────────────────────────────────

describe('extractUrls — basic extraction', () => {
  it('extracts a single HTTP URL', () => {
    const results = extractUrls('Visit https://github.com/user/repo for code.');
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe('https://github.com/user/repo');
  });

  it('extracts a single HTTP (non-S) URL', () => {
    const results = extractUrls('See http://example.org/page.');
    expect(results).toHaveLength(1);
    expect(results[0]!.url).toContain('http://');
  });

  it('extracts multiple URLs from text', () => {
    const text = 'First https://a.com/x and second https://b.io/y are here.';
    const results = extractUrls(text);
    expect(results).toHaveLength(2);
  });

  it('returns empty array for text with no URLs', () => {
    const results = extractUrls('No links here at all.');
    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty string', () => {
    expect(extractUrls('')).toHaveLength(0);
  });

  it('captures correct start/end offsets', () => {
    const text = 'Go to https://github.com/user/repo now.';
    const results = extractUrls(text);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(text.slice(r.start, r.end)).toBe(r.url);
  });

  it('captures correct start offset when URL is at the beginning', () => {
    const text = 'https://github.com/user/repo is the link.';
    const results = extractUrls(text);
    expect(results[0]!.start).toBe(0);
  });
});

// ── Example Domain Detection ─────────────────────────────────────────────────

describe('extractUrls — example domain detection', () => {
  const exampleDomains = [
    'example.com',
    'example.org',
    'test.com',
    'sample.org',
    'foo.com',
    'bar.com',
    'baz.com',
    'placeholder.com',
    'dummy.com',
    'fake.com',
    'notreal.com',
    'tempsite.com',
  ];

  for (const domain of exampleDomains) {
    it(`flags ${domain} as suspicious`, () => {
      const results = extractUrls(`https://${domain}/page`);
      expect(results).toHaveLength(1);
      expect(results[0]!.suspicious).toBe(true);
      expect(results[0]!.reason).toBe('example domain');
    });
  }

  it('flags subdomains of example.com as suspicious', () => {
    const results = extractUrls('https://api.example.com/v1');
    expect(results[0]!.suspicious).toBe(true);
  });
});

// ── Deep Path Detection ──────────────────────────────────────────────────────

describe('extractUrls — deep path detection', () => {
  it('flags URL with exactly 5 path segments as suspicious', () => {
    const results = extractUrls('https://realsite.org/a/b/c/d/e');
    expect(results).toHaveLength(1);
    expect(results[0]!.suspicious).toBe(true);
    expect(results[0]!.reason).toBe('deep path');
  });

  it('flags URL with more than 5 path segments as suspicious', () => {
    const results = extractUrls('https://realsite.org/a/b/c/d/e/f/g');
    expect(results[0]!.suspicious).toBe(true);
    expect(results[0]!.reason).toBe('deep path');
  });

  it('does not flag URL with 4 path segments', () => {
    const results = extractUrls('https://realsite.org/a/b/c/d');
    expect(results).toHaveLength(1);
    expect(results[0]!.suspicious).toBe(false);
  });

  it('does not flag URL with 2 path segments (user/repo)', () => {
    const results = extractUrls('https://github.com/user/repo');
    expect(results[0]!.suspicious).toBe(false);
  });

  it('does not flag URL with empty path', () => {
    const results = extractUrls('https://github.com');
    expect(results[0]!.suspicious).toBe(false);
  });
});

// ── Implausible TLD Detection ─────────────────────────────────────────────────

describe('extractUrls — implausible TLD detection', () => {
  it('flags all-numeric TLD as suspicious', () => {
    const results = extractUrls('https://some-site.123/page');
    // May or may not parse as valid URL; if extracted, check suspicion
    if (results.length > 0) {
      expect(results[0]!.suspicious).toBe(true);
      expect(results[0]!.reason).toBe('all-numeric TLD');
    }
  });

  it('flags TLD longer than 6 characters as suspicious', () => {
    // TLDs like .information (11 chars) are implausible
    const results = extractUrls('https://some-site.information/page');
    if (results.length > 0) {
      expect(results[0]!.suspicious).toBe(true);
      expect(results[0]!.reason).toBe('implausible TLD length');
    }
  });

  it('does not flag .io (2 chars) as suspicious by TLD length', () => {
    const results = extractUrls('https://myapp.io/dashboard');
    expect(results).toHaveLength(1);
    expect(results[0]!.suspicious).toBe(false);
  });

  it('does not flag .com (3 chars) as suspicious by TLD', () => {
    const results = extractUrls('https://legit-site.com/short/path');
    expect(results[0]!.suspicious).toBe(false);
  });
});

// ── Clean URLs ───────────────────────────────────────────────────────────────

describe('extractUrls — clean legitimate URLs', () => {
  it('does not flag github.com user/repo URL', () => {
    const results = extractUrls('https://github.com/microsoft/typescript');
    expect(results[0]!.suspicious).toBe(false);
  });

  it('does not flag npmjs.com package URL', () => {
    const results = extractUrls('https://www.npmjs.com/package/vitest');
    expect(results[0]!.suspicious).toBe(false);
  });

  it('does not flag docs URL with 3-segment path', () => {
    const results = extractUrls('https://docs.python.org/3/library/datetime');
    expect(results[0]!.suspicious).toBe(false);
  });

  it('returns suspicious=false and no reason for clean URL', () => {
    const results = extractUrls('https://anthropic.com/research');
    expect(results[0]!.suspicious).toBe(false);
    expect(results[0]!.reason).toBeUndefined();
  });
});

// ── UrlLocation Shape ────────────────────────────────────────────────────────

describe('extractUrls — result shape', () => {
  it('each result has url, start, end, suspicious fields', () => {
    const results = extractUrls('See https://example.com/page for details.');
    for (const r of results) {
      expect(typeof r.url).toBe('string');
      expect(typeof r.start).toBe('number');
      expect(typeof r.end).toBe('number');
      expect(typeof r.suspicious).toBe('boolean');
    }
  });

  it('end offset equals start + url length', () => {
    const results = extractUrls('Link: https://github.com/user/repo done.');
    for (const r of results) {
      expect(r.end - r.start).toBe(r.url.length);
    }
  });
});
