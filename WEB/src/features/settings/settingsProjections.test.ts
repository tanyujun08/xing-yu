import { describe, expect, test } from 'vitest';
import {
  auditActionLabel,
  filterAdmins,
  filterLoginLogs,
  filterRoles,
  LOGIN_LOG_PROJECTIONS,
  paginateRows,
  projectLoginLogs,
  ROLE_PROJECTIONS,
} from './settingsProjections';

describe('deterministic settings projections', () => {
  test('filters administrators by keyword, role and state without mutating the source', () => {
    const administrators = [
      { id: 'mock-super-admin', displayName: '林运营', mobileMasked: '138****1001', role: 'SUPER_ADMIN', status: 'ACTIVE', wechatBinding: { status: 'BOUND', nickname: '林小星' } },
      { id: 'mock-after-sales-001', displayName: '陈售后', mobileMasked: '138****1004', role: 'AFTER_SALES', status: 'ACTIVE', wechatBinding: { status: 'UNBOUND', nickname: null } },
      { id: 'mock-after-sales-002', displayName: '李质检', mobileMasked: '138****1005', role: 'AFTER_SALES', status: 'LOCKED', wechatBinding: { status: 'BOUND', nickname: '李质检微信' } },
    ] as const;
    const sourceIds = administrators.map((row) => row.id);
    const filtered = filterAdmins(administrators, {
      keyword: '售后',
      role: 'AFTER_SALES',
      status: 'ACTIVE',
      wechatStatus: 'UNBOUND',
    });

    expect(filtered.map((row) => row.id)).toEqual(['mock-after-sales-001']);
    expect(administrators.map((row) => row.id)).toEqual(sourceIds);
  });

  test('finds an administrator by bound WeChat nickname', () => {
    const administrators = [
      { id: 'mock-super-admin', displayName: '林运营', mobileMasked: '138****1001', role: 'SUPER_ADMIN', status: 'ACTIVE', wechatBinding: { status: 'BOUND', nickname: '林小星' } },
    ] as const;
    expect(filterAdmins(administrators, { keyword: '小星', wechatStatus: 'BOUND' })).toHaveLength(1);
  });

  test('filters login logs using only deterministic Mock fields', () => {
    const filtered = filterLoginLogs(LOGIN_LOG_PROJECTIONS, {
      keyword: '林运营',
      method: 'PHONE',
      status: 'SUCCESS',
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((row) => row.adminId === 'mock-super-admin')).toBe(true);
  });

  test('projects dynamic login attempts from the append-only audit stream', () => {
    const projected = projectLoginLogs([{
      id: 'audit-login-runtime',
      sequence: 99,
      aggregateType: 'ADMIN_SESSION',
      aggregateId: 'mock-operations-001',
      action: 'ADMIN_LOGIN_FAILED',
      actorId: 'mock-operations-001',
      occurredAt: '2026-08-28T09:30:00.000Z',
      payload: {
        displayName: '周运营',
        role: 'OPERATIONS',
        loginMethod: 'PHONE',
        source: '192.0.2.12 · Mock Web',
        status: 'FAILED',
        failureReason: 'Mock 注入：请求处理超时',
      },
    }]);
    expect(projected).toEqual([expect.objectContaining({
      id: 'audit-login-runtime',
      adminId: 'mock-operations-001',
      role: 'OPERATIONS',
      status: 'FAILED',
      failureReason: 'Mock 注入：请求处理超时',
    })]);
  });

  test('finds roles by permission and clamps pagination after filtering', () => {
    expect(filterRoles(ROLE_PROJECTIONS, 'finance.manage').map((row) => row.role)).toEqual([
      'SUPER_ADMIN',
      'FINANCE',
    ]);

    expect(paginateRows(['a', 'b', 'c'], 99, 2)).toEqual({
      current: 2,
      pageSize: 2,
      total: 3,
      rows: ['c'],
    });
  });

  test('renders versioned rule and administrator audit actions as readable labels', () => {
    expect(auditActionLabel('ADMIN_CREATED')).toBe('新增管理员');
    expect(auditActionLabel('BUSINESS_RULES_VERSION_CREATED')).toBe('保存规则版本');
    expect(auditActionLabel('LOYALTY_RULES_VERSION_CREATED')).toBe('保存忠诚度版本');
  });
});
