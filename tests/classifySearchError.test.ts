import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/api/HttpError.js';
import { searchCountries } from '../src/api/searchCountries.js';
import { classifySearchError } from '../src/model/classifySearchError.js';

describe('classifySearchError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recognizes caller cancellation without a user-facing message or retry', () => {
    const controller = new AbortController();
    controller.abort();

    expect(classifySearchError(controller.signal.reason)).toEqual({
      kind: 'aborted',
      message: null,
      retryable: false,
    });
  });

  it('recognizes timeout as a real error, not caller cancellation', () => {
    const error = new DOMException('The operation timed out', 'TimeoutError');

    expect(classifySearchError(error)).toEqual({
      kind: 'timeout',
      message: 'Сервер не ответил вовремя. Попробуйте ещё раз.',
      retryable: true,
    });
  });

  it.each([400, 429, 500, 503])(
    'recognizes HTTP %i and preserves its status',
    (status) => {
      expect(classifySearchError(new HttpError(status))).toEqual({
        kind: 'http',
        status,
        message: `Ошибка сервера (HTTP ${status}). Попробуйте ещё раз.`,
        retryable: true,
      });
    },
  );

  it('recognizes a fetch network failure', () => {
    expect(classifySearchError(new TypeError('Failed to fetch'))).toEqual({
      kind: 'network',
      message:
        'Не удалось выполнить запрос. Проверьте подключение и повторите поиск.',
      retryable: true,
    });
  });

  it.each([
    new Error('Unexpected failure'),
    new SyntaxError('Invalid JSON'),
    null,
    undefined,
    'AbortError',
    500,
    {},
    { name: 'SomethingElse' },
  ])('handles an unknown rejection safely: %j', (error) => {
    expect(classifySearchError(error)).toEqual({
      kind: 'unknown',
      message: 'Не удалось загрузить страны. Попробуйте ещё раз.',
      retryable: true,
    });
  });

  it.each(['AbortError', 'TimeoutError'])(
    'uses the error name rather than its message: %s',
    (name) => {
      const error = new Error('Unrelated message');
      error.name = name;

      expect(classifySearchError(error).kind).toBe(
        name === 'AbortError' ? 'aborted' : 'timeout',
      );
    },
  );

  it('does not infer cancellation from a message containing AbortError', () => {
    expect(classifySearchError(new Error('AbortError')).kind).toBe('unknown');
  });

  it('keeps API 404 on the empty-result path, outside error classification', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 404 })),
    );
    const handleError = vi.fn(classifySearchError);

    const countries = await searchCountries(
      'no-match',
      new AbortController().signal,
    ).catch(handleError);

    expect(countries).toEqual([]);
    expect(handleError).not.toHaveBeenCalled();
  });

  it('classifies a non-404 API failure as a retryable HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 500 })),
    );

    const result = await searchCountries(
      'spain',
      new AbortController().signal,
    ).catch(classifySearchError);

    expect(result).toMatchObject({
      kind: 'http',
      status: 500,
      retryable: true,
    });
  });
});
