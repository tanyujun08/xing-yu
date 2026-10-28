export function RouteLoadingPage() {
  return <main className="route-message" role="status">正在加载页面…</main>;
}

export function ForbiddenPage() {
  return <main className="route-message"><strong>无权访问该页面。</strong><p>当前账号未包含所需权限，请联系管理员。</p></main>;
}

export function NotFoundPage() {
  return <main className="route-message"><strong>页面不存在。</strong><p>请检查地址或从左侧菜单打开页面。</p></main>;
}