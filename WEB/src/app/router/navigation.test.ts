import { describe, expect, test } from 'vitest';
import { APP_NAVIGATION, navigationLeaves, resolveNavigation, toChildRoutePath } from './navigation';

describe('typed navigation metadata', () => {
  test('keeps settings routes without an independent material library', () => {
    const settings = APP_NAVIGATION.find((node) => node.kind === 'group' && node.key === 'settings');
    expect(settings?.kind).toBe('group');
    if (settings?.kind !== 'group') return;

    expect(settings.children.map((child) => child.path)).toEqual([
      '/settings/coupons',
      '/settings/lottery-prizes',
      '/settings/rules',
      '/settings/loyalty',
      '/settings/admins',
      '/settings/roles',
      '/settings/login-logs',
      '/settings/operation-logs',
    ]);
    expect(new Set(settings.children.map((child) => child.permission))).toEqual(new Set(['system.view', 'ops.system_config.read']));
    expect(resolveNavigation('/settings/materials')).toBeUndefined();
  });

  test('separates rental orders from service purchases under their actual read permissions', () => {
    const orders = APP_NAVIGATION.find((node) => node.kind === 'group' && node.key === 'orders');
    expect(orders?.kind).toBe('group');
    if (orders?.kind !== 'group') return;

    expect(orders.children.map((child) => child.path)).toEqual([
      '/orders/rental',
      '/orders/contract-purchases',
    ]);
    expect(new Set(orders.children.map((child) => child.permission))).toEqual(new Set(['ops.orders.read', 'ops.finance.read']));
  });

  test('resolves the active parent, leaf and breadcrumb trail', () => {
    expect(resolveNavigation('/settings/roles/')).toMatchObject({
      parent: { path: '/settings', label: '系统配置' },
      leaf: { path: '/settings/roles', label: '角色管理' },
      breadcrumbs: ['系统配置', '角色管理'],
    });
    expect(resolveNavigation('/orders/rentals')).toBeUndefined();
    expect(resolveNavigation('/orders/contract-purchases')).toMatchObject({
      parent: { path: '/orders', label: '订单管理' },
      leaf: { path: '/orders/contract-purchases', label: '购买合同订单' },
      breadcrumbs: ['订单管理', '购买合同订单'],
    });
  });

  test('keeps all navigable paths unique and router-relative', () => {
    const leaves = navigationLeaves();
    expect(new Set(leaves.map((leaf) => leaf.path)).size).toBe(leaves.length);
    expect(toChildRoutePath('/settings/login-logs')).toBe('settings/login-logs');
    expect(toChildRoutePath('/orders/rentals')).toBe('orders/rentals');
    expect(toChildRoutePath('/')).toBe('');
  });
});
