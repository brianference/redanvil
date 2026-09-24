/**
 * Bounded async pool. Callers that used to `await` inside a `for` loop (or
 * hide a blocking `spawnSync` under `Promise.all`) use this so work actually
 * overlaps, while results stay aligned to input order.
 */

/**
 * Run `worker` over `items` with at most `limit` calls in flight.
 *
 * Completion order does not matter: result index `i` is `items[i]`. When
 * `shouldStop` returns true, no further items are started. Slots that never
 * started stay `undefined`. Already-started workers run to completion.
 *
 * @param items - Work items.
 * @param limit - Maximum concurrent workers. Must be >= 1 when `items` is non-empty.
 * @param worker - Async work for one item.
 * @param shouldStop - Optional gate checked before starting the next item.
 * @returns Results aligned to `items`. Unstarted slots are `undefined`.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  shouldStop?: () => boolean
): Promise<Array<R | undefined>> {
  const results: Array<R | undefined> = new Array(items.length);
  if (items.length === 0) return results;
  if (limit < 1) {
    throw new Error(`mapPool limit must be >= 1, got ${limit}`);
  }

  let next = 0;
  let failed: unknown = null;

  /**
   * Pull indexes until the list is exhausted or `shouldStop` flips.
   */
  const runWorker = async (): Promise<void> => {
    while (failed === null) {
      if (shouldStop?.() === true) return;
      const index = next;
      next += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index] as T, index);
      } catch (err) {
        failed = err;
        throw err;
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}
