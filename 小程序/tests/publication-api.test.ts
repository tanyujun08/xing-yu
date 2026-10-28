import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { publicationApi, type AssetDraftInput } from '../miniprogram/shared/api/publication-api';

interface Wire {
 url: string; method: string; data?: unknown; header: Record<string,string>;
 success(response: unknown): void; fail(error: {errMsg:string}): void;
}
const wires: Wire[] = [];
const abort = vi.fn();
let owner: string | null;
beforeEach(() => {
 owner='owner-a'; wires.length=0; abort.mockClear();
 vi.stubGlobal('wx', {
  getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),
  getStorageSync:()=>owner?{accountId:owner,accessToken:'token-'+owner,refreshToken:'refresh',expiresAt:Date.now()+60000}:null,
  removeStorageSync:()=>{owner=null},
  request:(wire:Wire)=>{wires.push(wire); return {abort}},
 });
});
afterEach(()=>vi.unstubAllGlobals());
function reply(wire:Wire, body:unknown, status=200) {wire.success({statusCode:status,data:body,header:{},cookies:[]});}
const asset:AssetDraftInput={display_name:'相机',deposit_fen:'9007199254740993',rental_unit:'DAY',unit_price_fen:'105',description:'原始说明',delivery_options:[],media:[]};
test('five existing preparation operations use native GET/POST, exact guards and body projections', async()=>{
 const handles=[
  publicationApi.draft('draft:original'),
  publicationApi.createDraft(asset,'create-original'),
  publicationApi.editDraft('asset:original','9007199254740993','edit-original'),
  publicationApi.updateDraft('draft:original','18446744073709551615',asset,'update-original'),
  publicationApi.submitDraft('draft:original','10','submit-original'),
 ];
 expect(wires.map(w=>[w.method,w.url.replace(/^https?:\/\/[^/]+/,'')])).toEqual([
  ['GET','/v1/me/asset-drafts/draft%3Aoriginal'],
  ['POST','/v1/me/asset-drafts'],
  ['POST','/v1/me/assets/asset%3Aoriginal/drafts'],
  ['POST','/v1/me/asset-drafts/draft%3Aoriginal/updates'],
  ['POST','/v1/me/asset-drafts/draft%3Aoriginal/submissions'],
 ]);
 expect(wires[0]?.header['If-Match']).toBeUndefined();
 expect(wires[1]?.data).toEqual({asset});expect(wires[1]?.header['Idempotency-Key']).toBe('create-original');
 expect(wires[2]?.header['If-Match']).toBe('"v9007199254740993"');expect(wires[2]?.data).toEqual({});
 expect(wires[3]?.header['If-Match']).toBe('"v18446744073709551615"');expect(wires[3]?.data).toEqual({asset});
 expect(wires[4]?.header['If-Match']).toBe('"v10"');expect(wires[4]?.data).toEqual({});
 for(const w of wires){expect(w.header.Authorization).toBe('Bearer token-owner-a');expect(w.header['X-Request-ID']).toBeTruthy();expect(w.url).not.toContain('account_id');reply(w,{kind:'DRAFT',status:'EDITING',id:'draft',version:'10'});}
 await Promise.all(handles.map(h=>h.promise));
});
test('edit creation returns its real EDITING preparation receipt without inventing submission', async()=>{
 const handle=publicationApi.editDraft('asset','9','edit-original');
 const receipt={kind:'DRAFT',status:'EDITING',id:'new-draft',version:'1',asset_version:'9'};
 reply(wires[0]!,receipt,201);expect(await handle.promise).toEqual(receipt);
 expect((await handle.promise) as object).not.toHaveProperty('revision_id');
});
test.each([409,412,422,503])('status %i stays a problem and never auto-retries the mutation',async status=>{
 const handle=publicationApi.updateDraft('draft','9',asset,'stable-intent');
 reply(wires[0]!,{code:'DRAFT_REJECTED',message:'需重新核对',request_id:'draft-problem'},status);
 await expect(handle.promise).rejects.toMatchObject({statusCode:status,code:'DRAFT_REJECTED'});
 expect(wires).toHaveLength(1);
});
test('timeout preserves unknown outcome; only explicit caller retry can resend original intent and exact body',async()=>{
 const first=publicationApi.updateDraft('draft','9',asset,'stable-intent');wires[0]!.fail({errMsg:'request:fail timeout'});
 await expect(first.promise).rejects.toMatchObject({statusCode:0,code:'REQUEST_TIMEOUT'});expect(wires).toHaveLength(1);
 const next=publicationApi.updateDraft('draft','9',asset,'stable-intent');
 expect(wires[1]?.header['Idempotency-Key']).toBe(wires[0]?.header['Idempotency-Key']);
 expect(wires[1]?.header['If-Match']).toBe(wires[0]?.header['If-Match']);expect(wires[1]?.data).toEqual(wires[0]?.data);
 reply(wires[1]!,{kind:'DRAFT',status:'EDITING',id:'draft',version:'10'});await next.promise;
});
test('401 clears only current session and rejects without Mock recovery',async()=>{
 const handle=publicationApi.draft('draft');reply(wires[0]!,{code:'TOKEN_EXPIRED',message:'登录失效',request_id:'draft-401'},401);
 await expect(handle.promise).rejects.toMatchObject({statusCode:401});expect(owner).toBeNull();expect(wires).toHaveLength(1);
});
test('account switch and cancellation discard late read or write results',async()=>{
 const old=publicationApi.createDraft(asset,'intent-old');owner='owner-b';reply(wires[0]!,{kind:'DRAFT',status:'EDITING',id:'other'});
 await expect(old.promise).rejects.toMatchObject({code:'SESSION_CHANGED'});
 const cancelled=publicationApi.draft('draft');cancelled.abort();expect(abort).toHaveBeenCalledOnce();reply(wires[1]!,{draft_id:'draft'});
 await expect(cancelled.promise).rejects.toMatchObject({code:'REQUEST_CANCELLED'});
});
test.each(['0','01','-1','1.5','18446744073709551616'])('invalid uint64 version %s cannot dispatch',version=>{
 expect(()=>publicationApi.updateDraft('draft',version,asset,'intent')).toThrow();expect(wires).toHaveLength(0);
});
test.each(['','bad path','bad\npath','x'.repeat(65)])('invalid resource id cannot dispatch',id=>{
 expect(()=>publicationApi.draft(id)).toThrow();expect(wires).toHaveLength(0);
});
