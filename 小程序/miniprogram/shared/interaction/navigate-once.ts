export interface NavigationCallbacks {
  success: () => void;
  fail: (error: unknown) => void;
  complete: () => void;
}

export type NavigationInvoker = (callbacks: NavigationCallbacks) => void;

export interface NavigateOnce {
  navigateOnce(key: string, invoke: NavigationInvoker): boolean;
  dispose(): void;
}

class NavigateOnceController implements NavigateOnce {
  private readonly locks = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(private readonly watchdogMs: number) {}

  navigateOnce(key: string, invoke: NavigationInvoker): boolean {
    const normalized = key.trim();
    if (!normalized) throw new Error('Navigation key is required');
    if (this.disposed || this.locks.has(normalized)) return false;

    const release = (attempt: ReturnType<typeof setTimeout>) => {
      if (this.locks.get(normalized) !== attempt) return;
      clearTimeout(attempt);
      this.locks.delete(normalized);
    };
    const watchdog = setTimeout(() => release(watchdog), this.watchdogMs);
    this.locks.set(normalized, watchdog);
    try {
      invoke({
        success: () => undefined,
        fail: () => release(watchdog),
        complete: () => release(watchdog),
      });
    } catch (error) {
      release(watchdog);
      throw error;
    }
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const timer of this.locks.values()) clearTimeout(timer);
    this.locks.clear();
  }
}

export function createNavigateOnce(watchdogMs = 2_000): NavigateOnce {
  return new NavigateOnceController(watchdogMs);
}

/** Both attempts belong to the same page controller, including a late failure. */
export function navigateBackWithFallback(navigation: NavigateOnce): boolean {
  return navigation.navigateOnce('secondary-back', (callbacks) => wx.navigateBack({
    ...callbacks,
    fail: (error) => {
      callbacks.fail(error);
      navigation.navigateOnce('secondary-home', (fallback) => wx.switchTab({ url: '/pages/home/index', ...fallback }));
    },
  }));
}
