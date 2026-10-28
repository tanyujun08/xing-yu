import { permissions, roleDefinitions, type DemoRole } from '../../shared/access/session';
import type { AuditEvent } from '../../shared/services';

export interface RoleProjection {
  role: string;
  label: string;
  description: string;
  permissions: readonly string[];
}

export interface LoginLogProjection {
  id: string;
  occurredAt: string;
  adminId: string;
  displayName: string;
  role: DemoRole | null;
  loginMethod: 'PHONE' | 'MINIPROGRAM_QR';
  source: string;
  status: 'SUCCESS' | 'FAILED';
  failureReason: string | null;
}

export const PERMISSION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  [permissions.dashboardView]: '经营工作台',
  [permissions.merchantView]: '查看商家',
  [permissions.merchantManage]: '管理商家',
  [permissions.cabinetView]: '查看柜机',
  [permissions.cabinetManage]: '管理柜机',
  [permissions.catalogView]: '查看商品',
  [permissions.catalogManage]: '管理商品',
  [permissions.assetView]: '查看资产',
  [permissions.assetManage]: '管理资产',
  [permissions.assetDeploy]: '资产投放',
  [permissions.orderView]: '查看订单',
  [permissions.memberView]: '查看会员',
  [permissions.memberManage]: '管理会员',
  [permissions.financeView]: '查看财务',
  [permissions.financeManage]: '管理结算',
  [permissions.systemView]: '查看系统',
  [permissions.systemManage]: '管理系统',
  [permissions.mockControl]: '重置场景',
});

const roleDescriptions: Record<DemoRole, string> = {
  SUPER_ADMIN: '管理后台全部模块与系统投影',
  OPERATIONS: '维护商家、柜机、资产、履约与会员投影',
  AFTER_SALES: '处理柜机、资产与订单售后履约',
  FINANCE: '查看订单并维护结算投影',
};

export const ROLE_PROJECTIONS: readonly RoleProjection[] = Object.freeze(
  (Object.entries(roleDefinitions) as Array<[DemoRole, (typeof roleDefinitions)[DemoRole]]>).map(
    ([role, definition]) => ({
      role,
      label: definition.label,
      description: roleDescriptions[role],
      permissions: definition.permissions,
    }),
  ),
);

export const LOGIN_LOG_PROJECTIONS: readonly LoginLogProjection[] = Object.freeze([
  { id: 'mock-login-012', occurredAt: '2026-08-25T08:42:00.000Z', adminId: 'mock-super-admin', displayName: '林运营', role: 'SUPER_ADMIN', loginMethod: 'PHONE', source: '192.0.2.12 · Mock Web', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-011', occurredAt: '2026-08-25T07:16:00.000Z', adminId: 'mock-operations-001', displayName: '周运营', role: 'OPERATIONS', loginMethod: 'MINIPROGRAM_QR', source: '192.0.2.34 · Mock QR', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-010', occurredAt: '2026-08-25T05:40:00.000Z', adminId: 'mock-after-sales-002', displayName: '李质检', role: 'AFTER_SALES', loginMethod: 'PHONE', source: '192.0.2.58 · Mock Web', status: 'FAILED', failureReason: '确定性演示：账号已锁定' },
  { id: 'mock-login-009', occurredAt: '2026-08-24T11:30:00.000Z', adminId: 'mock-operations-002', displayName: '宋巡检', role: 'OPERATIONS', loginMethod: 'PHONE', source: '192.0.2.45 · Mock Web', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-008', occurredAt: '2026-08-24T09:05:00.000Z', adminId: 'mock-after-sales-001', displayName: '陈售后', role: 'AFTER_SALES', loginMethod: 'PHONE', source: '192.0.2.19 · Mock Web', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-007', occurredAt: '2026-08-24T08:22:00.000Z', adminId: 'mock-finance-001', displayName: '王财务', role: 'FINANCE', loginMethod: 'MINIPROGRAM_QR', source: '192.0.2.81 · Mock QR', status: 'FAILED', failureReason: '确定性演示：二维码已失效' },
  { id: 'mock-login-006', occurredAt: '2026-08-23T03:38:00.000Z', adminId: 'mock-finance-002', displayName: '赵结算', role: 'FINANCE', loginMethod: 'MINIPROGRAM_QR', source: '192.0.2.76 · Mock QR', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-005', occurredAt: '2026-08-22T06:54:00.000Z', adminId: 'mock-after-sales-002', displayName: '李质检', role: 'AFTER_SALES', loginMethod: 'MINIPROGRAM_QR', source: '192.0.2.58 · Mock QR', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-004', occurredAt: '2026-08-21T10:08:00.000Z', adminId: 'mock-super-admin', displayName: '林运营', role: 'SUPER_ADMIN', loginMethod: 'PHONE', source: '192.0.2.12 · Mock Web', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-003', occurredAt: '2026-08-20T09:26:00.000Z', adminId: 'mock-operations-001', displayName: '周运营', role: 'OPERATIONS', loginMethod: 'PHONE', source: '192.0.2.34 · Mock Web', status: 'FAILED', failureReason: '确定性演示：验证码已过期' },
  { id: 'mock-login-002', occurredAt: '2026-08-19T04:12:00.000Z', adminId: 'mock-after-sales-001', displayName: '陈售后', role: 'AFTER_SALES', loginMethod: 'MINIPROGRAM_QR', source: '192.0.2.19 · Mock QR', status: 'SUCCESS', failureReason: null },
  { id: 'mock-login-001', occurredAt: '2026-08-18T02:30:00.000Z', adminId: 'mock-finance-001', displayName: '王财务', role: 'FINANCE', loginMethod: 'PHONE', source: '192.0.2.81 · Mock Web', status: 'SUCCESS', failureReason: null },
]);

function isDemoRole(value: unknown): value is DemoRole {
  return value === 'SUPER_ADMIN' || value === 'OPERATIONS' || value === 'AFTER_SALES' || value === 'FINANCE';
}

export function projectLoginLogs(events: readonly AuditEvent[]): LoginLogProjection[] {
  return events.flatMap((event) => {
    if (event.action !== 'ADMIN_LOGIN_SUCCEEDED' && event.action !== 'ADMIN_LOGIN_FAILED') return [];
    const { displayName, role, loginMethod, source, failureReason } = event.payload;
    if (typeof displayName !== 'string' || !isDemoRole(role)
      || (loginMethod !== 'PHONE' && loginMethod !== 'MINIPROGRAM_QR') || typeof source !== 'string') return [];
    return [{
      id: event.id,
      occurredAt: event.occurredAt,
      adminId: event.aggregateId,
      displayName,
      role,
      loginMethod,
      source,
      status: event.action === 'ADMIN_LOGIN_SUCCEEDED' ? 'SUCCESS' as const : 'FAILED' as const,
      failureReason: typeof failureReason === 'string' ? failureReason : null,
    }];
  });
}

interface AdminFilterRow {
  id: string;
  displayName: string;
  mobileMasked: string;
  role: DemoRole;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED';
  wechatBinding: {
    status: 'BOUND' | 'UNBOUND';
    nickname: string | null;
  };
}

export function filterAdmins<T extends AdminFilterRow>(
  rows: readonly T[],
  filters: { keyword?: string; role?: string; status?: string; wechatStatus?: string },
): T[] {
  const keyword = filters.keyword?.trim().toLocaleLowerCase('zh-CN') ?? '';
  return rows.filter((row) => {
    const matchesKeyword = keyword === '' || [row.displayName, row.id, row.mobileMasked, row.wechatBinding.nickname ?? '']
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword));
    return matchesKeyword && (filters.role === undefined || filters.role === '' || row.role === filters.role)
      && (filters.status === undefined || filters.status === '' || row.status === filters.status)
      && (filters.wechatStatus === undefined || filters.wechatStatus === '' || row.wechatBinding.status === filters.wechatStatus);
  });
}

export function filterRoles(rows: readonly RoleProjection[], keywordValue: string | undefined): RoleProjection[] {
  const keyword = keywordValue?.trim().toLocaleLowerCase('zh-CN') ?? '';
  if (keyword === '') return Array.from(rows);
  return rows.filter((row) => [row.label, row.role, row.description, ...row.permissions]
    .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword)));
}

export function filterLoginLogs(
  rows: readonly LoginLogProjection[],
  filters: { keyword?: string; method?: string; status?: string },
): LoginLogProjection[] {
  const keyword = filters.keyword?.trim().toLocaleLowerCase('zh-CN') ?? '';
  return rows.filter((row) => {
    const matchesKeyword = keyword === '' || [row.displayName, row.adminId, row.source]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword));
    return matchesKeyword
      && (filters.method === undefined || filters.method === '' || row.loginMethod === filters.method)
      && (filters.status === undefined || filters.status === '' || row.status === filters.status);
  });
}

export interface PaginatedRows<T> {
  current: number;
  pageSize: number;
  total: number;
  rows: T[];
}

export function paginateRows<T>(rows: readonly T[], requestedPage: number, pageSize: number): PaginatedRows<T> {
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));
  const current = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (current - 1) * safePageSize;
  return {
    current,
    pageSize: safePageSize,
    total: rows.length,
    rows: rows.slice(start, start + safePageSize),
  };
}

export function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    SCENARIO_SEEDED: '场景初始化',
    SCENARIO_RESET: '场景重置',
    MOCK_BEHAVIOR_CONFIGURED: 'Mock 请求行为配置',
    MOCK_CLOCK_ADVANCED: 'Mock 时钟推进',
    ADMIN_LOGIN_SUCCEEDED: '管理员登录成功',
    ADMIN_LOGIN_FAILED: '管理员登录失败',
    ADMIN_ROLE_SWITCHED: '管理员角色切换',
    ADMIN_CREATED: '新增管理员',
    BUSINESS_RULES_VERSION_CREATED: '保存规则版本',
    LOYALTY_RULES_VERSION_CREATED: '保存忠诚度版本',
    MERCHANT_CREATED: '新增商家',
    SITE_CREATED: '新增经营地址（旧版）',
    CABINET_CREATED: '新增柜机',
    ASSET_CREATED: '资产录入',
    ASSET_DEPLOYED: '资产投放',
  };
  return labels[action] ?? action;
}
