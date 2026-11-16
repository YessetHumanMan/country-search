import { searchCountries } from '../api/searchCountries.js';
import { debounce } from '../utils/debounce.js';
import { classifySearchError } from './classifySearchError.js';
import type { SearchError } from './classifySearchError.js';
import type { Country } from './country.js';
import { mapCountryResponse } from './mapCountryResponse.js';

type RetryableSearchError = Exclude<SearchError, { kind: 'aborted' }>;

export type SearchState =
  | { status: 'idle' | 'debouncing' | 'loading' | 'empty'; query: string }
  | { status: 'success'; query: string; countries: Country[] }
  | { status: 'error'; query: string; error: RetryableSearchError };

interface SearchControllerOptions {
  onStateChange: (state: SearchState) => void;
  search?: typeof searchCountries;
  debounceMs?: number;
}

/** Управляет поиском независимо от DOM; отменяет запрос на каждом изменении ввода. */
export function createSearchController({
  onStateChange,
  search = searchCountries,
  debounceMs = 300,
}: SearchControllerOptions) {
  let state: SearchState = { status: 'idle', query: '' };
  let activeRequest: AbortController | undefined;
  let disposed = false;

  const publish = (next: SearchState): void => {
    state = next;
    onStateChange(next);
  };

  const abortActiveRequest = (): void => {
    const previous = activeRequest;
    activeRequest = undefined;
    previous?.abort();
  };

  const runSearch = async (query: string): Promise<void> => {
    if (disposed) return;
    const request = new AbortController();
    activeRequest = request;
    publish({ status: 'loading', query });

    try {
      const raw = await search(query, request.signal);
      // Дополнительная защита после настоящего abort(), а не его замена.
      if (disposed || activeRequest !== request || request.signal.aborted)
        return;
      const countries = raw.map(mapCountryResponse);
      publish(
        countries.length > 0
          ? { status: 'success', query, countries }
          : { status: 'empty', query },
      );
    } catch (error: unknown) {
      // Отмена старого запроса не должна менять состояние нового.
      if (disposed || activeRequest !== request) return;
      const classified = classifySearchError(error);
      if (classified.kind === 'aborted') {
        publish({ status: 'idle', query });
      } else {
        publish({ status: 'error', query, error: classified });
      }
    } finally {
      if (activeRequest === request) activeRequest = undefined;
    }
  };

  const scheduledSearch = debounce((query: string) => {
    void runSearch(query);
  }, debounceMs);

  const cancelPendingWork = (): void => {
    abortActiveRequest();
    scheduledSearch.cancel();
  };

  return {
    getState: (): SearchState => state,

    setQuery(input: string): void {
      if (disposed) return;
      cancelPendingWork();
      const query = input.trim();
      if (!query) {
        publish({ status: 'idle', query: '' });
        return;
      }
      publish({ status: 'debouncing', query });
      scheduledSearch(query);
    },

    retry(): void {
      if (disposed) return;
      cancelPendingWork();
      if (state.query) void runSearch(state.query);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancelPendingWork();
    },
  };
}
