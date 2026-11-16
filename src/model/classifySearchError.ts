import { HttpError } from '../api/HttpError.js';

export type SearchError =
  | { kind: 'aborted'; message: null; retryable: false }
  | { kind: 'timeout'; message: string; retryable: true }
  | { kind: 'http'; status: number; message: string; retryable: true }
  | { kind: 'network'; message: string; retryable: true }
  | { kind: 'unknown'; message: string; retryable: true };

/** Классифицирует сбои поиска без DOM и побочных эффектов. 404 сюда не попадает. */
export function classifySearchError(error: unknown): SearchError {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? error.name
      : undefined;

  if (name === 'AbortError') {
    return { kind: 'aborted', message: null, retryable: false };
  }

  if (name === 'TimeoutError') {
    return {
      kind: 'timeout',
      message: 'Сервер не ответил вовремя. Попробуйте ещё раз.',
      retryable: true,
    };
  }

  if (error instanceof HttpError) {
    return {
      kind: 'http',
      status: error.status,
      message: `Ошибка сервера (HTTP ${error.status}). Попробуйте ещё раз.`,
      retryable: true,
    };
  }

  // В контексте fetch сетевой сбой приходит как TypeError.
  if (error instanceof TypeError) {
    return {
      kind: 'network',
      message:
        'Не удалось выполнить запрос. Проверьте подключение и повторите поиск.',
      retryable: true,
    };
  }

  return {
    kind: 'unknown',
    message: 'Не удалось загрузить страны. Попробуйте ещё раз.',
    retryable: true,
  };
}
