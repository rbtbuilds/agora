// SSRF guard + size/timeout/redirect-controlled fetch.
// Mirrors packages/api/src/lib/url-validator.ts so the validator can be invoked
// server-side against untrusted URLs without becoming an SSRF vector.

const MAX_RESPONSE_BYTES = 1_048_576; // 1 MB

export function validateExternalUrl(url: string): { valid: boolean; error?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Only HTTPS URLs are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith("[")) {
    return { valid: false, error: "IPv6 addresses are not allowed" };
  }
  if (/^\d+$/.test(hostname)) {
    return { valid: false, error: "Decimal IP addresses are not allowed" };
  }
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    return { valid: false, error: "Hex IP addresses are not allowed" };
  }

  const blocked = [
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "metadata.google.internal", "169.254.169.254",
  ];
  if (blocked.includes(hostname)) {
    return { valid: false, error: "Internal addresses are not allowed" };
  }

  const parts = hostname.split(".");
  if (parts.length === 4) {
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

export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const check = validateExternalUrl(url);
  if (!check.valid) {
    throw new Error(check.error ?? "URL rejected by SSRF guard");
  }

  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });

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
