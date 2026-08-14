import { gunzipSync } from 'node:zlib';

import { compressResponse } from '../compression';

describe('compressResponse', () => {
  it('compresses large negotiated JSON and preserves parseable content', async () => {
    const value = { results: Array.from({ length: 200 }, () => 'repeated response value') };
    const plain = JSON.stringify(value);
    const response = await compressResponse(
      new Request('https://example.test/api', {
        headers: { 'Accept-Encoding': 'br, gzip' },
      }),
      Response.json(value),
    );

    expect(response.headers.get('Content-Encoding')).toBe('gzip');
    expect(response.headers.get('Vary')).toContain('Accept-Encoding');
    const compressed = Buffer.from(await response.arrayBuffer());
    expect(compressed.byteLength).toBeLessThan(plain.length / 4);
    expect(JSON.parse(gunzipSync(compressed).toString('utf8'))).toEqual(value);
  });

  it('does not compress small, unnegotiated, or already encoded responses', async () => {
    const small = await compressResponse(
      new Request('https://example.test/api', {
        headers: { 'Accept-Encoding': 'gzip' },
      }),
      Response.json({ ok: true }),
    );
    expect(small.headers.get('Content-Encoding')).toBeNull();
    await expect(small.json()).resolves.toEqual({ ok: true });

    const unnegotiated = await compressResponse(
      new Request('https://example.test/api'),
      Response.json({ value: 'x'.repeat(2_000) }),
    );
    expect(unnegotiated.headers.get('Content-Encoding')).toBeNull();
    await expect(unnegotiated.json()).resolves.toEqual({ value: 'x'.repeat(2_000) });

    const encoded = await compressResponse(
      new Request('https://example.test/api', {
        headers: { 'Accept-Encoding': 'gzip' },
      }),
      new Response('already encoded', {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Encoding': 'br',
        },
      }),
    );
    expect(encoded.headers.get('Content-Encoding')).toBe('br');

    const refused = await compressResponse(
      new Request('https://example.test/api', {
        headers: { 'Accept-Encoding': 'gzip;q=0, *;q=1' },
      }),
      Response.json({ value: 'x'.repeat(2_000) }),
    );
    expect(refused.headers.get('Content-Encoding')).toBeNull();
  });

  it('returns the original large response when runtime gzip support fails', async () => {
    const original = global.CompressionStream;
    global.CompressionStream = class BrokenCompressionStream {
      constructor() {
        throw new Error('CompressionStream unavailable');
      }
    } as typeof CompressionStream;
    try {
      const value = { results: Array.from({ length: 200 }, () => 'event result') };
      const response = await compressResponse(
        new Request('https://example.test/api', {
          headers: { 'Accept-Encoding': 'gzip' },
        }),
        Response.json(value),
      );
      expect(response.headers.get('Content-Encoding')).toBeNull();
      await expect(response.json()).resolves.toEqual(value);
    } finally {
      global.CompressionStream = original;
    }
  });
});
