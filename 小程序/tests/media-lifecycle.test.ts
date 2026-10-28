import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createOperationScope } from '../miniprogram/shared/interaction/operation-scope';
import { chooseAndSaveMedia } from '../miniprogram/shared/media/local-media';

interface ChooseMediaCallbacks {
  success(result: { tempFiles: Array<{ tempFilePath: string }> }): void;
  fail(error: { errMsg: string }): void;
}

interface SaveFileCallbacks {
  tempFilePath: string;
  success(result: { savedFilePath: string }): void;
  fail?(error: { errMsg: string }): void;
}

interface RemoveSavedFileCallbacks {
  filePath: string;
  success?(): void;
  fail?(error: { errMsg: string }): void;
}

describe('local media lifecycle boundary', () => {
  const previousWx = (globalThis as typeof globalThis & { wx?: WechatMiniprogram.Wx }).wx;
  const selections: ChooseMediaCallbacks[] = [];
  const saveFile = vi.fn((options: SaveFileCallbacks) => {
    options.success({ savedFilePath: `wxfile://saved/${options.tempFilePath.split('/').pop()}` });
  });
  const removeSavedFile = vi.fn((options: RemoveSavedFileCallbacks) => { options.success?.(); });

  async function flushOperationStart(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    selections.length = 0;
    saveFile.mockClear();
    removeSavedFile.mockClear();
    (globalThis as typeof globalThis & { wx: WechatMiniprogram.Wx }).wx = {
      chooseMedia: (options: unknown) => { selections.push(options as ChooseMediaCallbacks); },
      getFileSystemManager: () => ({ saveFile, removeSavedFile }),
    } as unknown as WechatMiniprogram.Wx;
  });

  afterEach(() => {
    const globalWithWx = globalThis as typeof globalThis & { wx?: WechatMiniprogram.Wx };
    if (previousWx) globalWithWx.wx = previousWx;
    else delete globalWithWx.wx;
  });

  test('records only the latest selection when two chooser results complete in reverse order', async () => {
    const scope = createOperationScope();
    const first = scope.latest('avatar', (isCurrent) => chooseAndSaveMedia('image', 1, ['album'], isCurrent));
    await flushOperationStart();
    const second = scope.latest('avatar', (isCurrent) => chooseAndSaveMedia('image', 1, ['camera'], isCurrent));
    await flushOperationStart();
    expect(selections).toHaveLength(2);

    selections[1]!.success({ tempFiles: [{ tempFilePath: 'tmp/new-avatar.jpg' }] });
    await expect(second).resolves.toEqual({ accepted: true, value: ['wxfile://saved/new-avatar.jpg'] });
    selections[0]!.success({ tempFiles: [{ tempFilePath: 'tmp/old-avatar.jpg' }] });
    await expect(first).resolves.toEqual({ accepted: false });

    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(removeSavedFile).not.toHaveBeenCalled();
  });

  test('does not save a file after the owning scope is disposed', async () => {
    const scope = createOperationScope();
    const selection = scope.latest('charge-photo', (isCurrent) => chooseAndSaveMedia('image', 1, ['camera'], isCurrent));
    await flushOperationStart();
    expect(selections).toHaveLength(1);

    scope.dispose();
    selections[0]!.success({ tempFiles: [{ tempFilePath: 'tmp/late-photo.jpg' }] });
    await expect(selection).resolves.toEqual({ accepted: false });
    expect(saveFile).not.toHaveBeenCalled();
  });

  test('removes only an in-flight saved path when success arrives after unload and ignores cleanup failure', async () => {
    const scope = createOperationScope();
    let pendingSave: SaveFileCallbacks | null = null;
    saveFile.mockImplementationOnce((options) => { pendingSave = options; });
    removeSavedFile.mockImplementationOnce((options) => {
      options.fail?.({ errMsg: 'removeSavedFile:fail cleanup denied' });
    });

    const selection = scope.latest('charge-photo', (isCurrent) => chooseAndSaveMedia('image', 1, ['camera'], isCurrent));
    await flushOperationStart();
    selections[0]!.success({ tempFiles: [{ tempFilePath: 'tmp/in-flight-photo.jpg' }] });
    await flushOperationStart();
    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(pendingSave).not.toBeNull();

    scope.dispose();
    pendingSave!.success({ savedFilePath: 'wxfile://saved/in-flight-photo.jpg' });

    await expect(selection).resolves.toEqual({ accepted: false });
    expect(removeSavedFile).toHaveBeenCalledTimes(1);
    expect(removeSavedFile).toHaveBeenCalledWith(expect.objectContaining({ filePath: 'wxfile://saved/in-flight-photo.jpg' }));
  });
});
