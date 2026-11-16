import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearchController } from '../src/model/createSearchController.js';
import type { SearchState } from '../src/model/createSearchController.js';
import { mapCountryResponse } from '../src/model/mapCountryResponse.js';
import { spainResponse } from './fixtures/spain.js';

describe('search request race', () => {
  let app: ReturnType<typeof createSearchController> | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    app?.dispose();
    app = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts the older fetch on input and retains only the latest result despite reversed response timing', async () => {
    const responseAttempts: string[] = [];
    const rejections: { query: string; reason: unknown }[] = [];
    const signals = new Map<string, AbortSignal>();
    const states: SearchState[] = [];
    const oldCountry = { ...spainResponse, name: 'Old result for sp' };

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation((url, options) => {
        const query = decodeURIComponent(String(url).split('/name/')[1] ?? '');
        const signal = options?.signal;
        if (!signal) throw new Error('The request must include an AbortSignal');
        signals.set(query, signal);

        const response = new Promise<Response>((resolve, reject) => {
          const abort = (): void => reject(signal.reason);
          if (signal.aborted) {
            abort();
            return;
          }
          signal.addEventListener('abort', abort, { once: true });

          // Имитируем позднюю готовность ответа сервера даже после отмены клиента.
          // Промис fetch при этом обязан сразу отклониться по abort, а не ждать таймер.
          setTimeout(
            () => {
              signal.removeEventListener('abort', abort);
              responseAttempts.push(query);
              resolve(
                new Response(
                  JSON.stringify([query === 'sp' ? oldCountry : spainResponse]),
                  {
                    status: 200,
                  },
                ),
              );
            },
            query === 'sp' ? 1200 : 100,
          );
        });

        return response.catch((reason: unknown) => {
          rejections.push({ query, reason });
          throw reason;
        });
      });
    vi.stubGlobal('fetch', fetchMock);
    const controller = createSearchController({
      onStateChange: (state) => states.push(state),
    });
    app = controller;

    controller.setQuery('sp');
    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toEqual({ status: 'loading', query: 'sp' });

    await vi.advanceTimersByTimeAsync(50);
    controller.setQuery('spain');

    // Проверяем отмену ДО истечения debounce следующего запроса.
    expect(signals.get('sp')?.aborted).toBe(true);
    expect(signals.get('sp')?.reason).toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(rejections).toEqual([
      { query: 'sp', reason: expect.objectContaining({ name: 'AbortError' }) },
    ]);
    expect(controller.getState()).toEqual({
      status: 'debouncing',
      query: 'spain',
    });

    await vi.advanceTimersByTimeAsync(300);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toEqual({
      status: 'loading',
      query: 'spain',
    });
    expect(signals.get('spain')?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    const latestState: SearchState = {
      status: 'success',
      query: 'spain',
      countries: [mapCountryResponse(spainResponse)],
    };
    expect(controller.getState()).toEqual(latestState);
    expect(responseAttempts).toEqual(['spain']);
    const stateCount = states.length;

    // Теперь наступает время более старого ответа; он ничего не перезаписывает.
    await vi.advanceTimersByTimeAsync(750);

    expect(responseAttempts).toEqual(['spain', 'sp']);
    expect(controller.getState()).toEqual(latestState);
    expect(states).toHaveLength(stateCount);
    expect(states.filter((state) => state.status === 'success')).toEqual([
      latestState,
    ]);
    expect(states.some((state) => state.status === 'error')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
