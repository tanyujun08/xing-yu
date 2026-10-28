import { randomId } from '../randomId';
import { newIdempotencyKey } from '../api/idempotency';
import type { CommandMetadata } from '../services/contracts';

type Listener = () => void;

export class CommandSingleFlight {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly intents = new Map<string, CommandMetadata>();
  private readonly listeners = new Set<Listener>();

  key(entityId: string, command: string): string {
    return `${entityId}:${command}`;
  }

  isPending(entityId: string, command: string): boolean {
    return this.inFlight.has(this.key(entityId, command));
  }

  pendingKeys(): readonly string[] {
    return [...this.inFlight.keys()];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  cancelIntent(entityId: string, command: string): void {
    const key = this.key(entityId, command);
    if (this.inFlight.has(key)) return;
    this.intents.delete(key);
    this.emit();
  }

  run<T>(entityId: string, command: string, execute: (metadata: CommandMetadata) => Promise<T>): Promise<T> {
    const key = this.key(entityId, command);
    const current = this.inFlight.get(key);
    if (current !== undefined) return current as Promise<T>;

    const metadata = this.intents.get(key) ?? {
      intentId: randomId(),
      // The API accepts 16-64 bytes. Entity IDs and command names are already
      // bound by the request; the UUID supplies uniqueness without an oversized header.
      idempotencyKey: newIdempotencyKey('admin:command'),
    };
    this.intents.set(key, metadata);

    const promise = execute(metadata)
      .then((result) => {
        this.intents.delete(key);
        return result;
      })
      .finally(() => {
        this.inFlight.delete(key);
        this.emit();
      });
    this.inFlight.set(key, promise);
    this.emit();
    return promise;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
