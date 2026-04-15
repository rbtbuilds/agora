const MAX_RESPONSE_BYTES = 1_048_576; // 1 MB

export function validateExternalUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  // Enforce HTTPS only
  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTPS URLs are allowed" };
  }

  // Block IPv6 addresses
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith("[")) {
    return { valid: false, error: "IPv6 addresses are not allowed" };
  }

  // Block decimal IPs (e.g. 2130706433 == 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    return { valid: false, error: "Decimal IP addresses are not allowed" };
  }

  // Block hex IPs (e.g. 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    return { valid: false, error: "Hex IP addresses are not allowed" };
  }

  // Block known internal hostnames
  const blocked = [
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "metadata.google.internal", "169.254.169.254",
  ];
  if (blocked.includes(hostname)) {
    return { valid: false, error: "Internal addresses are not allowed" };
  }

  // Block private IP ranges (also catches octal-encoded octets via Number())
  const parts = hostname.split(".");
  if (parts.length === 4) {
    // Reject octets with leading zeros (octal encoding like 0177.0.0.1)
    if (parts.some(p => /^0\d+$/.test(p))) {
      return { valid: false, error: "Octal IP addresses are not allowed" };
    }
    if (parts.every(p => /^\d+$/.test(p))) {
      const octets = parts.map(Number);
      if (octets[0] === 10) return { valid: false, error: "Private IP addresses are not allowed" };
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return { valid: false, error: "Private IP addresses are not allowed" };
      if (octets[0] === 192 && octets[1] === 168) return { valid: false, error: "Private IP addresses are not allowed" };
      if (octets[0] === 169 && octets[1] === 254) return { valid: false, error: "Link-local addresses are not allowed" };
      if (octets[0] === 127) return { valid: false, error: "Loopback addresses are not allowed" };
    }
  }

  return { valid: true };
}

/**
 * A hardened wrapper around fetch() that:
 * - Disables redirect following (redirect: "manual")
 * - Enforces a 10-second timeout
 * - Rejects responses larger than 1 MB
 */
export async function safeFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });

  // Enforce 1 MB response size limit by reading into a buffer
  const reader = response.body?.getReader();
  if (reader) {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel();
        throw new Error("Response exceeded 1 MB size limit");
      }
      chunks.push(value);
    }

    // Reconstruct a Response with the buffered body so callers can still read it
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new Response(combined, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  return response;
}
