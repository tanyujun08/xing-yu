import { ApiProblem } from '../api/problem';
import type { LoyaltyConfigConflict } from './loyaltyManagement';

const definitiveCodes = new Set([
  'FORMAT_INVALID', 'RANGE_INVALID', 'PROBABILITY_SUM_INVALID', 'PRIZE_OUT_OF_STOCK',
  'COUPON_DISABLED', 'CONFIG_VERSION_CONFLICT', 'VALIDATION_FAILED', 'CONFIG_DEPENDENCY_CONFLICT',
  'VERSION_CONFLICT', 'RESOURCE_CONFLICT',
]);

export function isLoyaltySaveRejected(error: unknown): boolean {
  return error instanceof ApiProblem && [400, 409, 422].includes(error.status) && definitiveCodes.has(error.code);
}

// Aliases locate form controls only; the original Problem field stays intact.
function controlFieldPath(field: string): string { return field.replace(/^value\./, '').replace(/\[(\d+)\]/g, '.$1'); }

function isConfigConflict(value: unknown): value is LoyaltyConfigConflict {
  if (typeof value !== 'object' || value === null || Object.keys(value).length !== 5) return false;
  if (!('field' in value) || typeof value.field !== 'string' || !/^value\.coupons\[[0-3]\]\.enabled$/.test(value.field)
    || !('coupon_type' in value) || !['DEPOSIT_WAIVER', 'PUBLISH_ONCE', 'ONE_DAY_RENT', 'GUARD_DISCOUNT'].some((type) => type === value.coupon_type)
    || !('source_kind' in value) || !('source_config_key' in value)
    || !('source_config_version_id' in value) || typeof value.source_config_version_id !== 'string' || value.source_config_version_id.trim() === '' || value.source_config_version_id.length > 64) return false;
  return value.source_kind === 'LOTTERY' && value.source_config_key === 'benefits.lottery'
    || value.source_kind === 'CHECK_IN' && value.source_config_key === 'benefits.check_in'
    || (value.source_kind === 'PROGRESS' || value.source_kind === 'REDEMPTION') && value.source_config_key === 'benefits.catalog';
}

export function loyaltyFailure(error: unknown): { message: string; requestId: string | null; field: string | null; fieldErrors: Record<string, string>; configConflicts: LoyaltyConfigConflict[]; configConflictError: string | null } {
  if (!(error instanceof ApiProblem)) return { message: error instanceof Error ? error.message : '服务暂不可用，请重试读取或恢复原保存请求。', requestId: null, field: null, fieldErrors: {}, configConflicts: [], configConflictError: null };
  let message = error.message;
  if (error.status === 403) message = '当前账号没有访问权限，请核对登录身份；原保存结果仍须查询确认。';
  else if (error.status === 401) message = '登录已失效，请重新登录后核对原保存结果。';
  else if (error.status === 404) message = '未找到该记录，请核对完整编号。';
  else if (error.code === 'CONFIG_VERSION_CONFLICT' || error.code === 'VERSION_CONFLICT') message = '当前配置版本已变化，本地输入已保留；请查看差异并基于最新配置重新确认。';
  else if (error.code === 'IDEMPOTENCY_CONFLICT') message = '原保存请求发生内容冲突，请查询原操作记录，不能自动创建新请求。';
  else if (error.status === 0 || error.status >= 500 || error.code === 'IDEMPOTENCY_PENDING') message = '保存结果尚未确认，请恢复原保存或查询原操作记录。';
  const field = typeof error.details?.field === 'string' ? error.details.field : null;
  const fieldErrors: Record<string, string> = {};
  const locate = (path: string, reason: string) => { fieldErrors[path] = reason; fieldErrors[controlFieldPath(path)] = reason; };
  if (Array.isArray(error.details?.errors)) for (const item of error.details.errors as unknown[]) {
    if (typeof item === 'object' && item !== null && 'field' in item && typeof item.field === 'string' && 'reason' in item && typeof item.reason === 'string') locate(item.field, item.reason);
  }
  if (field !== null) locate(field, error.message);
  let configConflicts: LoyaltyConfigConflict[] = []; let configConflictError: string | null = null;
  if (error.status === 409 && error.code === 'RESOURCE_CONFLICT' && error.details !== undefined && 'config_conflicts' in error.details) {
    const details = error.details.config_conflicts;
    if (Array.isArray(details) && details.length >= 1 && details.length <= 16 && details.every(isConfigConflict)) {
      configConflicts = details; for (const conflict of configConflicts) locate(conflict.field, error.message);
    } else configConflictError = '服务端来源冲突详情无法核对，请凭请求编号查询；本地草稿已保留。';
  }
  return { message, requestId: error.requestId, field, fieldErrors, configConflicts, configConflictError };
}
