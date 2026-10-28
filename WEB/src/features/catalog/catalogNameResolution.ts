import type { CatalogDirectoryOption } from '../../shared/services/contracts';

const normalized = (name: string) => name.normalize('NFC').trim();

function exactMatch(name: string, options: readonly CatalogDirectoryOption[]): CatalogDirectoryOption | null {
  const matches = options.filter((entry) => normalized(entry.name) === name);
  if (matches.length > 1) throw new Error(`目录中有多个同名“${name}”，请先整理目录后再保存商品`);
  return matches[0] ?? null;
}

export async function resolveCatalogName(
  rawName: string,
  options: readonly CatalogDirectoryOption[],
  create: ((name: string) => Promise<CatalogDirectoryOption>) | undefined,
  reload: () => Promise<readonly CatalogDirectoryOption[]>,
): Promise<CatalogDirectoryOption> {
  const name = normalized(rawName);
  if (name.length < 1 || name.length > 80) throw new Error('品牌或分类名称须为 1～80 字');
  const existing = exactMatch(name, options);
  if (existing) return existing;
  if (!create) throw new Error('当前网关不支持新建目录，请先选择已有品牌或分类');
  try {
    return await create(name);
  } catch (error) {
    // A concurrent request may have created the same name before this POST.
    const concurrentlyCreated = exactMatch(name, await reload());
    if (concurrentlyCreated) return concurrentlyCreated;
    throw error;
  }
}
