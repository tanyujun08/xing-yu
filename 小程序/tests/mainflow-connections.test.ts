import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const session=vi.hoisted(()=>({owner:'owner-a' as string|null}));
vi.mock('../miniprogram/shared/api/account-api',()=>({accountApi:{sessionIdentity:()=>session.owner}}));
type Harness={data:Record<string,unknown>;setData(patch:Record<string,unknown>):void;[key:string]:unknown};
let definition:Harness|undefined;
const request=vi.fn(),storage=vi.fn(),chooseMedia=vi.fn(),saveFile=vi.fn(),navigate=vi.fn(),toast=vi.fn();
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();session.owner='owner-a';definition=undefined;vi.stubGlobal('Page',(value:Harness)=>{definition=value});vi.stubGlobal('getCurrentPages',()=>[{},{}]);vi.stubGlobal('wx',{request,setStorageSync:storage,chooseMedia,getFileSystemManager:()=>({saveFile}),navigateTo:navigate,navigateBack:navigate,switchTab:navigate,showToast:toast,stopPullDownRefresh:vi.fn()});});
afterEach(()=>vi.unstubAllGlobals());
async function mount(name:string,options:Record<string,string>={}):Promise<Harness>{await import(`../miniprogram/pages/${name}/index.ts`);if(!definition)throw new Error('Page missing');const p={...definition,data:structuredClone(definition.data),setData(patch:Record<string,unknown>){Object.assign(this.data,patch)}};call(p,'onLoad',options);call(p,'onShow');return p;}
function call(page:Harness,name:string,...args:unknown[]):unknown{return(page[name] as(...values:unknown[])=>unknown).apply(page,args);}
function noWrites(){expect(request).not.toHaveBeenCalled();expect(storage).not.toHaveBeenCalled();expect(chooseMedia).not.toHaveBeenCalled();expect(saveFile).not.toHaveBeenCalled();}

// The retired chat placeholder is now covered through real request/response shapes in
// chat-page-http.test.ts: account changes, delayed responses and owner-bound unknown recovery.
test.each(['dispute'] as const)('%s refuses media before native selection and ignores a late action after unload',async name=>{const p=await mount(name,{id:'original'});const action='addEvidence';call(p,action);noWrites();call(p,'onUnload');const before=toast.mock.calls.length;call(p,action);expect(toast).toHaveBeenCalledTimes(before);noWrites();});
