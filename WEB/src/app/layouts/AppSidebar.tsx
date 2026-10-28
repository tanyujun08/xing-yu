import { useState, type ReactElement } from 'react';
import { Menu } from 'tdesign-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../shared/access/session';
import { APPLICATION_VERSION } from '../../shared/version';
import {
  CameraIcon,
  DashboardIcon,
  DeviceIcon,
  MemberIcon,
  OrderIcon,
  SettingIcon,
  ShopIcon,
  ViewInArIcon,
  WalletIcon,
} from '../../shared/design/icons';
import { APP_NAVIGATION, resolveNavigation, type NavigationIconKey } from '../router/navigation';

const navigationIcons: Record<NavigationIconKey, ReactElement> = {
  dashboard: <DashboardIcon />,
  shop: <ShopIcon />,
  device: <DeviceIcon />,
  camera: <CameraIcon />,
  asset: <ViewInArIcon />,
  order: <OrderIcon />,
  wallet: <WalletIcon />,
  member: <MemberIcon />,
  settings: <SettingIcon />,
};

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const active = resolveNavigation(location.pathname);
  const activeParentPath = active?.parent?.path;
  const [expanded, setExpanded] = useState<Array<string>>([]);
  const visibleExpanded = activeParentPath !== undefined && !expanded.includes(activeParentPath)
    ? [...expanded, activeParentPath]
    : expanded;

  const menuExpansionProps = collapsed
    ? { expandType: 'popup' as const }
    : {
        expandType: 'normal' as const,
        expanded: visibleExpanded,
        onExpand: (values: Array<string | number>) => setExpanded(values.map(String)),
      };

  return (
    <aside className="app-sidebar" aria-label="后台主导航">
      <div className="app-sidebar-brand">
        <span className="app-sidebar-brand-mark" aria-hidden="true">
          星
        </span>
        {collapsed ? null : (
          <div className="app-sidebar-brand-copy">
            <strong>星遇租赁</strong>
          </div>
        )}
      </div>

      <Menu
        className="app-sidebar-menu"
        collapsed={collapsed}
        theme="light"
        value={active?.leaf.path ?? ''}
        width={[272, 72]}
        onChange={(value) => navigate(String(value))}
        {...menuExpansionProps}
      >
        {APP_NAVIGATION.flatMap((item) => {
          if (item.kind === 'item') {
            return session.hasPermission(item.permission) && session.canAccessPath(item.path) ? [(
              <Menu.MenuItem
                {...(item.icon === undefined ? {} : { icon: navigationIcons[item.icon] })}
                key={item.path}
                value={item.path}
              >
                {item.label}
              </Menu.MenuItem>
            )] : [];
          }

          const visibleChildren = item.children.filter((child) => session.hasPermission(child.permission) && session.canAccessPath(child.path));
          if (visibleChildren.length === 0) return [];
          return [(
            <Menu.SubMenu icon={navigationIcons[item.icon]} key={item.path} title={item.label} value={item.path}>
              {visibleChildren.map((child) => (
                <Menu.MenuItem key={child.path} value={child.path}>
                  {child.label}
                </Menu.MenuItem>
              ))}
            </Menu.SubMenu>
          )];
        })}
      </Menu>

      <div className="app-sidebar-footer">
        <span>{collapsed ? `v${APPLICATION_VERSION.split('.').at(-1)}` : `v${APPLICATION_VERSION}`}</span>
      </div>
    </aside>
  );
}
