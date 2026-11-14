/** Find the charset declared in a Content-Type header or an HTML <meta> tag. */
export function detectCharset(bytes: Uint8Array, contentType?: string | null): string | undefined {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  return head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1]?.toLowerCase();
}

/**
 * Decode page bytes. Most pages on the site are ISO-8859-1. If no charset is
 * declared, try strict UTF-8 and fall back to windows-1252 (a superset of latin-1).
 */
export function decodeHtml(bytes: Uint8Array, contentType?: string | null): string {
  const charset = detectCharset(bytes, contentType);
  if (charset) {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      // Unknown label: fall through to detection.
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
