/** Local request storage identity. Business DTOs remain generated from OpenAPI. */
export type LoyaltyOperation = 'lottery' | 'coupon-redemption';

export interface LoyaltyIntent<TBody extends object = Record<string, unknown>> {
  owner: string;
  operation: LoyaltyOperation;
  key: string;
  resourceId: string | null;
  body: TBody;
  attemptId: string | null;
}

export function loyaltyIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[!-~]{1,64}$/.test(value);
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function jsonValue(value: unknown, ancestors: Set<object>, depth: number): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (!value || typeof value !== 'object' || depth > 8 || ancestors.has(value)) return false;
  if (!Array.isArray(value) && !plainRecord(value)) return false;
  ancestors.add(value);
  try {
    const keys = Object.keys(value);
    if (keys.length > 100 || Reflect.ownKeys(value).some(key => typeof key !== 'string')) return false;
    if (Array.isArray(value)) {
      return value.length <= 100 && keys.length === value.length
        && Reflect.ownKeys(value).length === value.length + 1
        && keys.every((key, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          return key === String(index) && !!descriptor && 'value' in descriptor
            && jsonValue(descriptor.value, ancestors, depth + 1);
        });
    }
    return keys.every(key => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return !!descriptor && 'value' in descriptor && jsonValue(descriptor.value, ancestors, depth + 1);
    }) && Reflect.ownKeys(value).length === keys.length;
  } finally {
    ancestors.delete(value);
  }
}

export function validLoyaltyBody(value: unknown): value is Record<string, unknown> {
  return plainRecord(value) && jsonValue(value, new Set(), 0);
}

/** Validate before JSON serialization so missing, unsafe or non-JSON values cannot disappear. */
export function snapshotLoyaltyBody<TBody extends object>(body: TBody): TBody {
  if (!validLoyaltyBody(body)) throw new Error('原请求内容不完整，尚未提交。');
  return JSON.parse(JSON.stringify(body)) as TBody;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (plainRecord(value)) {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function sameLoyaltyBody(left: unknown, right: unknown): boolean {
  return validLoyaltyBody(left) && validLoyaltyBody(right) && canonical(left) === canonical(right);
}

export function validLoyaltyIntent(value: unknown, owner: string, operation: LoyaltyOperation): value is LoyaltyIntent {
  if (!plainRecord(value) || Object.keys(value).length !== 6 || Reflect.ownKeys(value).length !== 6
    || !['owner', 'operation', 'key', 'resourceId', 'body', 'attemptId'].every(key => Object.prototype.hasOwnProperty.call(value, key))) return false;
  if (Object.keys(value).some(key => !Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, key), 'value'))) return false;
  return value['owner'] === owner && value['operation'] === operation
    && typeof value['key'] === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(value['key'])
    && (operation === 'lottery' ? value['resourceId'] === null : loyaltyIdentifier(value['resourceId']))
    && validLoyaltyBody(value['body'])
    && (value['attemptId'] === null || loyaltyIdentifier(value['attemptId']));
}

export function sameLoyaltyRequest(left: LoyaltyIntent<object>, right: LoyaltyIntent<object>): boolean {
  return left.owner === right.owner && left.operation === right.operation && left.key === right.key
    && left.resourceId === right.resourceId && sameLoyaltyBody(left.body, right.body);
}
