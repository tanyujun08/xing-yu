import { enableLinked, linkedAction, linkedRequest } from './linked';
import { demoStorage } from './storage';
import { contractPDF } from './contract-file';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DemoProblem, handleDemo, readDemo, registerMaterial, sessionResponse, recordDemoPayment } from './engine';
import { rules } from './rule-core';
import { ACCOUNT, position } from './seed';
type Options = Record<string, any>;
export function demoRequest(options: Options): WechatMiniprogram.RequestTask {
 let aborted = false;
 const timer = setTimeout(() => {
  if (aborted) return;
  try { const response = handleDemo(options.method ?? 'GET', options.url, options.data ?? {}, options.header ?? {}); const result = { data: response.data, statusCode: response.status, header: response.headers, cookies: [], errMsg: 'request:ok' }; options.success?.(result); options.complete?.(result); }
  catch (error) { const result = { data: { code: error instanceof DemoProblem ? error.code : 'DEMO_ERROR', message: error instanceof Error ? error.message : '演示异常', request_id: 'offline-demo' }, statusCode: error instanceof DemoProblem ? error.status : 500, header: {}, cookies: [], errMsg: 'request:ok' }; options.success?.(result); options.complete?.(result); }
 }, readDemo().scenario === 'loading' ? 3000 : readDemo().latency);
 return { abort() { aborted = true; clearTimeout(timer); options.fail?.({ errMsg: 'request:fail abort' }); }, onHeadersReceived() {}, offHeadersReceived() {} } as unknown as WechatMiniprogram.RequestTask;
}
function callback(options: Options, value: Options): void { options.success?.(value); options.complete?.(value); }
const demoAPI: Options = { request: demoRequest };
export const demoWx = demoAPI as Pick<typeof wx, 'request' | 'login' | 'requestPayment' | 'uploadFile' | 'chooseLocation' | 'getLocation' | 'openLocation' | 'makePhoneCall' | 'scanCode' | 'requestSubscribeMessage' | 'chooseMedia' | 'downloadFile'>;
export function installDemoPlatform(): void {
 const platform = demoAPI;
 // Keep wx native methods intact: DevTools wraps them when useApiHook is enabled.
 platform.request = demoRequest;
 platform.login = (o: Options) => callback(o, { code: 'OFFLINE_DEMO_CODE', errMsg: 'login:ok' });
 platform.requestPayment = (o: Options) => wx.showActionSheet({ itemList: ['模拟支付成功（不扣款）', '模拟支付失败', '模拟结果暂未知'], success: result => { const id = String(o.package ?? '').replace(/^prepay_id=offline-demo-/, ''); const outcome = ['SUCCESS', 'FAILED', 'UNKNOWN'][result.tapIndex] ?? 'UNKNOWN'; try { recordDemoPayment(id, outcome); if (outcome === 'SUCCESS') callback(o, { errMsg: 'requestPayment:ok' }); else { const fail = { errMsg: 'requestPayment:fail ' + outcome }; o.fail?.(fail); o.complete?.(fail); } } catch (error) { const fail = { errMsg: error instanceof Error ? error.message : '模拟支付失败' }; o.fail?.(fail); o.complete?.(fail); } }, fail: () => { const fail = { errMsg: 'requestPayment:fail cancel' }; o.fail?.(fail); o.complete?.(fail); } });
 platform.uploadFile = (o: Options) => { let cancelled = false; const id = 'material-' + Date.now(), cls = o.formData?.class ?? 'RENTAL_ASSET_IMAGE'; const timer = setTimeout(() => { if (cancelled) return; const value = registerMaterial(o.filePath, cls, id); callback(o, { statusCode: 201, data: JSON.stringify({ ...value, upload_id: id }), header: {}, errMsg: 'uploadFile:ok' }); }, 120); return { abort() { cancelled = true; clearTimeout(timer); o.fail?.({ errMsg: 'uploadFile:fail abort' }); }, onProgressUpdate(fn: (v: Options) => void) { fn({ progress: 100, totalBytesSent: 4096, totalBytesExpectedToSend: 4096 }); } }; };
 platform.chooseLocation = (o: Options) => callback(o, { name: '科技园演示地址', address: '广东省深圳市南山区科苑路 88 号', latitude: Number(position.latitude), longitude: Number(position.longitude), errMsg: 'chooseLocation:ok' });
 platform.getLocation = (o: Options) => callback(o, { latitude: Number(position.latitude), longitude: Number(position.longitude), accuracy: 10, errMsg: 'getLocation:ok' });
 platform.openLocation = (o: Options) => { wx.showModal({ title: '位置预览', content: o.name + '\n' + (o.address ?? '') + '\n离线演示不调用真实地图。', showCancel: false }); callback(o, { errMsg: 'openLocation:ok' }); };
 platform.makePhoneCall = (o: Options) => { wx.showModal({ title: '模拟联系', content: '演示联系电话：' + o.phoneNumber + '\n不会拨打电话。', showCancel: false }); callback(o, { errMsg: 'makePhoneCall:ok' }); };
 platform.scanCode = (o: Options) => callback(o, { result: 'cab_demo1234567890123456', path: 'pages/cabinet-code/index?scene=cab_demo1234567890123456', scanType: 'QR_CODE', charSet: 'UTF-8', errMsg: 'scanCode:ok' });
 platform.requestSubscribeMessage = (o: Options) => callback(o, { errMsg: 'requestSubscribeMessage:ok', ...Object.fromEntries((o.tmplIds ?? []).map((v: string) => [v, 'accept'])) });
 const choose = (options: Options) => wx.chooseMedia(options as WechatMiniprogram.ChooseMediaOption);
 platform.chooseMedia = (o: Options) => { if (o.mediaType?.length === 1 && o.mediaType[0] === 'video') { choose(o); return; } return wx.showActionSheet({ itemList: ['使用演示图片', '从本机相册 / 相机选择'], success: result => { if (result.tapIndex === 1) { choose(o); return; } callback(o, { type: 'image', tempFiles: [{ tempFilePath: '/assets/demo/device-1.png', size: 4096, width: 640, height: 640, fileType: 'image' }], errMsg: 'chooseMedia:ok' }); }, fail: o.fail }); };
 const fs = wx.getFileSystemManager();
 platform.downloadFile = (o: Options) => { if (!o.url.startsWith('/assets/')) { o.fail?.({ errMsg: 'downloadFile:fail offline demo blocks remote download' }); return { abort() {} }; } const target = wx.env.USER_DATA_PATH + '/offline-v102-contract-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.pdf'; fs.writeFile({ filePath: target, data: contractPDF, encoding: 'base64', success: () => callback(o, { statusCode: 200, tempFilePath: target, errMsg: 'downloadFile:ok' }), fail: o.fail }); return { abort() {} }; };
 rules(readDemo()).appId = wx.getAccountInfoSync?.().miniProgram.appId ?? '';
 const session = sessionResponse();
 demoStorage.setStorageSync('xingyu.api-session.v1', { accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt: Date.now() + 86400000 * 365, accountId: ACCOUNT });
}

// Only the application entry enables the optional two-end local service; unit
// tests and the preserved standalone engine retain their original adapter.
export function installLinkedPlatform(): void {
 enableLinked();
 demoAPI.request = linkedRequest;
 demoAPI.requestPayment = (o: Options) => wx.showActionSheet({ itemList: ['模拟支付成功（不扣款）', '模拟支付失败', '模拟结果暂未知'], success: result => {
  const id=String(o.package ?? '').replace(/^prepay_id=offline-demo-/, ''), outcome=['SUCCESS','FAILED','UNKNOWN'][result.tapIndex] ?? 'UNKNOWN';
  void linkedAction('payment',{id,outcome}).then(()=>{if(outcome==='SUCCESS')callback(o,{errMsg:'requestPayment:ok'});else {const value={errMsg:'requestPayment:fail '+outcome};o.fail?.(value);o.complete?.(value);}}).catch((error: Error)=>{const value={errMsg:error.message};o.fail?.(value);o.complete?.(value);});
 }, fail: () => {const value={errMsg:'requestPayment:fail cancel'};o.fail?.(value);o.complete?.(value);} });
 demoAPI.uploadFile = (o: Options) => { let cancelled=false;const id='material-'+Date.now()+'-'+Math.random().toString(36).slice(2),materialClass=o.formData?.class ?? 'RENTAL_ASSET_IMAGE';
  const fail=(message:string)=>{if(!cancelled){const value={errMsg:message};o.fail?.(value);o.complete?.(value);}};
  const rejectKnown=(message:string)=>{if(!cancelled)callback(o,{statusCode:422,data:JSON.stringify({code:'VALIDATION_FAILED',message,request_id:'offline-upload'}),header:{},errMsg:'uploadFile:ok'});};
  const send=(action:string,values:Options)=>{void linkedAction(action,values).then(value=>{if(!cancelled)callback(o,{statusCode:201,data:JSON.stringify({...value,upload_id:value.material_id??id}),header:{},errMsg:'uploadFile:ok'});}).catch((error:Error & {outcomeKnown?:boolean})=>{if(error.outcomeKnown)rejectKnown(error.message);else fail(error.message);});};
  if(materialClass==='EVIDENCE_IMAGE' && !String(o.filePath).startsWith('/assets/demo/')){
   const key=String(o.header?.['Idempotency-Key']??'');
   if(!/^[!-~]{1,64}$/.test(key))rejectKnown('归还凭证缺少原上传标识');
   else wx.getFileSystemManager().readFile({filePath:o.filePath,encoding:'base64',success:result=>{if(cancelled)return;if(typeof result.data!=='string'){rejectKnown('无法读取归还凭证');return;}if(result.data.length>Math.ceil(5*1024*1024/3)*4){rejectKnown('归还图片不能超过 5 MB');return;}send('miniMaterial',{key,base64:result.data});},fail:()=>rejectKnown('无法读取本机归还图片')});
  }else send('material',{file:o.filePath,materialClass,id});
  return {abort(){cancelled=true;o.fail?.({errMsg:'uploadFile:fail abort'});},onProgressUpdate(fn: (v: Options)=>void){fn({progress:100,totalBytesSent:4096,totalBytesExpectedToSend:4096});}};
 };
}
