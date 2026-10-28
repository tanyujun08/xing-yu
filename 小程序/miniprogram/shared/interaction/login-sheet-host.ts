type Sheet = { setSubmitting(value: boolean): void; setError(value: string): void; complete(): void };
type Host = { selectComponent(selector: string): unknown; isLoginHostActive?(): boolean };
const active = new WeakSet<object>();

export async function runLoginSheet(host: Host, login: () => Promise<void>, onSuccess: () => void | Promise<void>): Promise<void> {
  if (active.has(host)) return;
  const sheet = host.selectComponent('#login-sheet') as Sheet | null;
  if (!sheet) return;
  active.add(host);
  sheet.setSubmitting(true);
  try {
    await login();
  } catch (error) {
    sheet.setError(error instanceof Error ? error.message : '登录失败，请稍后重试');
    return;
  } finally {
    active.delete(host);
  }
  if (host.isLoginHostActive?.() === false) return;
  sheet.complete();
  try {
    await onSuccess();
  } catch {
    wx.showToast({ title: '登录成功，请刷新页面后重试', icon: 'none' });
  }
}

export function openLoginLegal(event: WechatMiniprogram.CustomEvent<{ legal: string }>): void {
  const legal = event.detail.legal;
  if (legal === 'user-agreement' || legal === 'privacy-policy')
    wx.navigateTo({ url: `/pages/info-guide/index?id=${encodeURIComponent(legal)}` });
}
