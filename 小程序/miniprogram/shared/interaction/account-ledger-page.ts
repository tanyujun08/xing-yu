import { createCursorList, type CursorList, type CursorListPatch } from './cursor-list';
import { createNavigateOnce, navigateBackWithFallback } from './navigate-once';
import type { ListState } from '../model/view-state';

type Target = { setData(data: object): void };
type Handle<T> = { promise: Promise<T>; abort(): void };
type LedgerResponse = {
  account_id: string;
  items: { entry_id: string }[];
  page: { next_cursor: string | null };
};
interface LedgerSettings<T extends LedgerResponse, Row, Data extends object> {
  initial: Data;
  identity(): string | null;
  load(cursor: string | null, filter: string): Handle<T>;
  filters?: readonly string[];
  present(item: NoInfer<T>['items'][number]): Row;
  summary(value: NoInfer<T>): Partial<Data>;
  generation: string;
  loginURL: string;
}

/** Own-account read lifecycle. Transport and presentation are injected by the page. */
export function createAccountLedgerPage<T extends LedgerResponse, Row, Data extends object>(settings: LedgerSettings<T, Row, Data>) {
  interface Runtime {
    owner: string; filter: string; visible: boolean; requestVersion: number;
    handles: Set<{ abort(): void }>; list: CursorList<Row>;
  }
  const runtimes = new WeakMap<object, Runtime>();
  const navigation = new WeakMap<object, ReturnType<typeof createNavigateOnce>>();
  const visibility = new WeakMap<object, boolean>();
  const filters = new WeakMap<object, string>();
  const selected = (page: object) => filters.get(page) ?? settings.filters?.[0] ?? '';
  const empty = () => ({ ...settings.initial, items: [] as Row[], loggedIn: false, listState: { phase: 'empty' } as ListState });
  function nav(page: object) {
    let value = navigation.get(page);
    if (!value) { value = createNavigateOnce(); navigation.set(page, value); }
    return value;
  }
  function dispose(page: object) {
    const runtime = runtimes.get(page);
    if (!runtime) return;
    runtime.visible = false; runtime.list.dispose();
    for (const handle of runtime.handles) handle.abort();
    runtime.handles.clear(); runtimes.delete(page);
  }
  function clearPrivate(page: Target) { dispose(page); page.setData({ ...empty(), ...(settings.filters ? { ledgerFilter: selected(page) } : {}) }); }
  function current(page: object, runtime: Runtime) {
    return runtimes.get(page) === runtime && runtime.visible && visibility.get(page) === true && runtime.owner === settings.identity() && runtime.filter === selected(page);
  }
  function applyPatch(page: Target, patch: CursorListPatch<Row>) {
    const data: Record<string, unknown> = { listState: patch.state };
    if (patch.replace) data['items'] = patch.replace;
    for (const row of patch.append ?? []) data[row.path] = row.value;
    page.setData(data);
  }
  function ensure(page: Target): Runtime | undefined {
    if (visibility.get(page) !== true) return;
    const owner = settings.identity();
    if (!owner) { clearPrivate(page); return; }
    const old = runtimes.get(page);
    if (old && current(page, old)) return old;
    clearPrivate(page);
    const runtime: Runtime = {
      owner, filter: selected(page), visible: true, requestVersion: 0, handles: new Set(),
      list: createCursorList<T['items'][number], Row>({
        load: async request => {
          if (!current(page, runtime)) throw new Error('账户读取已取消');
          const version = ++runtime.requestVersion;
          const handle = settings.load(request.cursor, runtime.filter); runtime.handles.add(handle);
          try {
            const value = await handle.promise;
            if (runtimes.get(page) !== runtime || !runtime.visible) throw new Error('账户读取已取消');
            if (runtime.owner !== settings.identity()) { clearPrivate(page); throw new Error('账户已切换'); }
            if (!current(page, runtime) || version !== runtime.requestVersion) throw new Error('账户读取已取消');
            if (value.account_id !== owner) throw new Error('账户响应不一致');
            const summary = settings.summary(value);
            value.items.forEach(settings.present);
            if (value.items.some(item=>'account_id' in item&&item.account_id!==owner)) throw new Error('流水响应主体不一致');
            page.setData(summary);
            return { items: value.items, hasMore: value.page.next_cursor!==null, nextCursor: value.page.next_cursor, generation: owner + ':' + settings.generation + ':' + runtime.filter };
          } finally { runtime.handles.delete(handle); }
        },
        present: settings.present, getId: item => item.entry_id,
        onPatch: patch => {
          if (runtimes.get(page) !== runtime || !runtime.visible) return;
          if (owner !== settings.identity()) { clearPrivate(page); return; }
          applyPatch(page, patch);
        },
      }),
    };
    runtimes.set(page, runtime); page.setData({ loggedIn: true }); return runtime;
  }
  return {
    data: empty(),
    onLoad(this: Target) { visibility.set(this, true); nav(this); },
    async onShow(this: Target) {
      visibility.set(this, true); clearPrivate(this); await ensure(this)?.list.initial();
    },
    onHide(this: Target) { visibility.set(this, false); clearPrivate(this); },
    onUnload(this: Target) { visibility.set(this, false); clearPrivate(this); navigation.get(this)?.dispose(); navigation.delete(this); visibility.delete(this); filters.delete(this); },
    async onPullDownRefresh(this: Target) { try { await ensure(this)?.list.refresh(); } finally { wx.stopPullDownRefresh(); } },
    onReachBottom(this: Target) { const runtime = runtimes.get(this); return runtime && current(this, runtime) ? runtime.list.loadMore() : Promise.resolve(); },
    retryInitial(this: Target) { return ensure(this)?.list.initial(); },
    retryRefresh(this: Target) { return ensure(this)?.list.refresh(); },
    retryLoadMore(this: Target) { const runtime = runtimes.get(this); return runtime && current(this, runtime) ? runtime.list.loadMore() : Promise.resolve(); },
    async changeLedgerFilter(this: Target, value: string) {
      if (visibility.get(this) !== true || !settings.identity() || !settings.filters?.includes(value) || value === selected(this)) return;
      filters.set(this, value); clearPrivate(this); await ensure(this)?.list.initial();
    },
    openLogin(this: Target) { if (visibility.get(this) === true) nav(this).navigateOnce('login', callbacks => wx.navigateTo({ url: settings.loginURL, ...callbacks })); },
    onSecondaryNavigationBack(this: Target) { if (visibility.get(this) === true) navigateBackWithFallback(nav(this)); },
    navigateLedger(this: Target, url: string) {
      const runtime = runtimes.get(this);
      if (!runtime || !current(this, runtime)) return;
      nav(this).navigateOnce(url, callbacks => wx.navigateTo({ url, ...callbacks }));
    },
  };
}
