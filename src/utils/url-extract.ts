export interface UrlLocation {
  url: string;
  start: number;
  end: number;
  suspicious: boolean;
  reason?: string;
}

const EXAMPLE_DOMAINS = new Set([
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
]);

const URL_RE = /https?:\/\/[^\s<>"'\])]*([\w/])/g;

/**
 * Extract URLs from text with their character offsets and suspicion flags.
 *
 * A URL is flagged as suspicious when:
 * - Its domain is in the known-fake-domain list
 * - Its path has 5 or more segments
 * - Its TLD is all-numeric or longer than 6 characters
 */
export function extractUrls(text: string): UrlLocation[] {
  const results: UrlLocation[] = [];
  let match: RegExpExecArray | null;

  URL_RE.lastIndex = 0;

  while ((match = URL_RE.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    let suspicious = false;
    let reason: string | undefined;

    try {
      const parsed = new URL(raw);
      const hostname = parsed.hostname;

      // Extract TLD from hostname (last label after final dot)
      const labels = hostname.split('.');
      const tld = labels[labels.length - 1] ?? '';

      // Check known example/fake domains
      const isExampleDomain = EXAMPLE_DOMAINS.has(hostname) ||
        [...EXAMPLE_DOMAINS].some((d) => hostname.endsWith('.' + d) || hostname === d);

      if (isExampleDomain) {
        suspicious = true;
        reason = 'example domain';
      } else if (/^\d+$/.test(tld)) {
        // All-numeric TLD (e.g., .123)
        suspicious = true;
        reason = 'all-numeric TLD';
      } else if (tld.length > 6) {
        // Implausibly long TLD
        suspicious = true;
        reason = 'implausible TLD length';
      } else {
        // Check path depth: split pathname by '/', ignore empty segments
        const pathSegments = parsed.pathname.split('/').filter(Boolean);
        if (pathSegments.length >= 5) {
          suspicious = true;
          reason = 'deep path';
        }
      }
    } catch {
      // URL() parsing failed — apply heuristics on the raw string
      // Extract hostname portion between :// and first / or end
      const hostMatch = /^https?:\/\/([^/?#]+)/.exec(raw);
      if (hostMatch) {
        const hostname = hostMatch[1]!;
        const labels = hostname.split('.');
        const tld = labels[labels.length - 1] ?? '';
        if (/^\d+$/.test(tld)) {
          suspicious = true;
          reason = 'all-numeric TLD';
        } else if (tld.length > 6) {
          suspicious = true;
          reason = 'implausible TLD length';
        }
      }
    }

    results.push({ url: raw, start, end, suspicious, ...(reason !== undefined ? { reason } : {}) });
  }

  return results;
}
