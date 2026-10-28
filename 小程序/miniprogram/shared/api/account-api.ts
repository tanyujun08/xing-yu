import { demoWx } from '../../preview/platform';
import type { components } from '../../../types/api/schema';
import { request, type MaterialUploadOptions } from './request';
import { materialUploadApi } from './material-upload';
export { runMaterialUpload } from './material-upload';
import { newIdempotencyKey } from './idempotency';
import { ApiProblem } from './problem';
import { readStoredApiSession, saveApiSession, clearApiSession } from '../session/api-session';

type Schema = components['schemas'];
export type CheckInMonth = Schema['CheckInMonth'];
export type CheckInReward = Schema['RewardItem'];
export type CurrentCheckInRule = Schema['CurrentCheckInRule'];
export type OwnGrowthTask = Schema['OwnGrowthTask'];
export type OwnGrowthTaskList = Schema['OwnGrowthTaskList'];
export type OwnGrowthTaskClaim = Schema['OwnGrowthTaskClaim'];
export type OwnAddress = Schema['OwnAddress'];
export type AddressInput = Schema['AddressInput'];
export type OwnIdentityStatus = Schema['OwnIdentityStatus'];
export type OwnAuthenticators = Schema['OwnAuthenticators'];

export const accountApi = {
  inspectOpsChallenge: (scanToken: string) => request<Schema['OpsWechatChallenge'], { scan_token: string }>({ path: '/v1/me/ops-wechat-challenges/inspect', method: 'POST', body: { scan_token: scanToken } }),
  decideOpsChallenge: (scanToken: string, approve: boolean, intent: string) => request<Schema['OpsWechatChallenge'], { scan_token: string; approve: boolean }>({ path: '/v1/me/ops-wechat-challenges/decisions', method: 'POST', body: { scan_token: scanToken, approve }, idempotencyKey: intent }),
  sessionIdentity: () => readStoredApiSession()?.accountId ?? null,
  newIntent: (scope: string) => newIdempotencyKey(scope),
  async logout(intent:string):Promise<void> {
    const session=readStoredApiSession();
    await request<void>({path:'/v1/auth/logout',method:'POST',idempotencyKey:intent}).promise;
    const current=readStoredApiSession();
    if(session&&current?.accountId===session.accountId)clearApiSession(current.accessToken);
  },
  uploadAvatar: (filePath:string,intent:string,options?:MaterialUploadOptions) => materialUploadApi.upload(filePath,'PROFILE_IMAGE',intent,options),
  material: materialUploadApi.get,
  current: () => request<Schema['AccountView']>({ path: '/v1/auth/me' }),
  profile: () => request<Schema['AccountProfile']>({ path: '/v1/me/profile' }),
  identity: () => request<Schema['OwnIdentityStatus']>({ path: '/v1/me/identity' }),
  saveIdentity: (body: Schema['CreateIdentityVerificationRequest'], intent: string) => request<Schema['IdentityVerification'], Schema['CreateIdentityVerificationRequest']>({ path: '/v1/me/identity/verifications', method: 'POST', body, idempotencyKey: intent }),
  authenticators: () => request<Schema['OwnAuthenticators']>({ path: '/v1/me/authenticators' }),
  bindPhone: (phoneCode: string, version: number) => request<Schema['OwnAuthenticators'], Schema['MiniPhoneBindingRequest']>({
    path: '/v1/me/phone-binding', method: 'POST', body: { phone_code: phoneCode },
    idempotencyKey: newIdempotencyKey('mini-phone-binding'), aggregateVersion: `"security-${version}"`,
  }),
  unbindPhone: (version: number) => request<Schema['OwnAuthenticators']>({
    path: '/v1/me/phone-binding', method: 'DELETE', idempotencyKey: newIdempotencyKey('mini-phone-unbind'),
    aggregateVersion: `"security-${version}"`,
  }),
  bindWechat: (code: string, version: number) => request<Schema['OwnAuthenticators'], Schema['MiniWechatBindingRequest']>({
    path: '/v1/me/wechat-binding', method: 'POST', body: { code },
    idempotencyKey: newIdempotencyKey('mini-wechat-binding'), aggregateVersion: `"security-${version}"`,
  }),
  updateProfile: (body: Schema['UpdateAccountProfileRequest'], version: number, intent: string) =>
    request<Schema['AccountProfile'], Schema['UpdateAccountProfileRequest']>({ path: '/v1/me/profile/updates', method: 'POST', body, idempotencyKey: intent, aggregateVersion: `"profile-${version}"` }),
  async login(): Promise<void> {
    const code = await new Promise<string>((resolve, reject) => demoWx.login({ success: (result) => result.code ? resolve(result.code) : reject(new Error('微信登录未返回凭证')), fail: () => reject(new Error('微信登录不可用，请稍后重试')) }));
    const response = await request<Schema['SessionResponse'], { code: string }>({ path: '/v1/auth/wechat-mini/sessions', method: 'POST', body: { code }, authenticated: false, idempotencyKey: newIdempotencyKey('mini-login') }).promise;
    saveApiSession(response);
  },
  async phoneLogin(phoneCode: string): Promise<void> {
    if (!phoneCode) throw new Error('未获得微信手机号授权');
    const code = await new Promise<string>((resolve, reject) => demoWx.login({ success: (result) => result.code ? resolve(result.code) : reject(new Error('微信登录未返回凭证')), fail: () => reject(new Error('微信登录不可用，请稍后重试')) }));
    let response: Schema['SessionResponse'];
    try {
      response = await request<Schema['SessionResponse'], Schema['MiniPhoneLoginRequest']>({ path: '/v1/auth/wechat-mini/phone-sessions', method: 'POST', body: { phone_code: phoneCode, code }, authenticated: false, idempotencyKey: newIdempotencyKey('mini-phone-login') }).promise;
    } catch (error) {
      if (error instanceof ApiProblem && error.code === 'PRECONDITION_FAILED') {
        error.message = '此微信已有账号，请先微信登录，再到“账户安全”绑定手机号。';
      }
      throw error;
    }
    saveApiSession(response);
  },
};

export const addressApi = {
  list: (cursor?: string) => request<Schema['OwnAddressList']>({ path: '/v1/me/addresses?page_size=20' + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '') }),
  create: (body: AddressInput, intent: string) => request<Schema['AddressReceipt'], AddressInput>({ path: '/v1/me/addresses', method: 'POST', body, idempotencyKey: intent }),
  update: (address: OwnAddress, body: AddressInput, intent: string) => request<Schema['AddressReceipt'], AddressInput>({ path: `/v1/me/addresses/${encodeURIComponent(address.address_id)}/updates`, method: 'POST', body, idempotencyKey: intent, aggregateVersion: `"v${address.version}"` }),
  transition: (address: OwnAddress, action: 'ARCHIVE' | 'DEFAULT', intent: string) => {
    if (!address.allowed_actions.some((allowed) => allowed.code === action && allowed.enabled)) throw new Error('当前地址不允许此操作');
    return request<Schema['AddressReceipt'], Record<string, string>>({ body: action === 'ARCHIVE' ? { reason: '用户主动删除地址' } : {}, path: `/v1/me/addresses/${encodeURIComponent(address.address_id)}/${action === 'ARCHIVE' ? 'archive' : 'default'}`, method: 'POST', idempotencyKey: intent, aggregateVersion: `"v${address.version}"` });
  },
};

export const regionApi = {
  children: (datasetId?: string, parentId?: string) => {
    const query = [datasetId ? `dataset_id=${encodeURIComponent(datasetId)}` : '', parentId ? `parent_id=${encodeURIComponent(parentId)}` : ''].filter(Boolean).join('&');
    return request<Schema['AdministrativeRegionChildren']>({ path: '/v1/regions' + (query ? `?${query}` : ''), authenticated: false });
  },
};
export async function findOwnAddress(id: string): Promise<OwnAddress | undefined> {
  let cursor: string | undefined;
  const visited = new Set<string>();
  do {
    const result = await addressApi.list(cursor).promise;
    const found = result.items.find((item) => item.address_id === id);
    if (found) return found;
    if (!result.page.has_more) return undefined;
    cursor = result.page.next_cursor;
    if (!cursor || visited.has(cursor)) throw new Error('地址分页响应无效');
    visited.add(cursor);
  } while (cursor);
  return undefined;
}

export { ApiProblem } from './problem';

export const couponApi = {
  list: (status: Schema['MemberCoupon']['status'], cursor: string | null, type?: Schema['CouponType']) =>
    request<Schema['MemberCouponPage']>({ path: '/v1/me/coupons?page_size=20&status=' + encodeURIComponent(status) + (type ? '&coupon_type=' + type : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '') }),
  detail: (id: string) => request<Schema['CouponDetail']>({ path: '/v1/me/coupons/' + encodeURIComponent(id) }),
};
export const benefitApi = {
  summary: () => request<Schema['MemberDossier']>({path:'/v1/me/benefits'}),
  tasks: () => request<OwnGrowthTaskList>({ path: '/v1/me/growth-tasks' }),
  claimTask: (benefitCode: string, intent: string) => request<OwnGrowthTaskClaim, Record<string, never>>({
    path: '/v1/me/growth-tasks/' + encodeURIComponent(benefitCode) + '/claims', method: 'POST', body: {}, idempotencyKey: intent,
  }),
  checkIn: (intent:string) => request<Schema['CheckInReceipt'],Record<string,never>>({path:'/v1/me/check-ins',method:'POST',body:{},idempotencyKey:intent}),
  month: (month:string) => request<Schema['CheckInMonth']>({path:'/v1/me/check-ins?month='+encodeURIComponent(month)}),
  rule: () => request<Schema['CurrentCheckInRule']>({path:'/v1/me/check-in-rule'}),
  checkInDetail: (id: string) => request<Schema['CheckInReceipt']>({path:'/v1/me/check-ins/'+encodeURIComponent(id)}),
};
export type OwnPointEntry = Schema['OwnPointEntry'];
export const pointApi = {
  detail: (id: string) => request<Schema['PointEntryDetail']>({path:'/v1/me/point-entries/'+encodeURIComponent(id)}),
  list: (kind: 'PINK' | 'GROWTH', cursor: string | null, direction?: 'INCREASE' | 'DECREASE') =>
    request<Schema['OwnPointEntryPage']>({ path: '/v1/me/point-entries?point_kind=' + kind + '&page_size=20' + (direction ? '&direction=' + direction : '') + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '') }),
};
export { lotteryApi, redemptionApi, entitlementApi, loyaltyTraceApi } from './loyalty-api';
export { readLoyaltyIntent, prepareLoyaltyIntent, locateLoyaltyIntent, clearConfirmedLoyaltyIntent } from './loyalty-intent';
export { queryPendingLottery, queryPendingRedemptions, verifyLotteryResult, verifyRedemptionResult } from './loyalty-operation';
export { readGrowthTaskIntent, prepareGrowthTaskIntent, clearConfirmedGrowthTaskIntent } from './growth-task-intent';
