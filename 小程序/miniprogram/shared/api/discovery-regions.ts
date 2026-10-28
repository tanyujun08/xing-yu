import { regionApi } from './account-api';
import type { RequestHandle } from './request';
export type DiscoveryRegion = { id: string; name: string };
export function loadDiscoveryRegions(): RequestHandle<{ datasetId: string; cities: DiscoveryRegion[] }> {
  let canceled = false; const active = new Set<{ abort: () => void }>();
  async function read(dataset?: string, parent?: string) { if (canceled) throw new Error('城市读取已取消'); const handle = regionApi.children(dataset, parent); active.add(handle); try { const value = await handle.promise; if (canceled) throw new Error('城市读取已取消'); if (!value.dataset_id || (dataset && value.dataset_id !== dataset) || !Array.isArray(value.items) || value.items.some(item => !item.region_id || !item.name)) throw new Error('城市数据版本不一致，请重新读取。'); return value; } finally { active.delete(handle); } }
  const promise = (async () => {
    const root = await read(); if (root.items.length > 50 || root.items.some(item => item.level !== 'PROVINCE')) throw new Error('省级地区数据不完整。');
    const cities: DiscoveryRegion[] = [];
    for (let start = 0; start < root.items.length; start += 4) {
      const groups = await Promise.all(root.items.slice(start, start + 4).map(item => read(root.dataset_id, item.region_id)));
      for (const group of groups) { if (group.items.some(item => item.level !== 'CITY')) throw new Error('城市级别不一致。'); cities.push(...group.items.map(item => ({ id: item.region_id, name: item.name }))); }
    }
    if (new Set(cities.map(item => item.id)).size !== cities.length) throw new Error('城市数据重复，请重新读取。');
    return { datasetId: root.dataset_id, cities };
  })();
  return { promise, abort: () => { canceled = true; active.forEach(handle => handle.abort()); } };
}