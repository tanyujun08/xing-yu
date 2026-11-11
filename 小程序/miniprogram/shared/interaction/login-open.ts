type LoginSheet = { open(): void };
type SheetHost = { selectComponent?(selector: string): unknown };

/** 登录统一在当前页弹出：页面里放了 <login-sheet id="login-sheet"> 就直接弹窗，否则才走原来的跳转。 */
export function openLoginHere(page: object, fallback: () => void): void {
  const sheet = (page as SheetHost).selectComponent?.('#login-sheet') as LoginSheet | null | undefined;
  if (sheet && typeof sheet.open === 'function') sheet.open();
  else fallback();
}

