export interface FlushableDebounce<TArgs extends readonly unknown[]> {
  readonly pending: boolean;
  schedule(...args: TArgs): void;
  flush(): void;
  cancel(): void;
}

class TrailingDebounce<TArgs extends readonly unknown[]> implements FlushableDebounce<TArgs> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private args: TArgs | undefined;

  constructor(private readonly callback: (...args: TArgs) => void, private readonly delayMs: number) {}

  get pending(): boolean {
    return this.args !== undefined;
  }

  schedule(...args: TArgs): void {
    this.args = args;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const args = this.args;
    this.args = undefined;
    if (args !== undefined) this.callback(...args);
  }

  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.args = undefined;
  }
}

export function createFlushableDebounce<TArgs extends readonly unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs = 350,
): FlushableDebounce<TArgs> {
  return new TrailingDebounce(callback, delayMs);
}
