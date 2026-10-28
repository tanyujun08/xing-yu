import { randomId } from '../../shared/randomId';
import { validLoyaltyIdempotencyKey } from './loyaltyInputs';

export interface LoyaltySaveIntent<TBody> {
  body: TBody;
  key: string;
}

type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Only the exact configuration request survives a reload; no session credential is stored. */
export class LoyaltySaveIntentStore<TBody> {
  constructor(private readonly storage: IntentStorage, private readonly validBody: (value: unknown) => value is TBody, private readonly newKey: () => string = () => randomId()) {}

  private storageKey(accountId: string, configKey: string) {
    if (accountId === '' || configKey === '') throw new Error('登录账号或配置标识缺失，不能保存配置。');
    return `xingyu-admin.loyalty-save.v1:${encodeURIComponent(accountId)}:${encodeURIComponent(configKey)}`;
  }

  read(accountId: string, configKey: string): LoyaltySaveIntent<TBody> | null {
    const raw = this.storage.getItem(this.storageKey(accountId, configKey));
    if (raw === null) return null;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error('原保存请求无法读取，请按操作记录核对结果后恢复。'); }
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1
      || !('accountId' in value) || value.accountId !== accountId || !('configKey' in value) || value.configKey !== configKey
      || !('key' in value) || typeof value.key !== 'string' || !validLoyaltyIdempotencyKey(value.key)
      || !('body' in value) || !this.validBody(value.body)) {
      throw new Error('原保存请求身份或内容无法核对，请先查询操作记录。');
    }
    return { key: value.key, body: structuredClone(value.body) };
  }

  begin(accountId: string, configKey: string, body: TBody): LoyaltySaveIntent<TBody> {
    const previous = this.read(accountId, configKey);
    // An uncertain save must keep its original body even if the caller has a newer draft.
    if (previous !== null) return previous;
    if (!this.validBody(body)) throw new Error('配置请求结构异常，未发送保存请求。');
    const key = this.newKey();
    if (!validLoyaltyIdempotencyKey(key)) throw new Error('保存请求标识无效，未发送保存请求。');
    const intent = { key, body: structuredClone(body) };
    this.storage.setItem(this.storageKey(accountId, configKey), JSON.stringify({ version: 1, accountId, configKey, ...intent }));
    const persisted = this.read(accountId, configKey);
    if (persisted === null || persisted.key !== intent.key || JSON.stringify(persisted.body) !== JSON.stringify(intent.body)) {
      throw new Error('原保存请求未完整保全，未发送保存请求，请先核对操作记录。');
    }
    return persisted;
  }

  resolve(accountId: string, configKey: string, key: string) {
    const previous = this.read(accountId, configKey);
    if (previous?.key !== key) return;
    this.storage.removeItem(this.storageKey(accountId, configKey));
    const remaining = this.read(accountId, configKey);
    if (remaining?.key === key) throw new Error('原保存请求清理未确认，请先核对操作记录。');
  }
}
