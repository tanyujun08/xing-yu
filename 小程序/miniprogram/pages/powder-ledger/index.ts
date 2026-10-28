import { accountApi, pointApi, loyaltyTraceApi } from '../../shared/api/account-api';
import { designAssets } from '../../shared/design/assets';
import { createAccountLedgerPage } from '../../shared/interaction/account-ledger-page';
import { pinkLedgerEntry, pinkLedgerSummary } from '../../shared/presentation/api-point-ledger';
import { pointUnits } from '../../shared/presentation/api-point-ledger';
import type { PointEntryDetail } from '../../shared/model/api-loyalty';
import { assertOwner } from '../../shared/presentation/loyalty';
import { loyaltyIdentifier } from '../../shared/model/loyalty-intent';
import { createOperationScope } from '../../shared/interaction/operation-scope';
import { formatDateTime } from '../../shared/format/date-time';

const initial = {
      icons: designAssets, balance: '—', totalEarned: '—', reserved: '—', monthIncrease: '—', monthDecrease: '—',
      ledgerFilter: 'all',
      ledgerTabs: [{ id: 'all', label: '全部' }, { id: 'income', label: '增加' }, { id: 'expense', label: '减少' }],
      detail:null as null|{id:string;title:string;amount:string;before:string;after:string;time:string;drawId:string;checkInId:string;grantId:string},detailError:'',grantCoupons:[] as string[],
      currentLedger:null as PointResponse|null,currentEntry:null as PointEntryDetail|null,
    };
type PointResponse = Awaited<ReturnType<typeof pointApi.list>['promise']>;
const ledger=createAccountLedgerPage<PointResponse, ReturnType<typeof pinkLedgerEntry>, typeof initial>({
    initial,
    identity: accountApi.sessionIdentity,
    filters: ['all', 'income', 'expense'],
    load: (cursor, filter) => pointApi.list('PINK', cursor, filter === 'income' ? 'INCREASE' : filter === 'expense' ? 'DECREASE' : undefined),
    present: pinkLedgerEntry, summary: value=>({...pinkLedgerSummary(value),currentLedger:value}),
    generation: 'PINK', loginURL: '/pages/login/index?source=powder-ledger',
  });
const details=new WeakMap<object,{scope:ReturnType<typeof createOperationScope>;owner:string|null;visible:boolean;id:string;entry:PointEntryDetail|null}>();
function state(page:object){let value=details.get(page);if(!value){value={scope:createOperationScope(),owner:accountApi.sessionIdentity(),visible:false,id:'',entry:null};details.set(page,value);}return value;}
function current(page:object,value:ReturnType<typeof state>){return details.get(page)===value&&!value.scope.disposed&&value.visible&&!!value.owner&&value.owner===accountApi.sessionIdentity();}
Page({
  ...ledger,
  onLoad(options:Record<string,string|undefined>={}){ledger.onLoad.call(this);const value=state(this);value.id=loyaltyIdentifier(options['entry_id']??'')?options['entry_id']!:'';},
  async onShow(){const value=state(this);value.visible=true;value.owner=accountApi.sessionIdentity();await ledger.onShow.call(this);if(value.id&&current(this,value))await this.readEntry(value.id);},
  onHide(){const value=state(this);value.visible=false;value.entry=null;ledger.onHide.call(this);},
  onUnload(){const value=state(this);value.visible=false;value.scope.dispose();details.delete(this);ledger.onUnload.call(this);},
  async readEntry(id:string){const value=state(this);if(!current(this,value))return;this.setData({detail:null,currentEntry:null,detailError:'',grantCoupons:[]});try{const result=await value.scope.latest('entry',()=>pointApi.detail(id).promise);if(!result.accepted||!current(this,value))return;const entry=result.value;assertOwner(entry,value.owner!);if(entry.entry_id!==id||entry.point_kind!=='PINK')throw new Error('粉钻明细标识不一致');value.entry=entry;value.id=id;this.setData({currentEntry:entry,detail:{id,title:entry.source_kind==='LOTTERY'?(entry.action==='CONSUME'?'抽奖扣费':'抽奖奖励'):pinkLedgerEntry(entry).title??'粉钻流水',amount:pinkLedgerEntry(entry).amount,before:pointUnits(entry.available_before,'PINK'),after:pointUnits(entry.available_after,'PINK'),time:formatDateTime(entry.occurred_at),drawId:entry.source_draw_id??'',checkInId:entry.source_kind==='CHECK_IN'?entry.source_id:'',grantId:entry.source_grant_id??''}});}catch(error){if(current(this,value))this.setData({detailError:error instanceof Error?error.message:'粉钻明细读取失败'});}},
  openEntry(event:WechatMiniprogram.TouchEvent){const id=String(event.currentTarget.dataset['id']??'');if(this.data.items.some(item=>item.id===id))void this.readEntry(id);},
  retryEntry(){if(state(this).id)void this.readEntry(state(this).id);},
  openSource(){const entry=state(this).entry;if(entry?.source_draw_id)this.navigateLedger('/pages/lottery/index?draw_id='+encodeURIComponent(entry.source_draw_id));else if(entry?.source_kind==='CHECK_IN')this.navigateLedger('/pages/check-in/index?check_in_id='+encodeURIComponent(entry.source_id));},
  async readGrant(){const value=state(this),entry=value.entry;if(!current(this,value)||!entry?.source_grant_id)return;try{const grant=await loyaltyTraceApi.grant(entry.source_grant_id).promise;if(!current(this,value))return;assertOwner(grant,value.owner!);if(grant.grant_id!==entry.source_grant_id||!grant.pink_entry_ids.includes(entry.entry_id))throw new Error('奖励来源不一致');this.setData({grantCoupons:grant.coupon_ids});wx.showModal({title:'奖励发放明细',content:grant.reward_code+' '+grant.reward_units+'；'+formatDateTime(grant.created_at),showCancel:false});}catch(error){if(current(this,value))this.setData({detailError:error instanceof Error?error.message:'发放明细读取失败'});}},
  goCheckIn() { this.navigateLedger('/pages/check-in/index'); },
  goMall() { this.unavailable(); },
  goLottery() { this.navigateLedger('/pages/lottery/index'); },
  unavailable() { wx.showToast({ title: '该功能接口暂未接入', icon: 'none' }); },
  setLedgerFilter(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    return this.changeLedgerFilter(event.detail.value);
  },
  showRules() {
    wx.showModal({ title: '粉钻账本', content: '1 个整数单位为 1 粉钻。可用和预占分别记账，预占与释放不代表奖励；消费、返还和冲正以实际流水为准。此页不执行提现或兑换。', showCancel: false });
  },
});
