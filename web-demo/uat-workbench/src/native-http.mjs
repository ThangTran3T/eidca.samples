import http from 'node:http';
import https from 'node:https';

const TLS_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_UNTRUSTED', 'CERT_REVOKED', 'CERT_SIGNATURE_FAILURE',
]);

export class TransportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.tls = TLS_CODES.has(code);
  }
}

// Native HTTP like Postman Desktop: no Origin, no Sec-Fetch-*, no cookies, no redirects.
// node:http is used instead of fetch() because undici adds sec-fetch-mode to every request.
// TLS verification stays on; run with --use-system-ca so the approved Windows trust applies.
export function nativeRequest(url, { method = 'GET', headers = {}, body = null, timeoutMs = 120000, maxBytes = 130 * 1024 * 1024 } = {}) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) return Promise.reject(new TransportError('UNSUPPORTED_PROTOCOL', u.protocol));
  for (const k of Object.keys(headers)) {
    if (/^(origin|cookie|sec-fetch-.*)$/i.test(k)) return Promise.reject(new TransportError('BROWSER_HEADER_FORBIDDEN', k));
  }
  const payload = body == null ? null : Buffer.from(body, 'utf8');
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(u, {
      method,
      agent: false,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VNeCA-UAT-Workbench/1.0',
        Connection: 'close',
        ...headers,
        ...(payload ? { 'Content-Length': payload.length } : {}),
      },
    }, res => {
      const chunks = [];
      let size = 0;
      res.on('data', c => {
        size += c.length;
        if (size > maxBytes) req.destroy(new TransportError('RESPONSE_TOO_LARGE', 'Response exceeds ' + maxBytes + ' bytes'));
        else chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', e => reject(new TransportError(e.code || 'RESPONSE_ERROR', e.message)));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new TransportError('TIMEOUT', 'No response within ' + timeoutMs + ' ms')));
    req.on('error', e => reject(e instanceof TransportError ? e : new TransportError(e.code || 'REQUEST_ERROR', e.message)));
    if (payload) req.write(payload);
    req.end();
  });
}
