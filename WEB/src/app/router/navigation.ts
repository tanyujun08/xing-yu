import { permissions } from '../../shared/access/session';

export type AppRouteKey =
  | 'dashboard'
  | 'merchants'
  | 'cabinets'
  | 'catalog'
  | 'assets'
  | 'orders-contract-purchases'
  | 'orders-rental'
  | 'finance'
  | 'membership'
  | 'settings-rules'
  | 'settings-loyalty'
  | 'settings-coupons'
  | 'settings-lottery-prizes'
  | 'settings-admins'
  | 'settings-roles'
  | 'settings-login-logs'
  | 'settings-operation-logs';

export type NavigationGroupKey = 'orders' | 'settings';

export type NavigationIconKey =
  | 'dashboard'
  | 'shop'
  | 'device'
  | 'camera'
  | 'asset'
  | 'order'
  | 'wallet'
  | 'member'
  | 'settings';

export interface NavigationLeaf {
  kind: 'item';
  key: AppRouteKey;
  path: string;
  label: string;
  permission: string;
  icon?: NavigationIconKey;
  contextLabel?: string;
}

export interface NavigationGroup {
  kind: 'group';
  key: NavigationGroupKey;
  path: string;
  label: string;
  permission: string;
  icon: NavigationIconKey;
  children: readonly NavigationLeaf[];
}

export type NavigationNode = NavigationLeaf | NavigationGroup;

const SYSTEM_CHILDREN = [
  { kind: 'item', key: 'settings-coupons', path: '/settings/coupons', label: '优惠券管理', permission: 'ops.system_config.read' },
  { kind: 'item', key: 'settings-lottery-prizes', path: '/settings/lottery-prizes', label: '抽奖奖品管理', permission: 'ops.system_config.read' },
  {
    kind: 'item',
    key: 'settings-rules',
    path: '/settings/rules',
    label: '业务规则',
    permission: permissions.systemView,
  },
  {
    kind: 'item',
    key: 'settings-loyalty',
    path: '/settings/loyalty',
    label: '粉钻与签到',
    permission: permissions.systemView,
  },
  {
    kind: 'item',
    key: 'settings-admins',
    path: '/settings/admins',
    label: '管理员管理',
    permission: permissions.systemView,
  },
  {
    kind: 'item',
    key: 'settings-roles',
    path: '/settings/roles',
    label: '角色管理',
    permission: permissions.systemView,
  },
  {
    kind: 'item',
    key: 'settings-login-logs',
    path: '/settings/login-logs',
    label: '登录日志',
    permission: permissions.systemView,
  },
  {
    kind: 'item',
    key: 'settings-operation-logs',
    path: '/settings/operation-logs',
    label: '操作日志',
    permission: permissions.systemView,
  },
] as const satisfies readonly NavigationLeaf[];

const ORDER_CHILDREN = [
  { kind: 'item', key: 'orders-rental', path: '/orders/rental', label: '租赁订单', permission: 'ops.orders.read' },
  {
    kind: 'item',
    key: 'orders-contract-purchases',
    path: '/orders/contract-purchases',
    label: '购买合同订单',
    permission: 'ops.finance.read',
  },
] as const satisfies readonly NavigationLeaf[];

export const APP_NAVIGATION = [
  {
    kind: 'item',
    key: 'dashboard',
    path: '/',
    label: '运营工作台',
    permission: permissions.dashboardView,
    icon: 'dashboard',
    contextLabel: '平台经营管理',
  },
  {
    kind: 'item',
    key: 'merchants',
    path: '/merchants',
    label: '商家管理',
    permission: permissions.merchantView,
    icon: 'shop',
    contextLabel: '平台经营管理',
  },
  {
    kind: 'item',
    key: 'cabinets',
    path: '/cabinets',
    label: '租赁柜管理',
    permission: permissions.cabinetView,
    icon: 'device',
    contextLabel: '平台经营管理',
  },
  {
    kind: 'item',
    key: 'catalog',
    path: '/catalog',
    label: '商品管理',
    permission: permissions.catalogView,
    icon: 'camera',
    contextLabel: '平台经营管理',
  },
  {
    kind: 'item',
    key: 'assets',
    path: '/assets',
    label: '资产管理',
    permission: permissions.assetView,
    icon: 'asset',
    contextLabel: '平台经营管理',
  },
  {
    kind: 'group',
    key: 'orders',
    path: '/orders',
    label: '订单管理',
    permission: permissions.orderView,
    icon: 'order',
    children: ORDER_CHILDREN,
  },
  {
    kind: 'item',
    key: 'finance',
    path: '/finance',
    label: '财务与结算',
    permission: permissions.financeView,
    icon: 'wallet',
    contextLabel: '平台经营管理',
  },
  {
    kind: 'item',
    key: 'membership',
    path: '/membership',
    label: '用户与会员',
    permission: permissions.memberView,
    icon: 'member',
    contextLabel: '平台经营管理',
  },
  {
    kind: 'group',
    key: 'settings',
    path: '/settings',
    label: '系统配置',
    permission: permissions.systemView,
    icon: 'settings',
    children: SYSTEM_CHILDREN,
  },
] as const satisfies readonly NavigationNode[];

export interface NavigationMatch {
  leaf: NavigationLeaf;
  parent?: NavigationGroup;
  breadcrumbs: readonly string[];
}

function normalizePathname(pathname: string): string {
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '') || '/';
}

export function navigationLeaves(nodes: readonly NavigationNode[] = APP_NAVIGATION): NavigationLeaf[] {
  return nodes.flatMap((node) => node.kind === 'group' ? Array.from(node.children) : [node]);
}

export function resolveNavigation(pathname: string): NavigationMatch | undefined {
  const normalized = normalizePathname(pathname);

  for (const node of APP_NAVIGATION) {
    if (node.kind === 'item' && node.path === normalized) {
      return { leaf: node, breadcrumbs: [node.label] };
    }

    if (node.kind === 'group') {
      const leaf = node.children.find((child) => child.path === normalized);
      if (leaf !== undefined) {
        return { leaf, parent: node, breadcrumbs: [node.label, leaf.label] };
      }
    }
  }

  for (const node of APP_NAVIGATION) {
    if (node.kind === 'item' && node.path !== '/' && normalized.startsWith(`${node.path}/`)) {
      return { leaf: node, breadcrumbs: [node.label] };
    }
  }

  return undefined;
}

export function toChildRoutePath(path: string): string {
  return path === '/' ? '' : path.replace(/^\//, '');
}
