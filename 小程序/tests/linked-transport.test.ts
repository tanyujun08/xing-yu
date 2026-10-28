import { beforeEach, expect, test, vi } from 'vitest';

type Options = { url: string; data: Record<string, unknown>; success: (value: unknown) => void; fail: (error: unknown) => void };
let storage: Map<string, unknown>;
let calls: string[];
let responder: (value: Options) => void;
beforeEach(() => {
 vi.resetModules(); storage=new Map(); calls=[];
 responder=()=>{};
 vi.stubGlobal('wx', {
  getStorageSync:(key:string)=>storage.get(key), setStorageSync:(key:string,value:unknown)=>storage.set(key,structuredClone(value)),
  removeStorageSync:(key:string)=>storage.delete(key), getStorageInfoSync:()=>({keys:[...storage.keys()]}),
  request:(options:Options)=>{calls.push(options.url);queueMicrotask(()=>responder(options));return {abort(){}};},
 });
});

test('shared initialization preserves the original local namespace and reads back server state', async () => {
 const engine=await import('../miniprogram/preview/engine'); const linked=await import('../miniprogram/preview/linked');
 engine.readDemo().profile.display_name='旧演示数据';engine.saveDemo();
 const originalKey='xingyu.offline-v102.xingyu.offline-demo.v1', old=structuredClone(storage.get(originalKey));
 responder=(options)=>{
  const snapshot=structuredClone(options.data.snapshot ?? engine.readDemo()) as ReturnType<typeof engine.readDemo>;
  if(options.url.endsWith('/init')) options.success({statusCode:200,data:{state:snapshot,stateVersion:1}});
  else {snapshot.profile.display_name='共享演示数据';options.success({statusCode:200,data:{state:snapshot,stateVersion:2,status:200,data:{display_name:'共享演示数据'},headers:{}}});}
 };
 linked.enableLinked();
 const response=await new Promise<{display_name:string}>((resolve,reject)=>linked.linkedRequest({url:'https://offline.invalid/v1/me/profile',success:(value:{data:{display_name:string}})=>resolve(value.data),fail:reject}));
 expect(response.display_name).toBe('共享演示数据');expect(engine.readDemo().profile.display_name).toBe('共享演示数据');
 expect(storage.get(originalKey)).toEqual(old);expect(storage.has(originalKey+'.linked')).toBe(true);
 expect(calls).toEqual(['http://127.0.0.1:5190/__mock-link/init','http://127.0.0.1:5190/__mock-link/request']);
});

test('an unavailable local service returns a failure instead of contacting an external API', async () => {
 const linked=await import('../miniprogram/preview/linked');
 responder=options=>options.fail({errMsg:'offline'});linked.enableLinked();
 const error=await new Promise<string>(resolve=>linked.linkedRequest({url:'https://api.xingyuzlp.cn/v1/me/profile',success:()=>resolve('unexpected success'),fail:(value:{errMsg:string})=>resolve(value.errMsg)}));
 expect(error).toContain('本机 Mock 服务不可用');expect(calls).toEqual(['http://127.0.0.1:5190/__mock-link/init']);
});

test('payment selection sends one simulated result to the shared service before reporting success', async () => {
 const api=wx as unknown as Record<string,unknown>;
 api.getFileSystemManager=()=>({writeFile:vi.fn()});api.getAccountInfoSync=()=>({miniProgram:{appId:'demo-app'}});
 api.showActionSheet=(options:{success:(value:{tapIndex:number})=>void})=>options.success({tapIndex:0});
 const platform=await import('../miniprogram/preview/platform');const engine=await import('../miniprogram/preview/engine');
 let sent:Record<string,unknown>|undefined;
 responder=options=>{const state=structuredClone(engine.readDemo());if(options.url.endsWith('/action'))sent=options.data;options.success({statusCode:200,data:{state,stateVersion:2,result:null}});};
 platform.installDemoPlatform();platform.installLinkedPlatform();
 const result=await new Promise<string>((resolve,reject)=>platform.demoWx.requestPayment({timeStamp:'1',nonceStr:'demo',package:'prepay_id=offline-demo-payment-order-2',signType:'MD5',paySign:'demo',success:value=>resolve(value.errMsg),fail:reject}));
 expect(result).toBe('requestPayment:ok');expect(sent).toMatchObject({action:'payment',id:'payment-order-2',outcome:'SUCCESS'});
 expect(calls.filter(url=>url.endsWith('/action'))).toHaveLength(1);
});

test('selected return photo sends its bytes only to the local shared service', async () => {
 const api=wx as unknown as Record<string,unknown>;api.getFileSystemManager=()=>({writeFile:vi.fn(),readFile:(options:{success:(v:{data:string})=>void})=>options.success({data:'iVBORw0KGgo='})});api.getAccountInfoSync=()=>({miniProgram:{appId:'demo-app'}});
 const platform=await import('../miniprogram/preview/platform'),engine=await import('../miniprogram/preview/engine');let sent:Record<string,unknown>|undefined;
 responder=options=>{const state=structuredClone(engine.readDemo());if(options.url.endsWith('/action'))sent=options.data;options.success({statusCode:200,data:{state,stateVersion:2,result:{material_id:'local-material-tenant-test',material_class:'EVIDENCE_IMAGE',public_url:'http://127.0.0.1:5190/__mock-link/materials/local-material-tenant-test'}}});};
 platform.installDemoPlatform();platform.installLinkedPlatform();
 const output=await new Promise<string>((resolve,reject)=>platform.demoWx.uploadFile({url:'https://offline.invalid/v1/materials/files',name:'file',filePath:'wxfile://selected.png',formData:{class:'EVIDENCE_IMAGE'},header:{'Idempotency-Key':'same-photo-intent'},success:value=>resolve(value.data),fail:reject}));
 expect(JSON.parse(output).material_id).toBe('local-material-tenant-test');expect(sent).toMatchObject({action:'miniMaterial',key:'same-photo-intent',base64:'iVBORw0KGgo='});
 expect(calls.every(url=>url.startsWith('http://127.0.0.1:5190/__mock-link/'))).toBe(true);
});

test('an oversized return image is rejected locally without reporting an unknown upload', async () => {
 const api=wx as unknown as Record<string,unknown>;api.getFileSystemManager=()=>({writeFile:vi.fn(),readFile:(options:{success:(v:{data:string})=>void})=>options.success({data:'A'.repeat(Math.ceil(5*1024*1024/3)*4+4)})});api.getAccountInfoSync=()=>({miniProgram:{appId:'demo-app'}});
 const platform=await import('../miniprogram/preview/platform');platform.installDemoPlatform();platform.installLinkedPlatform();
 const result=await new Promise<{status:number;message:string}>((resolve,reject)=>platform.demoWx.uploadFile({url:'https://offline.invalid/v1/materials/files',name:'file',filePath:'wxfile://large.png',formData:{class:'EVIDENCE_IMAGE'},header:{'Idempotency-Key':'large-photo-intent'},success:value=>resolve({status:value.statusCode,message:JSON.parse(value.data).message}),fail:reject}));
 expect(result).toEqual({status:422,message:'归还图片不能超过 5 MB'});expect(calls).toHaveLength(0);
});

test('mall confirmation uses the shared service and shows the returned balance', async () => {
 const api=wx as unknown as Record<string,unknown>;api.showModal=(o:{success:(v:{confirm:boolean})=>void})=>o.success({confirm:true});api.showToast=vi.fn();
 const engine=await import('../miniprogram/preview/engine'), linked=await import('../miniprogram/preview/linked'), extras=await import('../miniprogram/preview/extras');
 let sent:Record<string,unknown>|undefined;const initial=engine.readDemo().pink;
 responder=options=>{const state=structuredClone(engine.readDemo());if(options.url.endsWith('/action')){sent=options.data;state.pink=initial-100;}options.success({statusCode:200,data:{state,stateVersion:options.url.endsWith('/action')?2:1,result:{}}});};
 linked.enableLinked();const definition=extras.demoExtras('powder-mall');
 const page={...definition,data:{balance:String(initial),errorText:''},setData(p:Record<string,unknown>){Object.assign(this.data,p);}};
 definition.redeem.call(page,{currentTarget:{dataset:{productId:'rental-10'}}});
 await vi.waitFor(()=>expect(page.data.balance).toBe(String(initial-100)));
 expect(sent).toMatchObject({action:'extra',kind:'mallRedeem',values:{product:'rental-10'}});
 expect(page.data.errorText).toContain('兑换成功');
});

test('an unavailable shared service does not report a mall purchase as successful', async () => {
 const api=wx as unknown as Record<string,unknown>;api.showModal=(o:{success:(v:{confirm:boolean})=>void})=>o.success({confirm:true});api.showToast=vi.fn();
 const engine=await import('../miniprogram/preview/engine'), linked=await import('../miniprogram/preview/linked'), extras=await import('../miniprogram/preview/extras');
 const initial=engine.readDemo().pink;responder=options=>{if(options.url.endsWith('/init'))options.success({statusCode:200,data:{state:structuredClone(engine.readDemo()),stateVersion:1}});else options.fail({errMsg:'offline'});};
 linked.enableLinked();const definition=extras.demoExtras('powder-mall');
 const page={...definition,data:{balance:String(initial),errorText:''},setData(p:Record<string,unknown>){Object.assign(this.data,p);}};
 definition.redeem.call(page,{currentTarget:{dataset:{productId:'rental-10'}}});
 await vi.waitFor(()=>expect(page.data.errorText).toContain('本机 Mock 服务不可用'));
 expect(page.data.balance).toBe(String(initial));expect(engine.readDemo().pink).toBe(initial);
 expect((page as typeof page & {_demoIntent?:{key:string}})._demoIntent?.key).toMatch(/^demo-extra-/);
});

test('a confirmed validation failure lets the user choose a different demo product', async () => {
 const api=wx as unknown as Record<string,unknown>;api.showModal=(o:{success:(v:{confirm:boolean})=>void})=>o.success({confirm:true});api.showToast=vi.fn();
 const engine=await import('../miniprogram/preview/engine'), linked=await import('../miniprogram/preview/linked'), extras=await import('../miniprogram/preview/extras');
 responder=options=>{if(options.url.endsWith('/init'))options.success({statusCode:200,data:{state:structuredClone(engine.readDemo()),stateVersion:1}});else options.success({statusCode:409,data:{message:'演示余额不足',outcomeKnown:true}});};
 linked.enableLinked();const definition=extras.demoExtras('powder-mall');
 const page={...definition,data:{balance:String(engine.readDemo().pink),errorText:''},setData(p:Record<string,unknown>){Object.assign(this.data,p);}};
 definition.redeem.call(page,{currentTarget:{dataset:{productId:'rental-10'}}});
 await vi.waitFor(()=>expect(page.data.errorText).toContain('演示余额不足'));
 expect((page as typeof page & {_demoIntent?:{key:string}|null})._demoIntent).toBeNull();
});
