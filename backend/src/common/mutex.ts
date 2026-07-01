export class AsyncMutex {
  private mutex: Promise<void> = Promise.resolve();

  lock(): Promise<() => void> {
    let nextLock: () => void;
    
    const nextMutex = new Promise<void>((resolve) => {
      nextLock = resolve;
    });

    const currentMutex = this.mutex;
    this.mutex = nextMutex;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return currentMutex.then(() => nextLock!);
  }

  async runExclusive<T>(callback: () => Promise<T> | T): Promise<T> {
    const unlock = await this.lock();
    try {
      return await callback();
    } finally {
      unlock();
    }
  }
}

// Global locks dictionary for file paths
const fileLocks = new Map<string, AsyncMutex>();

export function getFileLock(filePath: string): AsyncMutex {
  if (!fileLocks.has(filePath)) {
    fileLocks.set(filePath, new AsyncMutex());
  }
  return fileLocks.get(filePath)!;
}
