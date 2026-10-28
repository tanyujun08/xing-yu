import { createCursorList, type CursorList } from './cursor-list';
import { createRentalPageState } from './rental-page-state';
import { navigateBackWithFallback } from './navigate-once';
import { OperationDisposedError } from './operation-scope';
import { consumeOrderListContext } from './order-list-context';
import type { ListState } from '../model/view-state';
import type { PageResult } from '../model/pagination';
type Row = {
    id: string;
    destination?: 'contract' | 'detail';
};
type Filter = {
    role: 'TENANT' | 'LESSOR';
    display_status_code: string;
    physical_status?: 'NOT_DELIVERED' | 'OUTBOUND';
    asset_id?: string;
    cursor?: string | undefined;
};
type FilterOption = { id: string; label: string; displayStatus?: string; physicalStatus?: Filter['physical_status'] };
type OrderTabBar = { setData(data: { selected?: number; overlayHidden?: boolean }): void };
const filters = [{ id: '', label: '全部' }, { id: 'PREPARING', label: '待签约' }, { id: 'AWAITING_PAYMENT', label: '待支付' }, { id: 'AWAITING_DELIVERY', label: '待交付' }, { id: 'IN_USE', label: '租赁中' }, { id: 'RETURNING', label: '归还中' }, { id: 'RETURN_REVIEW', label: '归还审核' }, { id: 'AWAITING_SUPPLEMENT', label: '待补缴' }, { id: 'REFUND_PROCESSING', label: '退押中' }, { id: 'SETTLEMENT_CONFIRMING', label: '结算确认中' }, { id: 'COMPLETED', label: '已完成' }, { id: 'CLOSED', label: '已关闭' }];
const lessorFilters: FilterOption[] = [
    { id: '', label: '全部' },
    { id: 'AWAITING_DELIVERY', label: '待发货', physicalStatus: 'NOT_DELIVERED' },
    { id: 'RETURNING', label: '待收回' },
    { id: 'COMPLETED', label: '已完成' },
    { id: 'PREPARING', label: '待承租人签约' },
    { id: 'AWAITING_PAYMENT', label: '待承租人支付' },
    { id: 'OUTBOUND', label: '已发货', displayStatus: 'AWAITING_DELIVERY', physicalStatus: 'OUTBOUND' },
    ...filters.filter(item => ['IN_USE', 'RETURN_REVIEW', 'AWAITING_SUPPLEMENT', 'REFUND_PROCESSING', 'SETTLEMENT_CONFIRMING', 'CLOSED'].includes(item.id)),
];
const filterOptions = (role: 'rent' | 'lend'): FilterOption[] => role === 'lend' ? lessorFilters : filters;
const processingFilters = new Set(['AWAITING_DELIVERY', 'IN_USE', 'RETURNING', 'RETURN_REVIEW', 'AWAITING_SUPPLEMENT']);
function filterGroup(value: string, role: 'rent' | 'lend') {
    if (role === 'lend') return lessorFilters.slice(0, 4).some(item => item.id === value) ? '' : 'more';
    return !value || ['PREPARING', 'AWAITING_PAYMENT'].includes(value) ? '' : processingFilters.has(value) ? 'processing' : 'more';
}
export function createRentalOrdersPage<TSource extends {
    order_id: string;
}, TRow extends Row>(options: {
    currentOwner: () => string | null;
    load: (filter: Filter) => Promise<Omit<PageResult<TSource>, 'generation'>>;
    present: (source: TSource) => TRow;
    icons: object;
    assetScoped?: boolean;
    unread?: { show(page: object): void; hide(page: object): void };
}) {
    type CachedPage = { result: Omit<PageResult<TSource>, 'generation'>; scrollTop: number };
    const states = new WeakMap<object, ReturnType<typeof createRentalPageState<never>> & {
        list?: CursorList<TRow>;
        cache: Map<string, CachedPage>;
        roleFilters: { rent: string; lend: string };
        scrollTop: number;
        restoringScroll: boolean;
        listKey: string;
        filterTabBar?: OrderTabBar | undefined;
    }>();
    function state(page: object) { let value = states.get(page); if (!value) {
        value = { ...createRentalPageState<never>(), cache: new Map(), roleFilters: { rent: '', lend: '' }, scrollTop: 0, restoringScroll: false, listKey: '' };
        states.set(page, value);
    } return value; }
    const initial = { icons: options.icons, loggedIn: false, showLendTab: !options.assetScoped, role: 'rent' as 'rent' | 'lend', mode: 'lend', filter: '', filters: filters as FilterOption[], primaryFilters: filters.slice(0, 3) as FilterOption[], showProcessingFilter: true, activeFilterGroup: '', selectedFilterLabel: '', filterMenuOpen: false, filterMenuTitle: '', filterMenuOptions: [] as { id: string; label: string }[], items: [] as TRow[], listState: { phase: 'empty' } as ListState, title: '设备订单', missing: false, sheetOpen: false, recordGroups: [] as {
            title: string;
            items: TRow[];
        }[], expandedGroup: '', sheetTitle: '' };
    type Target = {
        data: typeof initial;
        setData(data: object): void;
        getTabBar?: () => OrderTabBar | undefined;
        makeList(): void;
        openOrder(event: WechatMiniprogram.TouchEvent): void;
    };
    function releaseFilterTabBar(page: Target) {
        const s = state(page), bar = s.filterTabBar;
        s.filterTabBar = undefined;
        bar?.setData({ overlayHidden: false });
    }
    return {
        data: initial,
        onLoad(this: Target, query: Record<string, string | undefined>) { state(this).id = query['assetId'] ?? query['id'] ?? ''; if (options.assetScoped) {
            const mode = query['mode'] === 'rent' ? 'rent' : 'lend';
            this.setData({ role: mode, mode, title: mode === 'rent' ? '我租的设备' : '我出租的设备', missing: false });
        } },
        onShow(this: Target) {
            options.unread?.show(this);
            if (!options.assetScoped) this.getTabBar?.()?.setData({ selected: 1 });
            const s = state(this), owner = options.currentOwner() ?? '';
            if (s.owner !== owner) {
                s.cache.clear(); s.roleFilters = { rent: '', lend: '' }; s.scrollTop = 0; s.listKey = '';
                this.setData({ filter: '', role: options.assetScoped ? this.data.mode : 'rent', items: [], sheetOpen: false, filterMenuOpen: false, recordGroups: [] });
            }
            const role = !options.assetScoped ? consumeOrderListContext(owner) : null;
            if (role && role !== this.data.role) this.setData({ role, filter: s.roleFilters[role] });
            s.show(owner); this.setData({ loggedIn: !!owner }); this.makeList();
        },
        onHide(this: Target) { options.unread?.hide(this); releaseFilterTabBar(this); const s = state(this), cached = s.cache.get(s.listKey); if (cached) cached.scrollTop = s.scrollTop; s.hide(); s.list?.dispose(); this.setData({ items: [], recordGroups: [], sheetOpen: false, filterMenuOpen: false }); },
        onUnload(this: Target) { options.unread?.hide(this); releaseFilterTabBar(this); const s = state(this); s.list?.dispose(); s.cache.clear(); s.dispose(); },
        onPageScroll(this: Target, event: { scrollTop: number }) { const s = state(this); if (s.visible && !s.restoringScroll && Number.isFinite(event.scrollTop)) { s.scrollTop = Math.max(0, event.scrollTop); const cached = s.cache.get(s.listKey); if (cached) cached.scrollTop = s.scrollTop; } },
        makeList(this: Target) { const available = filterOptions(this.data.role), selected = available.find(item => item.id === this.data.filter);
            releaseFilterTabBar(this);
            this.setData({ filters: available, primaryFilters: available.slice(0, this.data.role === 'lend' ? 4 : 3), showProcessingFilter: this.data.role === 'rent', activeFilterGroup: filterGroup(this.data.filter, this.data.role), selectedFilterLabel: selected?.label ?? '', filterMenuOpen: false, filterMenuOptions: [] }); const s = state(this); s.list?.dispose(); const epoch = s.epoch, owner = s.owner;
            const clearExpiredView = () => {
                if (!s.visible || s.scope.disposed || s.epoch !== epoch || s.owner !== owner || (options.currentOwner() ?? '') === owner) return;
                s.list?.dispose();
                releaseFilterTabBar(this);
                s.cache.clear(); s.roleFilters = { rent: '', lend: '' }; s.scrollTop = 0; s.listKey = '';
                this.setData({ loggedIn: false, items: [], recordGroups: [], sheetOpen: false, filterMenuOpen: false, sheetTitle: '', expandedGroup: '', listState: { phase: 'empty' } });
            };
            if ((options.currentOwner() ?? '') !== s.owner) { clearExpiredView(); return; }
            if (!s.owner || this.data.missing) {
            this.setData({ items: [], listState: { phase: 'empty' } });
            return;
        }
            const lease = s.capture(options.currentOwner), role = this.data.role === 'lend' ? 'LESSOR' : 'TENANT', filter = this.data.filter;
            const key = role + ':' + filter + ':' + s.id, cached = s.cache.get(key);
            s.listKey = key; s.scrollTop = cached?.scrollTop ?? 0; s.restoringScroll = true;
            const active = () => lease() && s.list === controller;
            let restoreCache = !!cached;
            const generation = owner + ':' + key;
            const readPage = async (cursor?: string) => {
                const result = await options.load({ role, display_status_code: selected?.displayStatus ?? filter, ...(selected?.physicalStatus ? { physical_status: selected.physicalStatus } : {}), cursor, ...(options.assetScoped && s.id ? { asset_id: s.id } : {}) });
                if (!active()) throw new Error('页面已关闭或账号已切换');
                return result;
            };
            const controller: CursorList<TRow> = createCursorList<TSource, TRow>({ load: async request => {
                try {
                    if (request.mode === 'initial' && restoreCache && cached) { restoreCache = false; return { ...cached.result, generation }; }
                    let result = await readPage(request.cursor ?? undefined);
                    if (request.mode === 'refresh') {
                        // Revalidate the loaded window, preserving its size and a current server cursor.
                        // Never issue one detail request per card or refresh unseen pages.
                        const wanted = s.cache.get(key)?.result.items.length ?? 0;
                        const seen = new Set(result.items.map(item => item.order_id)), cursors = new Set<string>();
                        while (result.items.length < wanted && result.hasMore && result.nextCursor) {
                            if (cursors.has(result.nextCursor)) throw new Error('分页游标重复，请重试刷新');
                            cursors.add(result.nextCursor);
                            const next = await readPage(result.nextCursor);
                            const additions = next.items.filter(item => { if (seen.has(item.order_id)) return false; seen.add(item.order_id); return true; });
                            result = { ...next, items: [...result.items, ...additions] };
                            if (!additions.length) break;
                        }
                    } else if (request.mode === 'load-more') {
                        const previous = s.cache.get(key)?.result;
                        if (previous) {
                            const ids = new Set(previous.items.map(item => item.order_id));
                            s.cache.set(key, { scrollTop: s.scrollTop, result: { ...result, items: [...previous.items, ...result.items.filter(item => !ids.has(item.order_id))] } });
                        }
                    }
                    if (request.mode !== 'load-more') s.cache.set(key, { result, scrollTop: s.scrollTop });
                    return { ...result, generation };
                } finally { if (!active()) clearExpiredView(); }
            }, present: options.present, getId: order => order.order_id, onPatch: patch => { if (!active()) {
                clearExpiredView(); return; } const data: Record<string, unknown> = { listState: patch.state }; if (patch.replace)
                data['items'] = patch.replace; for (const row of patch.append ?? [])
                data[row.path] = row.value; this.setData(data); } });
            s.list = controller;
            const restoreScroll = (scrollTop: number) => {
                const renderComplete = () => { if (!active()) return; wx.pageScrollTo?.({ scrollTop, duration: 0 }); s.restoringScroll = false; };
                if (wx.nextTick) wx.nextTick(renderComplete); else renderComplete();
            };
            void controller.initial().then(async () => {
                if (!active()) return;
                const scrollTop = s.scrollTop;
                restoreScroll(scrollTop);
                if (cached) await controller.refresh();
                if (active() && s.scrollTop === scrollTop) restoreScroll(scrollTop);
            }).catch((error: unknown) => {
                if (error instanceof OperationDisposedError || !active()) return;
                this.setData({ listState: controller.rows.length ? { phase: 'ready', incremental: 'refresh-error' } : { phase: 'initial-error', error: { code: 'LIST_REQUEST_FAILED', message: '订单加载失败，请重试', retryable: true } } });
            });
        },
        openFilterMenu(this: Target, event: WechatMiniprogram.TouchEvent) {
            if (!state(this).capture(options.currentOwner)()) return;
            const group = event.currentTarget.dataset['group']; if ((group !== 'processing' && group !== 'more') || (group === 'processing' && this.data.role === 'lend')) return;
            if (!options.assetScoped) {
                const s = state(this);
                s.filterTabBar ??= this.getTabBar?.();
                s.filterTabBar?.setData({ overlayHidden: true });
            }
            this.setData({ filterMenuOpen: true, filterMenuTitle: group === 'processing' ? '选择待处理状态' : '更多订单状态', filterMenuOptions: filterOptions(this.data.role).filter(item => filterGroup(item.id, this.data.role) === group) });
        },
        closeFilterMenu(this: Target) { releaseFilterTabBar(this); const s = state(this); if (s.visible && !s.scope.disposed) this.setData({ filterMenuOpen: false }); },
        chooseFilter(this: Target, event: WechatMiniprogram.TouchEvent) { if (!state(this).capture(options.currentOwner)()) return; releaseFilterTabBar(this); this.setData({ filterMenuOpen: false }); const filter = String(event.currentTarget.dataset['filter'] ?? ''); if (filterOptions(this.data.role).some(item => item.id === filter) && filter !== this.data.filter) {
            state(this).roleFilters[this.data.role] = filter;
            this.setData({ filter, items: [] });
            this.makeList();
        } },
        chooseRole(this: Target, event: WechatMiniprogram.TouchEvent) { if (!state(this).capture(options.currentOwner)()) return; const role = String(event.currentTarget.dataset['role']); if ((role === 'rent' || role === 'lend') && role !== this.data.role) {
            state(this).roleFilters[this.data.role] = this.data.filter;
            this.setData({ role, filter: state(this).roleFilters[role], items: [] });
            this.makeList();
        } },
        openOrder(this: Target, event: WechatMiniprogram.TouchEvent) { const s = state(this), id = String(event.currentTarget.dataset['id'] ?? ''), row = this.data.items.find(item => item.id === id); if (!s.capture(options.currentOwner)() || !row)
            return; const route = row.destination === 'contract' ? '/pages/contract/index?orderId=' : '/pages/order-detail/index?id=';
            s.navigation.navigateOnce('order', callbacks => wx.navigateTo({ url: route + encodeURIComponent(id), ...callbacks })); },
        openRental(this: Target, event: WechatMiniprogram.TouchEvent) { const s = state(this), id = String(event.currentTarget.dataset['id'] ?? ''), row = this.data.items.find(item => item.id === id); if (!row || !s.capture(options.currentOwner)())
            return; this.setData({ sheetOpen: true, sheetTitle: '订单信息', recordGroups: [{ title: '订单记录', items: [row] }], expandedGroup: '订单记录' }); }, openLogin(this: Target) { state(this).navigation.navigateOnce('login', callbacks => wx.navigateTo({ url: '/pages/login/index', ...callbacks })); }, goBack(this: Target) { navigateBackWithFallback(state(this).navigation); },
        retryInitial(this: Target) { void state(this).list?.initial(); }, retryRefresh(this: Target) { void state(this).list?.refresh(); }, retryLoadMore(this: Target) { void state(this).list?.loadMore(); }, onReachBottom(this: Target) { void state(this).list?.loadMore(); }, async onPullDownRefresh(this: Target) { try {
            await state(this).list?.refresh();
        }
        finally {
            wx.stopPullDownRefresh();
        } }, closeSheet(this: Target) { this.setData({ sheetOpen: false, recordGroups: [] }); }, toggleRecordGroup(this: Target, event: WechatMiniprogram.TouchEvent) { const title = String(event.currentTarget.dataset['title'] ?? ''); if (this.data.recordGroups.some(group => group.title === title))
            this.setData({ expandedGroup: this.data.expandedGroup === title ? '' : title }); },
    };
}
