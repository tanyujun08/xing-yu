import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { publicationApi } from '../miniprogram/shared/api/publication-api';
import { PUBLIC_MATERIAL_ORIGIN as origin } from '../miniprogram/shared/presentation/material-media';
import { applyDraftChanges, bindCatalogProduct, bindPublicationLocation, publicationDraftView, type PublicationLocationInput } from '../miniprogram/shared/presentation/api-publication-draft';

interface Wire {
 url: string; method: string; data?: unknown; header: Record<string,string>;
 success(response: unknown): void; fail(error: {errMsg:string}): void;
}
const wires: Wire[] = [];
const abort = vi.fn();
beforeEach(() => {
 wires.length=0; abort.mockClear();
 vi.stubGlobal('wx', {
  getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),
  getStorageSync:()=>({accountId:'owner-a',accessToken:'token-owner-a',refreshToken:'refresh',expiresAt:Date.now()+60000}),
  removeStorageSync:()=>undefined,
  request:(wire:Wire)=>{wires.push(wire); return {abort}},
 });
});
afterEach(()=>vi.unstubAllGlobals());
function reply(wire:Wire, body:unknown, status=200) {wire.success({statusCode:status,data:body,header:{},cookies:[]});}

const media = { material_id:'material-cover', role:'COVER', mime_type:'image/png', size_bytes:2048, sort_order:0, url:origin+'/catalog-cover.png', metadata:null, poster:null };
const product = {
 product_id:'product-1', name:'合成相机', model:'X-T5', description:'合成说明', brand_id:'brand-1', brand_name:'合成品牌',
 category_id:'category-1', category_name:'微单相机', tags:['摄影'], media:[media], updated_at:'2026-09-17T04:00:00Z',
};

test('type options use an authenticated category-only read and reject malformed categories',async()=>{
 const handle=publicationApi.catalogCategories();
 expect(wires[0]!.url.replace(/^https?:\/\/[^/]+/,'')).toBe('/v1/me/catalog/categories');
 expect(wires[0]!.header.Authorization).toBe('Bearer token-owner-a');
 reply(wires[0]!,{items:[{category_id:'category-1',name:'微单相机'}]});
 expect((await handle.promise).items).toEqual([{category_id:'category-1',name:'微单相机'}]);
 const duplicate=publicationApi.catalogCategories();
 reply(wires[1]!,{items:[{category_id:'category-1',name:'相机'},{category_id:'category-1',name:'镜头'}]});
 await expect(duplicate.promise).rejects.toThrow('设备类型列表无效');
});

test('catalog list builds an authenticated GET with exact filters and validates the projection', async()=>{
 const handle=publicationApi.catalogProducts({query:'相机',brandId:'brand-1',categoryId:'category-1',pageSize:50});
 expect(wires).toHaveLength(1);
 expect(wires[0]!.method).toBe('GET');
 expect(wires[0]!.url.replace(/^https?:\/\/[^/]+/,'')).toBe('/v1/me/catalog/products?query=%E7%9B%B8%E6%9C%BA&brand_id=brand-1&category_id=category-1&page_size=50');
 expect(wires[0]!.header.Authorization).toBe('Bearer token-owner-a');
 expect(wires[0]!.data).toBeUndefined();
 reply(wires[0]!,{items:[product],page:{page_size:50,has_more:false}});
 const page=await handle.promise;
 expect(page.items[0]?.product_id).toBe('product-1');
 expect(page.items[0]?.media[0]?.url).toBe(media.url);
});

test('insecure or non-permanent media URL is rejected', async()=>{
 const bad=publicationApi.catalogProducts();
 reply(wires[0]!,{items:[{...product,media:[{...media,url:'http://insecure.example/cover'}]}],page:{page_size:20,has_more:false}});
 await expect(bad.promise).rejects.toThrow('商品列表无效');

 const worse=publicationApi.catalogProducts();
 reply(wires[1]!,{items:[{...product,media:[{...media,url:media.url+'?signature=x'}]}],page:{page_size:20,has_more:false}});
 await expect(worse.promise).rejects.toThrow('商品列表无效');
});

test('a detail read of an archived or unknown product stays a problem and never fabricates a product', async()=>{
 const handle=publicationApi.catalogProduct('product-1');
 expect(wires[0]!.url.replace(/^https?:\/\/[^/]+/,'')).toBe('/v1/me/catalog/products/product-1');
 reply(wires[0]!,{code:'RESOURCE_NOT_FOUND',message:'资源不存在',request_id:'catalog-read'},404);
 await expect(handle.promise).rejects.toMatchObject({statusCode:404,code:'RESOURCE_NOT_FOUND'});
});

test('binding a catalog product writes exactly product_id and an empty selection removes it', ()=>{
 const base=applyDraftChanges({display_name:'旧名称'},{displayName:'新名称'},false);
 const bound=bindCatalogProduct(base,'product-1');
 expect(bound).toEqual({display_name:'新名称',product_id:'product-1'});
 expect(bindCatalogProduct(bound,'')).toEqual({display_name:'新名称'});
 expect(()=>bindCatalogProduct(base,'产品 1')).toThrow('商品标识无效');
 expect(publicationDraftView({draft_id:'draft-1',version:'9',origin_kind:'CREATE',status:'EDITING',asset:{product_id:'product-1',display_name:'相机'}}).productId).toBe('product-1');
 expect(publicationDraftView({draft_id:'draft-1',version:'9',origin_kind:'CREATE',status:'EDITING',asset:{display_name:'相机'}}).productId).toBe('');
});

test('a WeChat address binds to a personal draft without inventing map coordinates', ()=>{
 const location={dataset_id:'regions-1',province_id:'province-1',city_id:'city-1',district_id:'district-1',detail_address:'科技园1号',recipient_name:'测试用户',phone_country_code:'+86',phone:'13800000000'};
 const asset=bindPublicationLocation({} as {publication_location?:PublicationLocationInput},location);
 expect(asset).toEqual({publication_location:location});
 expect(asset.publication_location).not.toHaveProperty('location');
 const draft=publicationApi.validateDraft({draft_id:'draft-address',status:'EDITING',version:'1',origin_kind:'CREATE',base_version:null,asset},'draft-address');
 expect(draft.asset.publication_location).toEqual(location);
});
