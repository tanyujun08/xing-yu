import {afterAll,beforeAll,beforeEach,expect,test,vi} from 'vitest';
const api=vi.hoisted(()=>({owner:'account-a' as string|null,summary:vi.fn(),rule:vi.fn()}));
vi.mock('../miniprogram/shared/api/account-api',()=>({accountApi:{sessionIdentity:()=>api.owner,newIntent:()=> 'page-generation'},benefitApi:{summary:api.summary,rule:api.rule},entitlementApi:{list:()=>({abort:vi.fn(),promise:Promise.resolve({items:[],page:{next_cursor:null}})})},redemptionApi:{list:()=>({abort:vi.fn(),promise:Promise.resolve({items:[],page:{next_cursor:null}})})},readLoyaltyIntent:()=>null,queryPendingRedemptions:()=>Promise.resolve([])}));
interface PageHarness {data:Record<string,unknown>;setData(p:Record<string,unknown>):void;[key:string]:unknown}
const pages:Record<string,PageHarness>={};let name='';
beforeAll(async()=>{vi.stubGlobal('Page',(p:PageHarness)=>{pages[name]=p});name='quota';await import('../miniprogram/pages/publish-quota/index');name='deposit';await import('../miniprogram/pages/no-deposit/index');name='membership';await import('../miniprogram/pages/membership/index');name='levels';await import('../miniprogram/pages/level-rights/index');name='service';await import('../miniprogram/pages/rental-service/index');name='mall';await import('../miniprogram/pages/powder-mall/index')});
beforeEach(()=>{api.owner='account-a';api.summary.mockReset();api.rule.mockReset().mockReturnValue({abort:vi.fn(),promise:Promise.resolve({rule_version_id:'published-v2',policy:{schema_version:2,timezone:'Asia/Shanghai',daily_rewards:[{kind:'PINK',units:'20'}],first_rewards:[],milestones:[]}})});vi.stubGlobal('wx',{showToast:vi.fn(),navigateTo:vi.fn(),navigateBack:vi.fn(),switchTab:vi.fn()})});
afterAll(()=>vi.unstubAllGlobals());
function page(key:string){const p=pages[key]!;return{...p,data:structuredClone(p.data),setData(patch:Record<string,unknown>){Object.assign(this.data,patch)}}as PageHarness}
function call(p:PageHarness,key:string){return(p[key]as()=>unknown).call(p)}
function dossier(expiryPending=false){return{profile:{account_id:'account-a',available_pink_units:'9007199254740993'},entitlements:[{kind:'PUBLISH_QUOTA',available_qty:'7',consumed_qty:'2',granted_qty:'10',expiry_pending:expiryPending}]}}
test('server quantities stay strings and expiry pending is not treated as usable quota',async()=>{const p=page('quota');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve(dossier())});await call(p,'onShow');expect(p.data).toMatchObject({available:'7',used:'2',total:'10',diamondBalance:'9007199254740993',items:[],redemptions:[]});api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve(dossier(true))});await call(p,'onShow');expect(p.data.available).toBe('待刷新');call(p,'onUnload')});
test.each(['quota','deposit'])('%s hides private values, ignores late account response, and never falls back to mock',async(key)=>{const p=page(key);let finish!:(value:unknown)=>void;api.summary.mockReturnValue({abort:vi.fn(),promise:new Promise(r=>{finish=r})});const pending=call(p,'onShow');await vi.waitFor(()=>expect(api.summary).toHaveBeenCalled());api.owner='account-b';finish(dossier());await pending;expect(p.data.diamondBalance).toBe('—');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.reject(new Error('接口不可用'))});await call(p,'onShow');expect(p.data.errorText).toBe('接口不可用');expect(p.data.diamondBalance).toBe('—');call(p,'onHide');call(p,'onUnload')});
test.each(['quota','deposit'])('%s guest does not query API',async(key)=>{api.owner=null;const p=page(key);await call(p,'onShow');expect(api.summary).not.toHaveBeenCalled();expect(p.data.diamondBalance).toBe('—');call(p,'onUnload')});

test.each(['membership','levels','service'])('%s projects only existing benefit fields and clears on hide',async(key)=>{const p=page(key);api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve({profile:{account_id:'account-a',level_code:'SERVER_LEVEL',available_pink_units:'9007199254740993',total_growth_units:'12345678901234567890'},entitlements:[{kind:'CONTRACT',available_qty:'7',expiry_pending:true}]})});await call(p,'onShow');if(key==='membership'){expect(p.data.level).toBe('SERVER_LEVEL');expect(p.data.diamonds).toBe('9007199254740993');expect(p.data.nextLevelPoints).toBe('—')}if(key==='levels'){expect(p.data.currentLevelName).toBe('SERVER_LEVEL');expect(p.data.currentBenefits).toEqual([{id:'CONTRACT',label:'电子合同：待刷新'}]);expect(p.data.levels).toEqual([])}if(key==='service'){expect(p.data.stats).toContainEqual({label:'电子合同',value:'待刷新'});expect(p.data.packages).toEqual([])}call(p,'onHide');expect(p.data.loggedIn).toBe(false);call(p,'onUnload')});
test.each(['membership','levels','service'])('%s fails closed on foreign owner and unavailable API',async(key)=>{const p=page(key);api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve({...dossier(),profile:{...dossier().profile,account_id:'foreign'}})});await call(p,'onShow');expect(p.data.errorText).toBe('账户响应不一致');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.reject(new Error('不可用'))});await call(p,'onShow');expect(p.data.errorText).toBe('不可用');call(p,'onUnload')});
test.each(['membership','levels'])('%s formats current growth units and never scales integer PINK',async(key)=>{
 const p=page(key);api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve({profile:{account_id:'account-a',level_code:'L2',available_pink_units:'9007199254740993',total_growth_units:'9223372036854775807'},entitlements:[]})});
 await call(p,'onShow');expect(p.data.starPoints).toBe('922337203685477580.7');if(key==='membership')expect(p.data.diamonds).toBe('9007199254740993');
 call(p,'onHide');expect(p.data.starPoints).toBe('—');call(p,'onUnload');
});

test('powder mall projects the exact API PINK integer and keeps its OSS visual catalog',async()=>{
 const p=page('mall');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve(dossier())});await call(p,'onShow');
 expect(api.summary).toHaveBeenCalledTimes(1);expect(p.data).toMatchObject({loggedIn:true,balance:'9007199254740993',errorText:''});
 expect(p.data.mallProducts).toHaveLength(6);expect((p.data.mallProducts as {image:string}[]).every(item=>item.image.startsWith('https://xyuprj.oss-cn-hangzhou.aliyuncs.com/'))).toBe(true);
 call(p,'onUnload');
});

test('powder mall guest and foreign response fail closed without a private projection',async()=>{
 api.owner=null;const guest=page('mall');await call(guest,'onShow');expect(api.summary).not.toHaveBeenCalled();expect(guest.data).toMatchObject({loggedIn:false,balance:'—',errorText:'请登录后查看账户权益'});call(guest,'onUnload');
 api.owner='account-a';const foreign=page('mall');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve({...dossier(),profile:{...dossier().profile,account_id:'account-b'}})});await call(foreign,'onShow');expect(foreign.data).toMatchObject({balance:'—',errorText:'账户响应不一致'});call(foreign,'onUnload');
});

test('powder mall never paints API errors or late account and hidden-page responses',async()=>{
 const rejected=page('mall');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.reject(new Error('权益接口不可用'))});await call(rejected,'onShow');expect(rejected.data).toMatchObject({balance:'—',errorText:'权益接口不可用'});call(rejected,'onUnload');
 let finishAccount!:(value:ReturnType<typeof dossier>)=>void;const switched=page('mall');api.summary.mockReturnValue({abort:vi.fn(),promise:new Promise(resolve=>{finishAccount=resolve})});const switchedLoad=call(switched,'onShow');api.owner='account-b';finishAccount(dossier());await switchedLoad;expect(switched.data.balance).toBe('—');call(switched,'onUnload');
 api.owner='account-a';let finishHidden!:(value:ReturnType<typeof dossier>)=>void;const hidden=page('mall');api.summary.mockReturnValue({abort:vi.fn(),promise:new Promise(resolve=>{finishHidden=resolve})});const hiddenLoad=call(hidden,'onShow');call(hidden,'onHide');finishHidden(dossier());await hiddenLoad;expect(hidden.data).toMatchObject({loggedIn:false,balance:'—'});call(hidden,'onUnload');
});

test('powder mall aborts an unloaded read and leaves the late result unpainted',async()=>{
 let finish!:(value:ReturnType<typeof dossier>)=>void;const abort=vi.fn();const p=page('mall');api.summary.mockReturnValue({abort,promise:new Promise(resolve=>{finish=resolve})});const pending=call(p,'onShow');call(p,'onUnload');expect(abort).toHaveBeenCalledTimes(1);finish(dossier());await pending;expect(p.data.balance).toBe('—');
});

test('powder mall redemption and lottery stay inert while existing account destinations remain navigable',async()=>{
 const p=page('mall');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve(dossier())});await call(p,'onShow');api.summary.mockClear();const before=structuredClone(p.data);
 call(p,'redeem');call(p,'goLottery');expect(vi.mocked(wx.showToast).mock.calls).toEqual([[{title:'接口暂未接入',icon:'none'}],[{title:'接口暂未接入',icon:'none'}]]);expect(api.summary).not.toHaveBeenCalled();expect(p.data).toEqual(before);
 for(const [method,url] of [['goLedger','/pages/powder-ledger/index'],['goCheckIn','/pages/check-in/index'],['goCoupons','/pages/coupons/index']] as const){call(p,method);const calls=vi.mocked(wx.navigateTo).mock.calls;const options=calls[calls.length-1]?.[0];expect(options?.url).toBe(url);options?.complete?.({} as WechatMiniprogram.GeneralCallbackResult)}
 call(p,'onUnload');
});

test('powder mall serializes repeated navigation and rejects it after the page is hidden',async()=>{
 const p=page('mall');api.summary.mockReturnValue({abort:vi.fn(),promise:Promise.resolve(dossier())});await call(p,'onShow');
 call(p,'goLedger');call(p,'goLedger');expect(wx.navigateTo).toHaveBeenCalledTimes(1);
 const first=vi.mocked(wx.navigateTo).mock.calls[0]?.[0];first?.complete?.({} as WechatMiniprogram.GeneralCallbackResult);
 call(p,'goLedger');expect(wx.navigateTo).toHaveBeenCalledTimes(2);
 call(p,'onHide');call(p,'goCheckIn');expect(wx.navigateTo).toHaveBeenCalledTimes(2);call(p,'onUnload');
});
