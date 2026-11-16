import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/api/HttpError.js';
import { searchCountries } from '../src/api/searchCountries.js';
import { spainResponse } from './fixtures/spain.js';

const TIMEOUT = 10_000;

function mockPendingFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation((_url, options) => {
      const signal = options?.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        });
      });
    }),
  );
}

function mockResponse(status: number, body: unknown = null) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(response as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, response };
}

describe('searchCountries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns countries and sends an encoded query with an abort signal', async () => {
    const { fetchMock } = mockResponse(200, [spainResponse]);
    const controller = new AbortController();

    const countries = await searchCountries('sp ain/é?', controller.signal);

    expect(countries).toEqual([spainResponse]);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://countries.dev/name/sp%20ain%2F%C3%A9%3F',
      { signal: expect.any(AbortSignal) },
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns an empty result for 404 without parsing its body', async () => {
    const { response } = mockResponse(404);

    await expect(
      searchCountries('unknown', new AbortController().signal),
    ).resolves.toEqual([]);
    expect(response.json).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([400, 401, 429, 500, 503])(
    'throws HttpError for HTTP %i',
    async (status) => {
      const { response } = mockResponse(status);

      const error = await searchCountries(
        'spain',
        new AbortController().signal,
      ).catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ name: 'HttpError', status });
      expect(response.json).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('preserves network failures rather than returning an empty result', async () => {
    const error = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(error));

    await expect(
      searchCountries('spain', new AbortController().signal),
    ).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves errors while reading the response body', async () => {
    const { response } = mockResponse(200);
    const error = new SyntaxError('Invalid JSON');
    response.json.mockRejectedValue(error);

    await expect(
      searchCountries('spain', new AbortController().signal),
    ).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('really aborts fetch when the caller cancels and preserves AbortError', async () => {
    mockPendingFetch();
    const controller = new AbortController();
    const promise = searchCountries('spain', controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });

    controller.abort();

    await rejection;
    const requestSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
    expect(requestSignal?.aborted).toBe(true);
    expect(requestSignal?.reason).toBe(controller.signal.reason);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects immediately when the caller signal is already aborted', async () => {
    mockPendingFetch();
    const controller = new AbortController();
    controller.abort();

    await expect(
      searchCountries('spain', controller.signal),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a stalled fetch with TimeoutError, not AbortError', async () => {
    mockPendingFetch();
    const controller = new AbortController();
    const promise = searchCountries('spain', controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    const requestSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;

    await vi.advanceTimersByTimeAsync(TIMEOUT - 1);
    expect(requestSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the timeout active until the response body finishes loading', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
        const signal = options?.signal;
        return {
          ok: true,
          status: 200,
          json: () =>
            new Promise((_resolve, reject) => {
              signal?.addEventListener('abort', () => reject(signal.reason), {
                once: true,
              });
            }),
        } as unknown as Response;
      }),
    );
    const promise = searchCountries('spain', controller.signal);
    const rejection = expect(promise).rejects.toMatchObject({
      name: 'TimeoutError',
    });

    await vi.advanceTimersByTimeAsync(TIMEOUT);

    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes the caller abort listener when the request completes', async () => {
    mockResponse(200, [spainResponse]);
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    await searchCountries('spain', controller.signal);

    const abortListener = addListener.mock.calls.find(
      ([event]) => event === 'abort',
    )?.[1];
    expect(abortListener).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith('abort', abortListener);
  });
});
