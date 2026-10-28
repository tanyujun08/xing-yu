import { useState } from 'react';
import { Avatar, Button, Dropdown, Input, MessagePlugin, Tag } from 'tdesign-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../shared/access/session';
import {
  ChevronDownIcon,
  HelpCircleIcon,
  LogoutIcon,
  MenuFoldIcon,
  MenuUnfoldIcon,
  NotificationIcon,
  SearchIcon,
} from '../../shared/design/icons';
import { resolveNavigation } from '../router/navigation';
import { MockControlDrawer } from '../../shared/ui/MockControlDrawer';

export function AppTopbar(props: { sidebarCollapsed: boolean; onToggleSidebar: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const canControlMock = false;
  const [mockControlOpen, setMockControlOpen] = useState(false);
  const navigation = resolveNavigation(location.pathname);
  const title = navigation?.leaf.label ?? '星遇租赁管理后台';
  const contextLabel = navigation?.parent === undefined
    ? (navigation?.leaf.contextLabel ?? '平台经营管理')
    : navigation.breadcrumbs.join(' / ');

  return (
    <header className="app-topbar">
      <div className="app-topbar-title-group">
        <Button
          aria-label={props.sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          icon={props.sidebarCollapsed ? <MenuUnfoldIcon /> : <MenuFoldIcon />}
          shape="square"
          theme="default"
          variant="text"
          onClick={props.onToggleSidebar}
        />
        <div>
          <strong>{title}</strong>
          <span>{contextLabel}</span>
        </div>
      </div>

      <div className="app-topbar-actions">
        <Tag className="app-mock-environment-tag" size="large" theme="warning" variant="light-outline">
          <span className="app-mock-environment-tag__full">独立 MOCK · 视觉预览</span>
          <span className="app-mock-environment-tag__compact">MOCK</span>
        </Tag>
        <label className="app-topbar-search-field">
          <span>全局搜索</span>
          <Input
            className="app-topbar-search"
            placeholder="商家、柜机、资产或订单"
            prefixIcon={<SearchIcon />}
            type="search"
            onEnter={(value) => void MessagePlugin.info(`全局搜索：${String(value) || '请输入关键词'}`)}
          />
        </label>
        <Button
          aria-label="帮助"
          icon={<HelpCircleIcon />}
          shape="square"
          theme="default"
          variant="text"
          onClick={() => void MessagePlugin.info('帮助中心暂未开放')}
        />
        <Button
          aria-label="通知"
          icon={<NotificationIcon />}
          shape="square"
          theme="default"
          variant="text"
          onClick={() => void MessagePlugin.info('暂无新通知')}
        />
        <Dropdown
          minColumnWidth={168}
          options={[
            ...(canControlMock
              ? [{
                  content: 'Mock 场景控制',
                  theme: 'default' as const,
                  value: 'mock-control',
                }]
              : []),
            {
              content: '退出后台',
              prefixIcon: <LogoutIcon />,
              theme: 'default',
              value: 'logout',
            },
          ]}
          placement="bottom-right"
          trigger="click"
          onClick={(item) => {
            if (item.value === 'mock-control') {
              if (!canControlMock) {
                void MessagePlugin.warning('当前身份无权使用 Mock 场景控制');
                return;
              }
              setMockControlOpen(true);
              return;
            }
            if (item.value !== 'logout') return;
            void session.logout().catch(() => { void MessagePlugin.warning('本机已退出，服务端撤销未确认；请勿继续使用旧会话。'); });
            navigate('/login', { replace: true });
          }}
        >
          <Button
            aria-label={`账户菜单：${session.displayName ?? '平台管理员'}`}
            className="app-account-button"
            theme="default"
            variant="text"
          >
            <Avatar className="app-account-avatar" size="32px">{session.displayName?.slice(0, 1) ?? '管'}</Avatar>
            <span className="app-account-name">{session.displayName ?? '平台管理员'}</span>
            <span className="app-account-chevron" aria-hidden="true"><ChevronDownIcon /></span>
          </Button>
        </Dropdown>
      </div>
      {canControlMock ? (
        <MockControlDrawer visible={mockControlOpen} onClose={() => setMockControlOpen(false)} />
      ) : null}
    </header>
  );
}
