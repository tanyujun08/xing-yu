import {afterAll,afterEach,beforeAll,beforeEach,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
const api=vi.hoisted(()=>({owner:'account-a' as string|null,profile:vi.fn(),summary:vi.fn(),coupons:vi.fn(),identity:vi.fn(),logout:vi.fn(),material:vi.fn()}));
vi.mock('../miniprogram/shared/api/account-api',()=>({accountApi:{sessionIdentity:()=>api.owner,profile:api.profile,identity:api.identity,logout:api.logout,material:api.material,newIntent:()=> 'intent',avatar:vi.fn()},benefitApi:{summary:api.summary},couponApi:{list:api.coupons}}));
interface Harness{data:Record<string,unknown>;setData(p:Record<string,unknown>):void;[key:string]:unknown}
let definition:Harness;let current:Harness;const navigateTo=vi.fn();const showModal=vi.fn();
beforeAll(async()=>{vi.stubGlobal('Page',(p:Harness)=>{definition=p});await import('../miniprogram/pages/profile/index')});
beforeEach(()=>{api.owner='account-a';api.material.mockReset();api.profile.mockReset().mockImplementation(()=>({promise:Promise.resolve({account_id:api.owner,display_name:'真实昵称'})}));api.summary.mockReset().mockImplementation(()=>({promise:Promise.resolve({profile:{account_id:api.owner,available_pink_units:'9007199254740993',level_code:null},entitlements:[]})}));api.coupons.mockReset().mockReturnValue({promise:Promise.resolve({items:[],page:{next_cursor:null}})});api.identity.mockReset().mockReturnValue({promise:Promise.resolve({overall_status:'NOT_VERIFIED',real_name:{status:'NOT_VERIFIED'},face:{status:'NOT_VERIFIED'}})});api.logout.mockReset().mockImplementation(async()=>{api.owner=null});navigateTo.mockReset();showModal.mockReset();vi.stubGlobal('wx',{navigateTo,showModal,showToast:vi.fn(),switchTab:vi.fn()});current={...definition,data:structuredClone(definition.data),getTabBar:()=>undefined,setData(p){for(const[key,value]of Object.entries(p)){if(key==='localProfile.avatarPath')(this.data.localProfile as {name:string;avatarPath:string}).avatarPath=String(value);else this.data[key]=value}}}});
afterEach(()=>call('onUnload'));afterAll(()=>vi.unstubAllGlobals());
function call(name:string,...args:unknown[]){return(current[name]as(...args:unknown[])=>unknown).apply(current,args)}
function asset(){return(current.data.assetItems as {label:string;value:string;route:string}[])[3]!}
test('projects only API account and current coupon page, marking truncated count honestly',async()=>{api.coupons.mockReturnValueOnce({promise:Promise.resolve({items:Array.from({length:20},()=>({account_id:'account-a',status:'AVAILABLE'})),page:{next_cursor:'next'}})});await call('onShow');expect(asset().value).toBe('20+ 张');expect(current.data.localProfile).toMatchObject({name:'真实昵称'});expect((current.data.assetItems as {value:string}[])[0]?.value).toBe('9007199254740993');expect(current.data.memberLevel).toBe('尚未评定');await call('onShow');expect(asset().value).toBe('0 张')});
test('guest clears old private data without any API query',async()=>{await call('onShow');api.owner=null;api.coupons.mockClear();await call('onShow');expect(api.coupons).not.toHaveBeenCalled();expect(asset().value).toBe('请登录');expect(current.data.localProfile).toEqual({name:'',avatarPath:''})});
test('API failure leaves unavailable count rather than mock or zero',async()=>{api.coupons.mockReturnValue({promise:Promise.reject(new Error('down'))});await call('onShow');expect(asset().value).toBe('—');expect(current.data.errorText).toBeTruthy()});
test('confirmed logout clears only after server success; cancel preserves state',async()=>{await call('onShow');call('logout');const modal=showModal.mock.calls[0]![0]as{success:(r:{confirm:boolean})=>void};modal.success({confirm:false});expect(api.logout).not.toHaveBeenCalled();modal.success({confirm:true});await vi.waitFor(()=>expect(current.data.loggedIn).toBe(false));expect(api.logout).toHaveBeenCalledWith('intent');expect(asset().value).toBe('请登录')});
test('guide/about are public and real coupon route requires login',async()=>{api.owner=null;await call('onShow');for(const route of ['/pages/info-guide/index','/pages/about/index']){call('openItem',{currentTarget:{dataset:{route}}});expect(navigateTo).toHaveBeenLastCalledWith(expect.objectContaining({url:route}));const callbacks=navigateTo.mock.calls[navigateTo.mock.calls.length - 1]![0]as{complete:()=>void};callbacks.complete()}navigateTo.mockClear();call('openItem',{currentTarget:{dataset:{route:'/pages/coupons/index'}}});expect(navigateTo).not.toHaveBeenCalled();expect(showModal).toHaveBeenCalled()});
test('late previous-account response never paints new account',async()=>{let finish!:(value:unknown)=>void;api.profile.mockReturnValueOnce({promise:new Promise(r=>{finish=r})});const pending=call('onShow');api.owner='account-b';finish({account_id:'account-a',display_name:'secret'});await pending;expect(current.data.localProfile).toEqual({name:'',avatarPath:''})});

test('current real avatar retries the same URL without profile reads or navigation',async()=>{
 const source='https://xyuprj.oss-cn-hangzhou.aliyuncs.com/profile-avatar';
 api.profile.mockReturnValueOnce({promise:Promise.resolve({account_id:'account-a',display_name:'真实昵称',avatar_material_id:'avatar-owned'})});
 api.material.mockReturnValueOnce({abort:vi.fn(),promise:Promise.resolve({material_id:'avatar-owned',owner_account_id:'account-a',scope_type:'ACCOUNT',scope_id:'account-a',material_class:'PROFILE_IMAGE',status:'READY',public_url:source,playback_url:null,mime_type:'image/png',size_bytes:100,metadata:null,poster:null})});
 const ticks:Array<()=>void>=[];vi.stubGlobal('wx',{...wx,nextTick:(callback:()=>void)=>ticks.push(callback)});
 await call('onShow');const event={currentTarget:{dataset:{src:source,owner:'account-a',epoch:current.data.avatarEpoch}}};
 call('onAvatarImageError',{currentTarget:{dataset:{...event.currentTarget.dataset,src:source+'-old'}}});expect(current.data.avatarFailed).toBe(false);
 call('onAvatarImageError',event);expect(current.data.avatarFailed).toBe(true);call('retryAvatarImage',event);call('retryAvatarImage',event);
 expect(ticks).toHaveLength(1);expect(current.data.avatarReloading).toBe(true);ticks.shift()!();
 expect(current.data).toMatchObject({avatarFailed:false,avatarReloading:false,localProfile:{name:'真实昵称',avatarPath:source}});
 expect(api.profile).toHaveBeenCalledTimes(1);expect(api.material).toHaveBeenCalledTimes(1);expect(api.material).toHaveBeenCalledWith('avatar-owned');expect(navigateTo).not.toHaveBeenCalled();
 const markup=readFileSync(new URL('../miniprogram/pages/profile/index.wxml',import.meta.url),'utf8');
 expect(markup).toContain('bindtap="openProfileEdit"');expect(markup).toContain('class="avatar" src="{{localProfile.avatarPath || icons.profileAvatarDefault}}"');
 expect(markup).toContain('    </view>\n    <button wx:if="{{loggedIn && avatarFailed}}"');
 const style=readFileSync(new URL('../miniprogram/pages/profile/index.wxss',import.meta.url),'utf8');expect(style).toMatch(/\.avatar\s*\{[^}]*width:\s*52px;[^}]*height:\s*52px;[^}]*border-radius:\s*var\(--xy-radius-circle\)/u);
});
test('old avatar failure and queued retry cannot paint a changed owner or hidden page',async()=>{
 await call('onShow');const source='https://xyuprj.oss-cn-hangzhou.aliyuncs.com/profile-avatar';
 current.setData({localProfile:{name:'原昵称',avatarPath:source}});const epoch=current.data.avatarEpoch;
 const event={currentTarget:{dataset:{src:source,owner:'account-a',epoch}}};const ticks:Array<()=>void>=[];vi.stubGlobal('wx',{...wx,nextTick:(callback:()=>void)=>ticks.push(callback)});
 call('onAvatarImageError',event);call('retryAvatarImage',event);call('onHide');api.owner='account-b';await call('onShow');const before=structuredClone(current.data);ticks.shift()!();call('onAvatarImageError',event);
 expect(current.data).toEqual(before);expect(current.data).toMatchObject({avatarFailed:false,avatarReloading:false,localProfile:{avatarPath:''}});expect(navigateTo).not.toHaveBeenCalled();
});
