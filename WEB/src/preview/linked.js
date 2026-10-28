import { ApiProblem } from '../shared/api/problem';

const prefix = 'linked-';
const api = '/__mock-link';
export const isLinkedId = (id) => typeof id === 'string' && id.startsWith(prefix);
export const linkedId = (id) => prefix + id;
export const originalId = (id) => id.slice(prefix.length);
async function exchange(path, body) {
  let response;
  try { response=await fetch(api+path, body === undefined ? {cache:'no-store'} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
  catch { throw new ApiProblem(503,{code:'LINK_UNAVAILABLE',message:'本机联动服务不可用，请启动 WEB 预览。',request_id:'linked-demo'}); }
  const payload=await response.json();
  if(!response.ok)throw new ApiProblem(response.status,{code:payload.code ?? 'LINK_UNAVAILABLE',message:payload.message ?? '本机联动操作失败',request_id:'linked-demo'});
  if(typeof payload.status==='number'&&payload.status>=400)throw new ApiProblem(payload.status,payload.data);
  return payload;
}
export async function linkedState() { return (await exchange('/state')).state; }
export async function linkedRequest(path,method='GET',body={},headers={}) { return exchange('/request',{path,method,body,headers}); }
export async function linkedAction(action,values={}) { return exchange('/action',{action,...values}); }
const media = value => value?.url?.startsWith('/assets/') ? {...value,url:'/__mock-link'+value.url} : value;
export function linkedMember(template, state) {
 const profile=state.profile, id=linkedId(profile.account_id);
 return {...structuredClone(template),userId:id,nickname:profile.display_name,miniProgramOpenIdMasked:'本机演示账号',
  miniProgramRegisteredAt:profile.created_at ?? template.miniProgramRegisteredAt,mobileMasked:'未提供',realNameStatus:'VERIFIED',
  wechatPayScoreRaw:null,wechatPayScoreUpdatedAt:null,consumptionAmountFen:null,consumptionOrderCount:null,lastOrderAt:null};
}
export function linkedDossier(template, state) {
 const member=linkedMember(template,state), id=member.userId;
 const dates=[...new Set([...(state.checkedDates??[]),...Object.keys(state.rules?.checkIns??{})])].filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
 let streak=0, previous=null;
 const records=dates.map(day=>{
  streak=previous && Date.parse(day)-Date.parse(previous)===86400000?streak+1:1;
  previous=day;
  const receipt=state.rules?.checkIns?.[day], check=receipt?.check_in, grants=receipt?.grants??[];
  const rewardDisplay=grants.length?grants.map(grant=>{
   const units=String(grant.reward_units??'0');
   if(grant.reward_code==='PINK')return `+${units} 粉钻`;
   if(grant.reward_code==='GROWTH')return `+${(Number(units)/10).toLocaleString('zh-CN',{maximumFractionDigits:1})} 星光`;
   return `+${units} ${grant.reward_code??'权益'}`;
  }).join('、'):'无发奖记录';
  const growth=grants.filter(grant=>grant.reward_code==='GROWTH').reduce((sum,grant)=>sum+Number(grant.reward_units??0),0);
  return {signInId:check?.check_in_id??`legacy-demo-${day}`,userId:id,businessDate:day,signedAt:check?.checked_in_at??`${day}T00:00:00Z`,
   streakDays:Number(check?.streak_days??streak),dailyRewardStarTenths:growth,milestoneDays:null,milestoneBonusStarTenths:0,
   loyaltyVersionId:check?.rule_version_id??'legacy-demo',ledgerEntryId:grants.find(grant=>grant.reward_code==='GROWTH')?.point_entry_id??'',rewardDisplay};
 }).reverse();
 const today=new Date(Date.now()+8*3600000+Number(state.rules?.dayOffset??0)*86400000).toISOString().slice(0,10);
 const yesterday=new Date(Date.parse(`${today}T00:00:00Z`)-86400000).toISOString().slice(0,10), latest=records[0];
 const currentStreak=latest && [today,yesterday].includes(latest.businessDate)?latest.streakDays:0;
 const points=(state.points??[]).filter(entry=>entry.point_kind==='GROWTH');
 const starLedger=points.map(entry=>{
  const delta=Number(entry.available_delta??0);
  return {id:entry.entry_id,idempotencyKey:entry.entry_id,accountSequence:Number(entry.account_sequence??0),userId:id,
   type:delta>=0?'EARN':'RECOVERY',sourceType:entry.source_kind==='CHECK_IN'?'SIGN_IN':'OTHER',sourceId:entry.source_id??'',
   grossStarTenths:delta,availableDeltaTenths:delta,frozenDeltaTenths:Number(entry.reserved_delta??0),consumedDeltaTenths:0,recoveryDueDeltaTenths:0,
   balanceAfter:{availableTenths:Number(entry.available_after??0),frozenTenths:Number(entry.reserved_after??0),consumedTenths:0,recoveryDueTenths:0},
   occurredAt:entry.occurred_at,note:entry.source_kind==='CHECK_IN'?'签到奖励':`演示来源：${entry.source_kind??'未知'}`};
 });
 return {...structuredClone(template),...member,realNameMasked:'演示实名',identityNoMasked:null,riskTags:['本机联动演示'],
  starAccount:{userId:id,availableTenths:Number(state.growth??0),frozenTenths:0,consumedTenths:0,recoveryDueTenths:0,updatedAt:points[0]?.occurred_at??state.profile.updated_at},
  demoPinkBalance:Number(state.pink??0),starLedger,signInRecords:records,signIn:{timezone:'Asia/Shanghai',signedInToday:latest?.businessDate===today,currentStreakDays:currentStreak,
   lastSignInAt:latest?.signedAt??null,dailyRewardStarTenths:0,nextMilestoneDays:currentStreak<7?7:null,
   nextMilestoneBonusStarTenths:null,nextMilestoneLoyaltyVersionId:'check-in-demo-v2'},
  notes:['小程序共享演示账号；签到奖励按实际粉钻、星光等类型展示。身份与积分均为本机模拟。']};
}
export function linkedOrder(detail, state, template, action) {
 const id=linkedId(detail.order.order_id), source=detail.order, asset={...source.asset,cover_media:media(source.asset.cover_media)};
 const participants={...template.order.participants,tenant_account_id:linkedId(state.profile.account_id),tenant_display_name:state.profile.display_name,lessor_id:'linked-demo-lessor',lessor_display_name:'演示出租方',merchant_id:null,merchant_name:null};
 const canReview=source.display_status_code==='RETURN_REVIEW';
 const order={...template.order,...source,order_id:id,asset,participants,allowed_actions:[...(canReview?[action('PREVIEW_REVIEW',id),action('SUBMIT_REVIEW',id)]:[]),...(source.display_status_code==='RETURNING'?[action('RECORD_RECEIPT',id)]:[])],blockers:source.blockers??[]};
 const changeOrder = value=> value ? {...value,order_id:id} : value;
 const bill={...template.bill,...detail.bill,initial_payment:changeOrder(detail.bill.initial_payment),refund_summary:{...template.bill.refund_summary,...detail.bill.refund_summary,latest_refund:changeOrder(detail.bill.refund_summary?.latest_refund)}};
 const snapshot={...template.asset_snapshot,...detail.asset_snapshot,media:(detail.asset_snapshot?.media??[]).map(media)};
 return {...template,...detail,order,fees:{...template.fees,...detail.fees},bill,delivery:{...template.delivery,...detail.delivery},asset_snapshot:snapshot,requirements:{...template.requirements,...detail.requirements},merchant_id:null};
}
