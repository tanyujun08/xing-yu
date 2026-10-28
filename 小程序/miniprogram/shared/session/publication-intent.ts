import { demoStorage } from '../../preview/storage';
import type { components } from '../../../types/api/schema';
import { newIdempotencyKey } from '../api/idempotency';
import { readStoredApiSession } from './api-session';

type AssetDraftInput = components['schemas']['AssetDraftInput'];
type EmptyBody = Record<string, never>;
export type PublicationCreateIntent =
  | { owner: string; kind: 'CREATE'; stage: 'PREPARED'; key: string; body: { asset: EmptyBody } }
  | { owner: string; kind: 'CREATE'; stage: 'LOCATED'; key: string; body: { asset: EmptyBody }; draftId: string; version: string };
export type PublicationSubmitIntent =
  | { owner: string; kind: 'SUBMIT'; stage: 'PREPARED'; key: string; body: EmptyBody; draftId: string; version: string }
  | { owner: string; kind: 'SUBMIT'; stage: 'LOCATED'; key: string; body: EmptyBody; draftId: string; version: string; resultVersion: string; assetId: string; revisionId: string };
export type PublicationUpdateIntent =
  | { owner: string; kind: 'UPDATE'; stage: 'PREPARED'; key: string; body: { asset: AssetDraftInput }; draftId: string; version: string }
  | { owner: string; kind: 'UPDATE'; stage: 'LOCATED'; key: string; body: { asset: AssetDraftInput }; draftId: string; version: string; resultVersion: string };

const prefix = 'xingyu.publication-intent.v1:';
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[!-~]{1,64}$/.test(value);
export const publicationVersion = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value)
  && (value.length < 20 || value <= '18446744073709551615');
const intentKey = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._:-]{16,64}$/.test(value);
const closed = (value: object, fields: readonly string[]) => {
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) && Object.keys(value).length === fields.length
    && fields.every(field => Object.prototype.hasOwnProperty.call(value, field));
};
const empty = (value: unknown): value is EmptyBody => !!value && typeof value === 'object' && !Array.isArray(value) && closed(value, []);
const greater = (left: string, right: string) => left.length > right.length || (left.length === right.length && left > right);

function assertOwner(owner: string): void {
  if (!opaque(owner) || readStoredApiSession()?.accountId !== owner) throw new Error('登录状态已变化，请重新读取。');
}
function createStorageKey(owner: string): string {
  assertOwner(owner);
  return prefix + encodeURIComponent(owner) + ':create';
}
function submitStorageKey(owner: string, draftId: string): string {
  assertOwner(owner);
  if (!opaque(draftId)) throw new Error('草稿标识无效，请重新读取。');
  return prefix + encodeURIComponent(owner) + ':submit:' + encodeURIComponent(draftId);
}
function updateStorageKey(owner: string, draftId: string): string {
  assertOwner(owner);
  if (!opaque(draftId)) throw new Error('草稿标识无效，请重新读取。');
  return prefix + encodeURIComponent(owner) + ':update:' + encodeURIComponent(draftId);
}
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 100 && value.every(item => jsonValue(item, depth + 1));
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const fields = Object.keys(value);
  return fields.length <= 100 && !fields.some(field => field === '__proto__' || field === 'prototype' || field === 'constructor')
    && fields.every(field => jsonValue((value as Record<string, unknown>)[field], depth + 1));
}
function asset(value: unknown): value is AssetDraftInput {
  return !!value && typeof value === 'object' && !Array.isArray(value) && jsonValue(value);
}
function validCreate(value: unknown, owner: string): value is PublicationCreateIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const intent = value as Partial<PublicationCreateIntent>;
  if (intent.owner !== owner || intent.kind !== 'CREATE' || !intentKey(intent.key) || !intent.body || !closed(intent.body, ['asset']) || !empty(intent.body.asset)) return false;
  if (intent.stage === 'PREPARED') return closed(intent, ['owner', 'kind', 'stage', 'key', 'body']);
  return intent.stage === 'LOCATED' && closed(intent, ['owner', 'kind', 'stage', 'key', 'body', 'draftId', 'version']) && opaque(intent.draftId) && publicationVersion(intent.version);
}
function validSubmit(value: unknown, owner: string, draftId: string): value is PublicationSubmitIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const intent = value as Partial<PublicationSubmitIntent>;
  if (intent.owner !== owner || intent.kind !== 'SUBMIT' || intent.draftId !== draftId || !publicationVersion(intent.version) || !intentKey(intent.key) || !empty(intent.body)) return false;
  if (intent.stage === 'PREPARED') return closed(intent, ['owner', 'kind', 'stage', 'key', 'body', 'draftId', 'version']);
  return intent.stage === 'LOCATED' && closed(intent, ['owner', 'kind', 'stage', 'key', 'body', 'draftId', 'version', 'resultVersion', 'assetId', 'revisionId']) && publicationVersion(intent.resultVersion)
    && greater(intent.resultVersion, intent.version) && opaque(intent.assetId) && opaque(intent.revisionId);
}
function validUpdate(value: unknown, owner: string, draftId: string): value is PublicationUpdateIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const intent = value as Partial<PublicationUpdateIntent>;
  if (intent.owner !== owner || intent.kind !== 'UPDATE' || intent.draftId !== draftId || !publicationVersion(intent.version)
    || !intentKey(intent.key) || !intent.body || !closed(intent.body, ['asset']) || !asset(intent.body.asset)) return false;
  if (intent.stage === 'PREPARED') return closed(intent, ['owner', 'kind', 'stage', 'key', 'body', 'draftId', 'version']);
  return intent.stage === 'LOCATED' && closed(intent, ['owner', 'kind', 'stage', 'key', 'body', 'draftId', 'version', 'resultVersion'])
    && publicationVersion(intent.resultVersion) && greater(intent.resultVersion, intent.version);
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function same(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }

export function readPublicationCreateIntent(owner: string): PublicationCreateIntent | null {
  const value: unknown = demoStorage.getStorageSync(createStorageKey(owner));
  if (value === undefined || value === null || value === '') return null;
  if (!validCreate(value, owner)) throw new Error('原新建草稿请求记录不完整，请先核实已有草稿。');
  return clone(value);
}
function storeCreate(intent: PublicationCreateIntent): PublicationCreateIntent {
  demoStorage.setStorageSync(createStorageKey(intent.owner), clone(intent));
  const readback = readPublicationCreateIntent(intent.owner);
  if (!readback || !same(readback, intent)) throw new Error('未能保存新建草稿请求，尚未提交。');
  return readback;
}
export function preparePublicationCreateIntent(owner: string): PublicationCreateIntent {
  const saved = readPublicationCreateIntent(owner);
  if (saved) return saved;
  const intent: PublicationCreateIntent = { owner, kind: 'CREATE', stage: 'PREPARED', key: newIdempotencyKey('publication-create'), body: { asset: {} } };
  if (!validCreate(intent, owner)) throw new Error('新建草稿请求未能建立。');
  return storeCreate(intent);
}
export function locatePublicationCreateIntent(intent: PublicationCreateIntent, draftId: string, version: string): PublicationCreateIntent {
  const saved = readPublicationCreateIntent(intent.owner);
  if (!saved || !same(saved, intent)) throw new Error('原新建草稿请求已变化，请重新核实。');
  if (saved.stage === 'LOCATED') {
    if (saved.draftId !== draftId || saved.version !== version) throw new Error('新建草稿定位结果不一致。');
    return saved;
  }
  const located: PublicationCreateIntent = { ...saved, stage: 'LOCATED', draftId, version };
  if (!validCreate(located, intent.owner)) throw new Error('新建草稿回执无效，请重试原请求。');
  return storeCreate(located);
}
export function releasePublicationCreateIntent(intent: PublicationCreateIntent): void {
  const saved = readPublicationCreateIntent(intent.owner);
  if (!saved || !same(saved, intent)) throw new Error('原新建草稿请求已变化，请重新核实。');
  demoStorage.removeStorageSync(createStorageKey(intent.owner));
  if (readPublicationCreateIntent(intent.owner)) throw new Error('草稿已回读，但原新建请求尚未清除。');
}

export function readPublicationUpdateIntent(owner: string, draftId: string): PublicationUpdateIntent | null {
  const value: unknown = demoStorage.getStorageSync(updateStorageKey(owner, draftId));
  if (value === undefined || value === null || value === '') return null;
  if (!validUpdate(value, owner, draftId)) throw new Error('原保存草稿请求记录不完整，请先核实草稿。');
  return clone(value);
}
function storeUpdate(intent: PublicationUpdateIntent): PublicationUpdateIntent {
  demoStorage.setStorageSync(updateStorageKey(intent.owner, intent.draftId), clone(intent));
  const readback = readPublicationUpdateIntent(intent.owner, intent.draftId);
  if (!readback || !same(readback, intent)) throw new Error('未能保存草稿修改请求，尚未提交。');
  return readback;
}
export function preparePublicationUpdateIntent(owner: string, draftId: string, version: string, draftAsset: AssetDraftInput): PublicationUpdateIntent {
  assertOwner(owner);
  if (!opaque(draftId) || !publicationVersion(version) || !asset(draftAsset)) throw new Error('草稿、版本或修改内容无效，请重新读取。');
  const frozenAsset = clone(draftAsset);
  const saved = readPublicationUpdateIntent(owner, draftId);
  if (saved) {
    if (saved.version !== version || !same(saved.body.asset, frozenAsset)) throw new Error('原保存草稿请求尚待核实，请使用原内容重试。');
    return saved;
  }
  const intent: PublicationUpdateIntent = {
    owner, kind: 'UPDATE', stage: 'PREPARED', key: newIdempotencyKey('publication-update'), body: { asset: frozenAsset }, draftId, version,
  };
  if (!validUpdate(intent, owner, draftId)) throw new Error('草稿修改请求未能建立。');
  return storeUpdate(intent);
}
export function locatePublicationUpdateIntent(intent: PublicationUpdateIntent, resultVersion: string): PublicationUpdateIntent {
  const saved = readPublicationUpdateIntent(intent.owner, intent.draftId);
  if (!saved || !same(saved, intent)) throw new Error('原保存草稿请求已变化，请重新核实。');
  if (saved.stage === 'LOCATED') {
    if (saved.resultVersion !== resultVersion) throw new Error('草稿修改定位结果不一致。');
    return saved;
  }
  const located: PublicationUpdateIntent = { ...saved, stage: 'LOCATED', resultVersion };
  if (!validUpdate(located, intent.owner, intent.draftId)) throw new Error('保存草稿回执无效，请重试原请求。');
  return storeUpdate(located);
}
function removeUpdate(intent: PublicationUpdateIntent): void {
  const saved = readPublicationUpdateIntent(intent.owner, intent.draftId);
  if (!saved || !same(saved, intent)) throw new Error('原保存草稿请求已变化，请重新核实。');
  demoStorage.removeStorageSync(updateStorageKey(intent.owner, intent.draftId));
  if (readPublicationUpdateIntent(intent.owner, intent.draftId)) throw new Error('草稿结果已核实，但原保存请求尚未清除。');
}
export function releasePublicationUpdateIntent(intent: PublicationUpdateIntent): void {
  if (intent.stage !== 'LOCATED') throw new Error('保存草稿结果尚未完成权威回读。');
  removeUpdate(intent);
}
export function releaseRejectedPublicationUpdateIntent(intent: PublicationUpdateIntent): void {
  if (intent.stage !== 'PREPARED') throw new Error('已定位的保存草稿请求不能按拒绝结果清除。');
  removeUpdate(intent);
}

export function readPublicationSubmitIntent(owner: string, draftId: string): PublicationSubmitIntent | null {
  const value: unknown = demoStorage.getStorageSync(submitStorageKey(owner, draftId));
  if (value === undefined || value === null || value === '') return null;
  if (!validSubmit(value, owner, draftId)) throw new Error('原提交审核请求记录不完整，请先核实草稿。');
  return clone(value);
}
function storeSubmit(intent: PublicationSubmitIntent): PublicationSubmitIntent {
  demoStorage.setStorageSync(submitStorageKey(intent.owner, intent.draftId), clone(intent));
  const readback = readPublicationSubmitIntent(intent.owner, intent.draftId);
  if (!readback || !same(readback, intent)) throw new Error('未能保存提交审核请求，尚未提交。');
  return readback;
}
export function preparePublicationSubmitIntent(owner: string, draftId: string, version: string): PublicationSubmitIntent {
  assertOwner(owner);
  if (!opaque(draftId) || !publicationVersion(version)) throw new Error('草稿或版本无效，请重新读取。');
  const saved = readPublicationSubmitIntent(owner, draftId);
  if (saved) {
    if (saved.version !== version) throw new Error('原提交审核请求尚待核实，请使用原请求重试。');
    return saved;
  }
  const intent: PublicationSubmitIntent = { owner, kind: 'SUBMIT', stage: 'PREPARED', key: newIdempotencyKey('publication-submit'), body: {}, draftId, version };
  if (!validSubmit(intent, owner, draftId)) throw new Error('提交审核请求未能建立。');
  return storeSubmit(intent);
}
export function locatePublicationSubmitIntent(intent: PublicationSubmitIntent, resultVersion: string, assetId: string, revisionId: string): PublicationSubmitIntent {
  const saved = readPublicationSubmitIntent(intent.owner, intent.draftId);
  if (!saved || !same(saved, intent)) throw new Error('原提交审核请求已变化，请重新核实。');
  if (saved.stage === 'LOCATED') {
    if (saved.resultVersion !== resultVersion || saved.assetId !== assetId || saved.revisionId !== revisionId) throw new Error('提交审核定位结果不一致。');
    return saved;
  }
  const located: PublicationSubmitIntent = { ...saved, stage: 'LOCATED', resultVersion, assetId, revisionId };
  if (!validSubmit(located, intent.owner, intent.draftId)) throw new Error('提交审核回执无效，请重试原请求。');
  return storeSubmit(located);
}
export function releasePublicationSubmitIntent(intent: PublicationSubmitIntent): void {
  const saved = readPublicationSubmitIntent(intent.owner, intent.draftId);
  if (!saved || !same(saved, intent)) throw new Error('原提交审核请求已变化，请重新核实。');
  demoStorage.removeStorageSync(submitStorageKey(intent.owner, intent.draftId));
  if (readPublicationSubmitIntent(intent.owner, intent.draftId)) throw new Error('提交结果已回读，但原请求尚未清除。');
}
