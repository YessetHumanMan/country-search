export type Debounced<Args extends unknown[]> = ((...args: Args) => void) & {
  cancel: () => void;
};

/** Откладывает вызов до окончания паузы; использует последние аргументы. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const debounced: Debounced<Args> = (...args) => {
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delay);
  };

  debounced.cancel = cancel;
  return debounced;
}
