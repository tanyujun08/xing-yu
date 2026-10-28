import { describe, expect, it, vi } from 'vitest';
import { CommandSingleFlight } from './commandSingleFlight';

describe('CommandSingleFlight', () => {
  it('coalesces the same entity command while allowing another entity in parallel', async () => {
    const controller = new CommandSingleFlight();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const execute = vi.fn(async () => { await gate; return 'done'; });

    const first = controller.run('asset-1', 'publish', execute);
    const duplicate = controller.run('asset-1', 'publish', execute);
    const parallel = controller.run('asset-2', 'publish', execute);
    expect(first).toBe(duplicate);
    expect(execute).toHaveBeenCalledTimes(2);
    release();
    await Promise.all([first, duplicate, parallel]);
  });

  it('reuses intent metadata after failure and releases it after success', async () => {
    const controller = new CommandSingleFlight();
    const metadata: string[] = [];
    await expect(controller.run('order-1', 'pay', async (command) => {
      metadata.push(command.intentId);
      throw new Error('network');
    })).rejects.toThrow('network');
    await controller.run('order-1', 'pay', async (command) => {
      metadata.push(command.intentId);
      return 'ok';
    });
    expect(metadata[0]).toBe(metadata[1]);
  });

  it('keeps a UUID-asset review intent within the API key limit', async () => {
    const controller = new CommandSingleFlight();
    const assetId = '9122321f-5f6a-4717-9fdf-ec20a4ce18ba';
    let key = '';
    await controller.run(assetId, 'review-APPROVE', async (command) => {
      key = command.idempotencyKey;
    });
    expect(key).toMatch(/^admin:command:[0-9a-f-]{36}$/);
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key.length).toBeLessThanOrEqual(64);
  });
});
