import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/api/HttpError.js';
import type { searchCountries } from '../src/api/searchCountries.js';
import { createSearchController } from '../src/model/createSearchController.js';
import { mapCountryResponse } from '../src/model/mapCountryResponse.js';
import { spainResponse } from './fixtures/spain.js';

const DELAY = 300;

describe('createSearchController', () => {
  let controller: ReturnType<typeof createSearchController> | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    controller?.dispose();
    controller = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const search = vi
      .fn<typeof searchCountries>()
      .mockResolvedValue([spainResponse]);
    const onStateChange = vi.fn();
    const app = createSearchController({ search, onStateChange });
    controller = app;
    return { app, search, onStateChange };
  }

  it('starts idle without making a request', () => {
    const { app, search } = setup();

    expect(app.getState()).toEqual({ status: 'idle', query: '' });
    expect(search).not.toHaveBeenCalled();
  });

  it('does not search for empty or whitespace-only input', async () => {
    const { app, search } = setup();

    app.setQuery('   ');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(app.getState()).toEqual({ status: 'idle', query: '' });
    expect(search).not.toHaveBeenCalled();
  });

  it('debounces input and searches only the latest trimmed query', async () => {
    const { app, search } = setup();

    app.setQuery('sp');
    await vi.advanceTimersByTimeAsync(200);
    app.setQuery(' spain ');
    expect(app.getState()).toEqual({ status: 'debouncing', query: 'spain' });
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(search).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(search).toHaveBeenCalledExactlyOnceWith(
      'spain',
      expect.any(AbortSignal),
    );
    expect(app.getState()).toEqual({
      status: 'success',
      query: 'spain',
      countries: [mapCountryResponse(spainResponse)],
    });
  });

  it('publishes loading while a request is pending', async () => {
    const { app, search, onStateChange } = setup();
    search.mockImplementation(() => new Promise(() => {}));

    app.setQuery('spain');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(app.getState()).toEqual({ status: 'loading', query: 'spain' });
    expect(onStateChange).toHaveBeenLastCalledWith(app.getState());
  });

  it('cancels a pending debounce on clearing the input', async () => {
    const { app, search } = setup();

    app.setQuery('spain');
    app.setQuery('');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(search).not.toHaveBeenCalled();
    expect(app.getState()).toEqual({ status: 'idle', query: '' });
  });

  it('aborts the active request immediately on input, before the next debounce', async () => {
    const { app, search } = setup();
    search.mockImplementation(
      (_query, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    app.setQuery('sp');
    await vi.advanceTimersByTimeAsync(DELAY);
    const signal = search.mock.calls[0]?.[1];

    app.setQuery('spain');

    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toMatchObject({ name: 'AbortError' });
    expect(search).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(app.getState()).toEqual({ status: 'debouncing', query: 'spain' });
  });

  it('aborts an active request and clears results when input is cleared', async () => {
    const { app, search } = setup();
    search.mockImplementation(() => new Promise(() => {}));
    app.setQuery('spain');
    await vi.advanceTimersByTimeAsync(DELAY);
    const signal = search.mock.calls[0]?.[1];

    app.setQuery('');

    expect(signal?.aborted).toBe(true);
    expect(app.getState()).toEqual({ status: 'idle', query: '' });
  });

  it('clears previous results as soon as the user changes the query', async () => {
    const { app } = setup();
    app.setQuery('spain');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(app.getState().status).toBe('success');

    app.setQuery('france');

    expect(app.getState()).toEqual({ status: 'debouncing', query: 'france' });
  });

  it('publishes empty results as a friendly non-error state', async () => {
    const { app, search } = setup();
    search.mockResolvedValue([]);

    app.setQuery('no-match');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(app.getState()).toEqual({ status: 'empty', query: 'no-match' });
  });

  it.each([
    [new DOMException('Timed out', 'TimeoutError'), 'timeout'],
    [new HttpError(500), 'http'],
    [new TypeError('Failed to fetch'), 'network'],
    [new SyntaxError('Invalid JSON'), 'unknown'],
  ])('publishes a retryable error for %j', async (error, kind) => {
    const { app, search } = setup();
    search.mockRejectedValue(error);

    app.setQuery('spain');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(app.getState()).toMatchObject({
      status: 'error',
      query: 'spain',
      error: { kind, retryable: true, message: expect.any(String) },
    });
  });

  it('does not publish AbortError as an error or leave loading stuck', async () => {
    const { app, search, onStateChange } = setup();
    search.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    app.setQuery('spain');
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(app.getState()).toEqual({ status: 'idle', query: 'spain' });
    expect(
      onStateChange.mock.calls.some(([state]) => state.status === 'error'),
    ).toBe(false);
  });

  it('retries a failed query immediately without a debounce delay', async () => {
    const { app, search } = setup();
    search.mockRejectedValueOnce(new TypeError('Offline'));
    app.setQuery('spain');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(app.getState().status).toBe('error');

    app.retry();

    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenLastCalledWith('spain', expect.any(AbortSignal));
    await vi.advanceTimersByTimeAsync(0);
    expect(app.getState().status).toBe('success');
  });

  it('retries the newest input and cancels its pending debounce', async () => {
    const { app, search } = setup();
    search.mockRejectedValueOnce(new HttpError(500));
    app.setQuery('sp');
    await vi.advanceTimersByTimeAsync(DELAY);
    app.setQuery('spain');

    app.retry();
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(search).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenLastCalledWith('spain', expect.any(AbortSignal));
    expect(app.getState().query).toBe('spain');
  });

  it('does not retry an empty query', () => {
    const { app, search } = setup();

    app.retry();

    expect(search).not.toHaveBeenCalled();
    expect(app.getState()).toEqual({ status: 'idle', query: '' });
  });

  it('disposes pending timers and ignores subsequent input and retry', async () => {
    const { app, search, onStateChange } = setup();
    app.setQuery('spain');

    app.dispose();
    const callCount = onStateChange.mock.calls.length;
    app.setQuery('france');
    app.retry();
    app.dispose();
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(search).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledTimes(callCount);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts an active request on disposal without publishing its rejection', async () => {
    const { app, search, onStateChange } = setup();
    search.mockImplementation(
      (_query, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    app.setQuery('spain');
    await vi.advanceTimersByTimeAsync(DELAY);
    const signal = search.mock.calls[0]?.[1];

    app.dispose();
    const callCount = onStateChange.mock.calls.length;
    await vi.advanceTimersByTimeAsync(0);

    expect(signal?.aborted).toBe(true);
    expect(onStateChange).toHaveBeenCalledTimes(callCount);
  });
});
