import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppTopbar } from './AppTopbar';
import './AppLayout.css';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="app-shell" data-sidebar-collapsed={sidebarCollapsed}>
      <AppSidebar collapsed={sidebarCollapsed} />
      <div className="app-main">
        <AppTopbar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
