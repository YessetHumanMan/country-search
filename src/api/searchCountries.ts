import type { RawCountry } from '../model/country.js';
import { HttpError } from './HttpError.js';

const API_URL = 'https://countries.dev/name/';
const REQUEST_TIMEOUT_MS = 10_000;

/** Сохраняет исходную причину отмены: AbortError или TimeoutError. */
export async function searchCountries(
  query: string,
  signal: AbortSignal,
): Promise<RawCountry[]> {
  const controller = new AbortController();
  const abortFromCaller = (): void => controller.abort(signal.reason);

  signal.addEventListener('abort', abortFromCaller, { once: true });
  if (signal.aborted) abortFromCaller();

  const timer = setTimeout(() => {
    controller.abort(
      new DOMException('Country search timed out', 'TimeoutError'),
    );
  }, REQUEST_TIMEOUT_MS);

  try {
    controller.signal.throwIfAborted();
    const response = await fetch(`${API_URL}${encodeURIComponent(query)}`, {
      signal: controller.signal,
    });

    if (response.status === 404) return [];
    if (!response.ok) throw new HttpError(response.status);

    // await нужен, чтобы finally не снял таймаут до загрузки тела ответа.
    return (await response.json()) as RawCountry[];
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abortFromCaller);
  }
}
