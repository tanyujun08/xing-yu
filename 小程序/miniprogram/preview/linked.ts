/* eslint-disable @typescript-eslint/no-explicit-any */
import { readDemo, replaceLinkedState, useLinkedState } from './engine';
import type { DemoState } from './seed';

const origin = 'http://127.0.0.1:5190/__mock-link';
let linked = false;
let initial: Promise<void> | undefined;
let lastVersion = -1;
let lastNotice = 0;
type Reply = { state: DemoState; stateVersion: number; result?: any; status?: number; data?: any; headers?: Record<string,string> };
function update(reply: Reply): void {
 if (reply.state && (reply.stateVersion ?? 0) >= lastVersion) { lastVersion=reply.stateVersion ?? 0; replaceLinkedState(reply.state); }
}
function post(path: string, data: Record<string, unknown>): Promise<Reply> {
 return new Promise((resolve,reject)=>wx.request({url:origin+path,method:'POST',data,timeout:10000,
  success: value=>{if(value.statusCode!==200) { const detail=value.data as {message?:string;outcomeKnown?:boolean}; const error=new Error(detail?.message || '本机 Mock 服务不可用，请先启动 WEB 预览') as Error & {outcomeKnown?:boolean};error.outcomeKnown=detail?.outcomeKnown===true;reject(error);return; } resolve(value.data as Reply);},
  fail:()=>reject(new Error('本机 Mock 服务不可用，请先启动 WEB 预览'))}));
}
export function isLinked(): boolean { return linked; }
export function enableLinked(): void { useLinkedState(); linked=true; initial=undefined; lastVersion=-1; }
async function ready(): Promise<void> {
 if (!initial) initial=post('/init',{snapshot:readDemo()}).then(update).catch(error=>{initial=undefined;throw error;});
 return initial;
}
export async function linkedAction(action: string, values: Record<string, unknown> = {}): Promise<any> {
 await ready(); const reply=await post('/action',{action,...values});update(reply);return reply.result;
}
export async function refreshLinked(): Promise<void> { await ready(); const reply=await post('/init',{});update(reply); }
export function linkedRequest(options: Record<string, any>): WechatMiniprogram.RequestTask {
 let cancelled=false;
 void ready().then(async()=>{
  if(cancelled)return;
  const path=String(options.url || '').replace(/^https?:\/\/[^/]+/,'');
  const reply=await post('/request',{method:options.method ?? 'GET',path,body:options.data ?? {},headers:options.header ?? {}});
  if(cancelled)return;update(reply);
  const value={data:reply.data,statusCode:reply.status ?? 500,header:reply.headers ?? {},cookies:[],errMsg:'request:ok'};
  options.success?.(value);options.complete?.(value);
 }).catch((error: unknown)=>{if(cancelled)return;const message=error instanceof Error?error.message:'本机 Mock 服务不可用';if(Date.now()-lastNotice>15000&&typeof wx.showToast==='function'){lastNotice=Date.now();wx.showToast({title:'请先启动 WEB Mock 服务',icon:'none'});}const value={errMsg:message};options.fail?.(value);options.complete?.(value);});
 return {abort(){cancelled=true;const value={errMsg:'request:fail abort'};options.fail?.(value);options.complete?.(value);},onHeadersReceived(){},offHeadersReceived(){}} as unknown as WechatMiniprogram.RequestTask;
}
