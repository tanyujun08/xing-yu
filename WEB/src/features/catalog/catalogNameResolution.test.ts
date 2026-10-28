import { expect, test, vi } from 'vitest';
import { resolveCatalogName } from './catalogNameResolution';

const sony = { id: 'brand-1', name: '索尼', parentId: null };

test('text matching reuses the exact normalized directory identity without a write', async () => {
  const create = vi.fn(); const reload = vi.fn();
  await expect(resolveCatalogName('  索尼  ', [sony], create, reload)).resolves.toEqual(sony);
  expect(create).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});

test('new text creates a real directory entry, and concurrent same-name creation is read back', async () => {
  const create = vi.fn().mockResolvedValueOnce(sony);
  await expect(resolveCatalogName('索尼', [], create, vi.fn())).resolves.toEqual(sony);
  expect(create).toHaveBeenCalledWith('索尼');
  await expect(resolveCatalogName('索尼', [], vi.fn().mockRejectedValue(new Error('409')), vi.fn().mockResolvedValue([sony]))).resolves.toEqual(sony);
});

test('ambiguous, invalid or unavailable directory names fail closed', async () => {
  const reload = vi.fn().mockResolvedValue([]);
  await expect(resolveCatalogName('索尼', [sony, { ...sony, id: 'brand-2' }], vi.fn(), reload)).rejects.toThrow('多个同名');
  await expect(resolveCatalogName('  ', [], vi.fn(), reload)).rejects.toThrow('1～80');
  await expect(resolveCatalogName('新品牌', [], undefined, reload)).rejects.toThrow('不支持新建目录');
  await expect(resolveCatalogName('新品牌', [], vi.fn().mockRejectedValue(new Error('403')), reload)).rejects.toThrow('403');
});
