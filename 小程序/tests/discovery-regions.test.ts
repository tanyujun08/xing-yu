import { afterEach, expect, test, vi } from 'vitest';
import { loadDiscoveryRegions } from '../miniprogram/shared/api/discovery-regions';
interface Wire { url: string; header: Record<string,string>; success(r: unknown): void; fail(r: { errMsg: string }): void }
function host() { const wires: Wire[] = [], abort = vi.fn(); vi.stubGlobal('wx', { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }), request: (wire: Wire) => { wires.push(wire); return { abort }; } }); return { wires, abort }; }
function reply(w: Wire, dataset: string, items: { region_id: string; name: string; level: string }[], statusCode=200) { w.success({ statusCode, data: { dataset_id: dataset, items }, header: {}, cookies: [] }); }
const tick = async () => { for (let n=0;n<8;n++) await Promise.resolve(); };
afterEach(() => vi.unstubAllGlobals());
test('cities come from one dataset with no session token and at most four concurrent province reads', async () => { const h=host(), result=loadDiscoveryRegions(); reply(h.wires[0]!, 'dataset', Array.from({ length: 5 },(_,i)=>({region_id:'p'+i,name:'省'+i,level:'PROVINCE'}))); await tick(); expect(h.wires).toHaveLength(5); expect(h.wires.every(w=>!w.header.Authorization)).toBe(true); for(let i=1;i<=4;i++)reply(h.wires[i]!, 'dataset',[{region_id:'city'+i,name:'城市'+i,level:'CITY'}]); await tick(); expect(h.wires).toHaveLength(6); expect(h.wires[5]!.url).toContain('dataset_id=dataset&parent_id=p4'); reply(h.wires[5]!, 'dataset',[{region_id:'city5',name:'城市5',level:'CITY'}]); await expect(result.promise).resolves.toMatchObject({datasetId:'dataset',cities:expect.arrayContaining([{id:'city5',name:'城市5'}])}); });
test('the nationwide dataset loads all 34 provinces and 354 cities', async () => {
  const h = host(), result = loadDiscoveryRegions();
  reply(h.wires[0]!, 'nationwide', Array.from({ length: 34 }, (_, i) => ({ region_id: `p${i}`, name: `省${i}`, level: 'PROVINCE' })));
  await tick();
  for (let start = 0; start < 34; start += 4) {
    const count = Math.min(4, 34 - start);
    expect(h.wires).toHaveLength(1 + start + count);
    for (let offset = 0; offset < count; offset++) {
      const province = start + offset;
      expect(h.wires[1 + province]!.url).toContain(`parent_id=p${province}`);
      reply(h.wires[1 + province]!, 'nationwide', Array.from({ length: province < 14 ? 11 : 10 }, (_, city) => ({ region_id: `c${province}-${city}`, name: `城市${province}-${city}`, level: 'CITY' })));
    }
    await tick();
  }
  const loaded = await result.promise;
  expect(loaded.datasetId).toBe('nationwide');
  expect(loaded.cities).toHaveLength(354);
  expect(new Set(loaded.cities.map(city => city.id)).size).toBe(354);
});
test('a dataset mismatch rejects the whole list without static city fallback',async()=>{const h=host(),result=loadDiscoveryRegions(),assertion=expect(result.promise).rejects.toThrow('版本不一致');reply(h.wires[0]!, 'a',[{region_id:'p',name:'省',level:'PROVINCE'}]);await tick();reply(h.wires[1]!, 'b',[{region_id:'c',name:'市',level:'CITY'}]);await assertion;});
test('canceling active province reads rejects late results and starts no new requests',async()=>{const h=host(),result=loadDiscoveryRegions(),assertion=expect(result.promise).rejects.toBeInstanceOf(Error);reply(h.wires[0]!, 'a',[{region_id:'p',name:'省',level:'PROVINCE'}]);await tick();result.abort();expect(h.abort).toHaveBeenCalled();reply(h.wires[1]!, 'a',[{region_id:'c',name:'市',level:'CITY'}]);await assertion;expect(h.wires).toHaveLength(2);});
test('foreign levels and duplicate city identities are rejected',async()=>{const h=host(),result=loadDiscoveryRegions(),assertion=expect(result.promise).rejects.toThrow('城市数据重复');reply(h.wires[0]!, 'a',[{region_id:'p',name:'省',level:'PROVINCE'}]);await tick();reply(h.wires[1]!, 'a',[{region_id:'c',name:'市1',level:'CITY'},{region_id:'c',name:'市2',level:'CITY'}]);await assertion;});
