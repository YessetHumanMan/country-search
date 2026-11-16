import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../src/utils/debounce.js';

const DELAY = 300;

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not invoke the callback immediately', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, DELAY);

    debounced();

    expect(callback).not.toHaveBeenCalled();
  });

  it('invokes the callback once after the full delay', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, DELAY);

    debounced();
    vi.advanceTimersByTime(DELAY - 1);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(DELAY);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on every call and uses the latest arguments', () => {
    const callback = vi.fn<(query: string, page: number) => void>();
    const debounced = debounce(callback, DELAY);

    debounced('sp', 1);
    vi.advanceTimersByTime(200);
    debounced('spa', 2);
    vi.advanceTimersByTime(200);
    debounced('spain', 3);
    vi.advanceTimersByTime(DELAY - 1);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledExactlyOnceWith('spain', 3);
  });

  it('can schedule another invocation after the previous one completes', () => {
    const callback = vi.fn<(query: string) => void>();
    const debounced = debounce(callback, DELAY);

    debounced('spain');
    vi.advanceTimersByTime(DELAY);
    debounced('france');
    vi.advanceTimersByTime(DELAY);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'spain');
    expect(callback).toHaveBeenNthCalledWith(2, 'france');
  });

  it('cancels a pending invocation', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, DELAY);

    debounced();
    vi.advanceTimersByTime(DELAY - 1);
    debounced.cancel();
    vi.advanceTimersByTime(DELAY);

    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows repeated cancellation and reuse after cancellation', () => {
    const callback = vi.fn<(query: string) => void>();
    const debounced = debounce(callback, DELAY);

    debounced.cancel();
    debounced('sp');
    debounced.cancel();
    debounced.cancel();
    debounced('spain');
    vi.advanceTimersByTime(DELAY);
    debounced.cancel();

    expect(callback).toHaveBeenCalledExactlyOnceWith('spain');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps timers of different debounced functions independent', () => {
    const first = vi.fn();
    const second = vi.fn();
    const debounceFirst = debounce(first, DELAY);
    const debounceSecond = debounce(second, DELAY);

    debounceFirst();
    debounceSecond();
    debounceFirst.cancel();
    vi.advanceTimersByTime(DELAY);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('defers a zero-delay invocation until timers run', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 0);

    debounced();
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
