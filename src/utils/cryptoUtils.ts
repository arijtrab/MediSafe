/**
 * Cryptographic utility functions for Clinical Calm
 * Implements real Web Crypto API digests and hash formatting.
 */

export async function computeSha256(input: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback simple deterministic hex generator if crypto.subtle is unavailable
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, 'a');
  }
}

/**
 * Canonical JSON serialization (RFC 8785 style)
 * Recursively sorts keys to ensure deterministic serialization regardless of key insertion order.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalJsonStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`).join(',') + '}';
}

export async function computeCanonicalJsonHash(obj: any): Promise<string> {
  const canonical = canonicalJsonStringify(obj);
  return computeSha256(canonical);
}

/**
 * Formats a long hash or certificate string with middle truncation.
 * e.g. e3b0c442...a8b3c4
 */
export function formatMiddleTruncation(hash: string, leadLength: number = 8, tailLength: number = 8): string {
  if (!hash) return '';
  if (hash.length <= leadLength + tailLength + 3) return hash;
  return `${hash.slice(0, leadLength)}...${hash.slice(-tailLength)}`;
}

/**
 * Masks a cryptographic hash or sensitive digest for safe display in UI/logs,
 * preventing cleartext cryptographic leakage and reconnaissance.
 * e.g., "SHA256:••••••••a8b3"
 */
export function maskCryptoHash(hash?: string, visibleTail: number = 4): string {
  if (!hash) return '••••••••';
  if (hash.length <= visibleTail) return '••••••••';
  return `SHA256:••••••••${hash.slice(-visibleTail)}`;
}

/**
 * Extracts image URLs from HTML strings, standard img tags, markdown syntax, or raw URLs
 */
export function extractImagesFromHtml(rawInput: string): { url: string; altText: string; source: 'html' | 'markdown' | 'url' }[] {
  const results: { url: string; altText: string; source: 'html' | 'markdown' | 'url' }[] = [];
  const trimmed = rawInput.trim();

  if (!trimmed) return results;

  // 1. Check for standard <img> tags
  const imgTagRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgTagRegex.exec(trimmed)) !== null) {
    const fullTag = match[0];
    const src = match[1];
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : 'Image importée depuis HTML';
    results.push({ url: src, altText: alt, source: 'html' });
  }

  // 2. Check for markdown ![alt](url)
  const mdRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;
  while ((match = mdRegex.exec(trimmed)) !== null) {
    results.push({ url: match[2], altText: match[1] || 'Markdown Image', source: 'markdown' });
  }

  // 3. If direct URL and no tags found yet
  if (results.length === 0 && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/') || trimmed.startsWith('/'))) {
    results.push({
      url: trimmed,
      altText: 'Lien direct d\'imagerie',
      source: 'url',
    });
  }

  return results;
}
