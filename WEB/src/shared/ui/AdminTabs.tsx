import { Tabs, type TabsProps } from 'tdesign-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import './AdminTabs.css';

export type AdminTabsVariant = 'line' | 'surface';

export interface AdminTabsProps extends TabsProps {
  children: ReactNode;
  variant?: AdminTabsVariant;
}

export function AdminTabs({ className = '', children, variant = 'line', ...props }: AdminTabsProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId().replaceAll(':', '');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const synchronizeAccessibility = () => {
      const tabList = host.querySelector<HTMLElement>('.t-tabs__nav-wrap');
      const tabs = [...host.querySelectorAll<HTMLElement>('.t-tabs__nav-item')];
      if (!tabList || tabs.length === 0) return;
      tabList.setAttribute('role', 'tablist');
      tabs.forEach((tab, index) => {
        const active = tab.classList.contains('t-is-active');
        const disabled = tab.classList.contains('t-is-disabled');
        const tabId = `${idPrefix}-tab-${index}`;
        tab.id = tabId;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(active));
        tab.setAttribute('aria-disabled', String(disabled));
        tab.tabIndex = active && !disabled ? 0 : -1;
      });
      const panel = host.querySelector<HTMLElement>('.t-tab-panel');
      const activeIndex = tabs.findIndex((tab) => tab.classList.contains('t-is-active'));
      if (panel && activeIndex >= 0) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', `${idPrefix}-tab-${activeIndex}`);
        panel.tabIndex = 0;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('.t-tabs__nav-item') : null;
      if (!target || !host.contains(target)) return;
      const tabs = [...host.querySelectorAll<HTMLElement>('.t-tabs__nav-item:not(.t-is-disabled)')];
      const index = tabs.indexOf(target);
      if (index < 0) return;
      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex !== null) {
        event.preventDefault();
        tabs[nextIndex]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        target.click();
      }
    };

    synchronizeAccessibility();
    const observer = new MutationObserver(synchronizeAccessibility);
    observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    host.addEventListener('keydown', handleKeyDown);
    return () => {
      observer.disconnect();
      host.removeEventListener('keydown', handleKeyDown);
    };
  }, [idPrefix]);

  return (
    <div ref={hostRef} className="xy-admin-tabs-host">
      <Tabs
        {...props}
        className={`xy-admin-tabs xy-admin-tabs--${variant} ${className}`.trim()}
      >
        {children}
      </Tabs>
    </div>
  );
}

export const AdminTabPanel = Tabs.TabPanel;
