import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
 locatePublicationCreateIntent, locatePublicationSubmitIntent, locatePublicationUpdateIntent,
 preparePublicationCreateIntent, preparePublicationSubmitIntent, preparePublicationUpdateIntent,
 publicationVersion, readPublicationCreateIntent, readPublicationSubmitIntent, readPublicationUpdateIntent,
 releasePublicationCreateIntent, releasePublicationSubmitIntent, releasePublicationUpdateIntent, releaseRejectedPublicationUpdateIntent,
} from '../miniprogram/shared/session/publication-intent';

const storage=new Map<string,unknown>();
let owner:string|null;
const copy=<T>(value:T):T=>structuredClone(value);
const intentKeys=()=>[...storage.keys()].filter(key=>key.startsWith('xingyu.publication-intent.v1:'));
beforeEach(()=>{
 owner='owner-a';storage.clear();
 vi.stubGlobal('wx',{
  getStorageSync:(key:string)=>key==='xingyu.api-session.v1'?(owner?{accountId:owner,accessToken:'token-'+owner,refreshToken:'refresh',expiresAt:Date.now()+60_000}:null):storage.get(key),
  setStorageSync:(key:string,value:unknown)=>storage.set(key,copy(value)),removeStorageSync:(key:string)=>storage.delete(key),
 });
});
afterEach(()=>vi.unstubAllGlobals());

test('CREATE intent is owner-namespaced, closed-shape and persists the fixed empty asset before location',()=>{
 const intent=preparePublicationCreateIntent('owner-a');expect(intent).toMatchObject({owner:'owner-a',kind:'CREATE',stage:'PREPARED',body:{asset:{}}});expect(Object.keys(intent)).toHaveLength(5);
 expect(intent.key).toMatch(/^publication-create:/);expect(intentKeys()).toEqual(['xingyu.publication-intent.v1:owner-a:create']);expect(readPublicationCreateIntent('owner-a')).toEqual(intent);
 expect(preparePublicationCreateIntent('owner-a')).toEqual(intent);
});
test('CREATE location accepts canonical uint64 and exact release removes only the verified record',()=>{
 const original=preparePublicationCreateIntent('owner-a');const located=locatePublicationCreateIntent(original,'draft:owned','18446744073709551615');
 expect(located).toMatchObject({stage:'LOCATED',draftId:'draft:owned',version:'18446744073709551615'});expect(Object.keys(located)).toHaveLength(7);
 expect(locatePublicationCreateIntent(located,'draft:owned','18446744073709551615')).toEqual(located);releasePublicationCreateIntent(located);expect(readPublicationCreateIntent('owner-a')).toBeNull();
});
test('SUBMIT intent freezes original draft version, strict empty body and receipt location',()=>{
 const intent=preparePublicationSubmitIntent('owner-a','draft:owned','9');expect(intent).toMatchObject({owner:'owner-a',kind:'SUBMIT',stage:'PREPARED',draftId:'draft:owned',version:'9',body:{}});expect(Object.keys(intent)).toHaveLength(7);
 const located=locatePublicationSubmitIntent(intent,'10','asset:owned','revision:owned');expect(located).toMatchObject({stage:'LOCATED',resultVersion:'10',assetId:'asset:owned',revisionId:'revision:owned'});expect(Object.keys(located)).toHaveLength(10);
 expect(preparePublicationSubmitIntent('owner-a','draft:owned','9')).toEqual(located);releasePublicationSubmitIntent(located);expect(readPublicationSubmitIntent('owner-a','draft:owned')).toBeNull();
});
test('UPDATE intent durably freezes owner, draft, version, full asset body and key before POST',()=>{
 const asset={display_name:'测试相机',rental_unit:'DAY' as const,unit_price_fen:'125',deposit_fen:'60000',delivery_options:[{method:'MEET' as const}]};
 const intent=preparePublicationUpdateIntent('owner-a','draft:owned','9',asset);
 expect(intent).toMatchObject({owner:'owner-a',kind:'UPDATE',stage:'PREPARED',draftId:'draft:owned',version:'9',body:{asset}});
 expect(Object.keys(intent)).toHaveLength(7);expect(intent.key).toMatch(/^publication-update:/);
 expect(intentKeys()).toEqual(['xingyu.publication-intent.v1:owner-a:update:draft%3Aowned']);
 asset.display_name='调用方修改';expect(readPublicationUpdateIntent('owner-a','draft:owned')!.body.asset.display_name).toBe('测试相机');
 expect(()=>preparePublicationUpdateIntent('owner-a','draft:owned','9',{...asset})).toThrow('使用原内容重试');
});
test('UPDATE location is monotonic, survives rehydration and releases only after located readback',()=>{
 const prepared=preparePublicationUpdateIntent('owner-a','draft:owned','9',{display_name:'测试相机',unit_price_fen:'125'});
 expect(()=>releasePublicationUpdateIntent(prepared)).toThrow('尚未完成权威回读');
 expect(()=>locatePublicationUpdateIntent(prepared,'9')).toThrow('回执无效');expect(readPublicationUpdateIntent('owner-a','draft:owned')).toEqual(prepared);
 const located=locatePublicationUpdateIntent(prepared,'10');expect(located).toMatchObject({stage:'LOCATED',resultVersion:'10'});expect(Object.keys(located)).toHaveLength(8);
 expect(locatePublicationUpdateIntent(located,'10')).toEqual(located);releasePublicationUpdateIntent(located);expect(readPublicationUpdateIntent('owner-a','draft:owned')).toBeNull();
});
test('an explicit rejection may release only the original PREPARED UPDATE request',()=>{
 const prepared=preparePublicationUpdateIntent('owner-a','draft:owned','9',{unit_price_fen:'125'});
 releaseRejectedPublicationUpdateIntent(prepared);expect(readPublicationUpdateIntent('owner-a','draft:owned')).toBeNull();
 const next=preparePublicationUpdateIntent('owner-a','draft:owned','9',{unit_price_fen:'126'});const located=locatePublicationUpdateIntent(next,'10');
 expect(()=>releaseRejectedPublicationUpdateIntent(located)).toThrow('不能按拒绝结果清除');expect(readPublicationUpdateIntent('owner-a','draft:owned')).toEqual(located);
});
test('owner switch cannot read, overwrite or release another account intent',()=>{
 const original=preparePublicationCreateIntent('owner-a');owner='owner-b';expect(()=>readPublicationCreateIntent('owner-a')).toThrow('登录状态已变化');
 const other=preparePublicationCreateIntent('owner-b');expect(other.key).not.toBe(original.key);expect(intentKeys()).toHaveLength(2);
 expect(()=>releasePublicationCreateIntent(original)).toThrow('登录状态已变化');expect(intentKeys()).toHaveLength(2);
});
test.each(['0','01','-1','1.5','18446744073709551616'])('invalid uint64 %s fails closed before a submit record is written',version=>{
 expect(publicationVersion(version)).toBe(false);expect(()=>preparePublicationSubmitIntent('owner-a','draft',version)).toThrow();expect(intentKeys()).toHaveLength(0);
});
test('damaged or extended records fail closed and are never silently replaced',()=>{
 const original=preparePublicationCreateIntent('owner-a');const key=intentKeys()[0]!;
 storage.set(key,{...original,unexpected:true});expect(()=>readPublicationCreateIntent('owner-a')).toThrow('记录不完整');expect(()=>preparePublicationCreateIntent('owner-a')).toThrow('记录不完整');
 storage.set(key,{...original,body:{asset:{caller_rule:true}}});expect(()=>readPublicationCreateIntent('owner-a')).toThrow('记录不完整');
});
test('damaged UPDATE intent and non-JSON asset data fail closed without replacement',()=>{
 const original=preparePublicationUpdateIntent('owner-a','draft','9',{unit_price_fen:'125'});const key=intentKeys()[0]!;
 storage.set(key,{...original,unexpected:true});expect(()=>readPublicationUpdateIntent('owner-a','draft')).toThrow('记录不完整');
 storage.set(key,{...original,body:{asset:{unit_price_fen:'125',nested:{value:undefined}}}});expect(()=>readPublicationUpdateIntent('owner-a','draft')).toThrow('记录不完整');
});
test('an idempotency key above the contract maximum fails closed without replacement',()=>{
 const original=preparePublicationCreateIntent('owner-a');const key=intentKeys()[0]!;storage.set(key,{...original,key:'x'.repeat(65)});
 expect(()=>readPublicationCreateIntent('owner-a')).toThrow('记录不完整');expect(()=>preparePublicationCreateIntent('owner-a')).toThrow('记录不完整');expect(storage.get(key)).toMatchObject({key:'x'.repeat(65)});
});
test('exact release refuses a different still-valid stored request',()=>{
 const original=preparePublicationSubmitIntent('owner-a','draft','9');const key=intentKeys()[0]!;const changed={...original,key:'publication-submit:changed-key'};storage.set(key,changed);
 expect(()=>releasePublicationSubmitIntent(original)).toThrow('已变化');expect(storage.get(key)).toEqual(changed);
});
test('invalid located versions and identifiers preserve the original prepared record',()=>{
 const create=preparePublicationCreateIntent('owner-a');expect(()=>locatePublicationCreateIntent(create,'bad path','1')).toThrow();expect(readPublicationCreateIntent('owner-a')).toEqual(create);
 storage.clear();const submit=preparePublicationSubmitIntent('owner-a','draft','9');expect(()=>locatePublicationSubmitIntent(submit,'9','asset','revision')).toThrow();expect(readPublicationSubmitIntent('owner-a','draft')).toEqual(submit);
});
