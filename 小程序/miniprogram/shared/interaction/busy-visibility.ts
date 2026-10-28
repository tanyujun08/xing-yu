export interface BusyVisibilityOptions {
  delayMs?: number;
  minVisibleMs?: number;
  now?: () => number;
}

export interface BusyVisibility {
  readonly visible: boolean;
  begin(): () => void;
  track<T>(promise: Promise<T>): Promise<T>;
  dispose(): void;
}

class BusyVisibilityController implements BusyVisibility {
  private readonly delayMs: number;
  private readonly minVisibleMs: number;
  private readonly now: () => number;
  private activeCount = 0;
  private visibleValue = false;
  private visibleSince = 0;
  private showTimer: ReturnType<typeof setTimeout> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;

  constructor(private readonly onChange: (visible: boolean) => void, options: BusyVisibilityOptions) {
    this.delayMs = options.delayMs ?? 100;
    this.minVisibleMs = options.minVisibleMs ?? 200;
    this.now = options.now ?? Date.now;
  }

  get visible(): boolean {
    return this.visibleValue;
  }

  begin(): () => void {
    if (this.disposed) return () => undefined;
    this.activeCount += 1;
    if (this.activeCount === 1) this.scheduleShow();
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      this.activeCount = Math.max(0, this.activeCount - 1);
      if (this.activeCount === 0) this.scheduleHide();
    };
  }

  track<T>(promise: Promise<T>): Promise<T> {
    const end = this.begin();
    void promise.then(end, end);
    return promise;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.activeCount = 0;
    if (this.showTimer !== undefined) clearTimeout(this.showTimer);
    if (this.hideTimer !== undefined) clearTimeout(this.hideTimer);
    this.showTimer = undefined;
    this.hideTimer = undefined;
    if (this.visibleValue) {
      this.visibleValue = false;
      this.onChange(false);
    }
  }

  private scheduleShow(): void {
    if (this.hideTimer !== undefined) clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.visibleValue || this.showTimer !== undefined) return;
    this.showTimer = setTimeout(() => {
      this.showTimer = undefined;
      if (this.disposed || this.activeCount === 0) return;
      this.visibleValue = true;
      this.visibleSince = this.now();
      this.onChange(true);
    }, this.delayMs);
  }

  private scheduleHide(): void {
    if (this.showTimer !== undefined) clearTimeout(this.showTimer);
    this.showTimer = undefined;
    if (!this.visibleValue) return;
    const remaining = Math.max(0, this.minVisibleMs - (this.now() - this.visibleSince));
    if (this.hideTimer !== undefined) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      if (this.disposed || this.activeCount > 0 || !this.visibleValue) return;
      this.visibleValue = false;
      this.onChange(false);
    }, remaining);
  }
}

export function createBusyVisibility(
  onChange: (visible: boolean) => void,
  options: BusyVisibilityOptions = {},
): BusyVisibility {
  return new BusyVisibilityController(onChange, options);
}
