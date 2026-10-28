import { describe, expect, it } from 'vitest';
import { permissions, roleDefinitions } from './session';

describe('contract purchase and shared permissions', () => {
  it('仅财务人员与超管拥有购买合同资金动作权限', () => {
    expect(roleDefinitions.OPERATIONS.permissions).not.toContain(permissions.financeManage);
    expect(roleDefinitions.AFTER_SALES.permissions).not.toContain(permissions.financeManage);
    expect(roleDefinitions.FINANCE.permissions).toContain(permissions.financeManage);
  });

  it('所有后台角色都可读购买合同，超级管理员拥有资金动作权限', () => {
    Object.values(roleDefinitions).forEach((definition) => {
      expect(definition.permissions).toContain(permissions.orderView);
    });
    expect(roleDefinitions.SUPER_ADMIN.permissions).toContain(permissions.financeManage);
  });

  it('Mock 控制权限只授予超级管理员与运营人员', () => {
    expect(roleDefinitions.SUPER_ADMIN.permissions).toContain(permissions.mockControl);
    expect(roleDefinitions.OPERATIONS.permissions).toContain(permissions.mockControl);
    expect(roleDefinitions.AFTER_SALES.permissions).not.toContain(permissions.mockControl);
    expect(roleDefinitions.FINANCE.permissions).not.toContain(permissions.mockControl);
  });
});
