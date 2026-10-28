import { afterEach, expect, test, vi } from 'vitest';
import { createRentalOrdersPage } from '../miniprogram/shared/interaction/rental-orders-page';

type Result = { items: { order_id: string }[]; hasMore: boolean; nextCursor: string | null };
function deferred() {
    let resolve!: (value: Result) => void, reject!: (error: Error) => void;
    return { promise: new Promise<Result>((done, fail) => { resolve = done; reject = fail; }), resolve, reject };
}
function harness(assetScoped = false) {
    const owner = { value: 'first' as string | null };
    const load = vi.fn<(filter: { role: string; display_status_code: string; cursor?: string | undefined }) => Promise<Result>>();
    load.mockResolvedValue({ items: [{ order_id: 'old-order' }], hasMore: true, nextCursor: 'next' });
    vi.stubGlobal('wx', { stopPullDownRefresh: vi.fn(), navigateTo: vi.fn(), pageScrollTo: vi.fn() });
    const definition = createRentalOrdersPage({ currentOwner: () => owner.value, load, present: value => ({ id: value.order_id }), icons: {}, assetScoped });
    const page = { ...definition, data: structuredClone(definition.data), setData(patch: object) {
        for (const [key, value] of Object.entries(patch)) {
            const row = /^items\[(\d+)\]$/.exec(key);
            if (row) this.data.items[Number(row[1])] = value;
            else Object.assign(this.data, { [key]: value });
        }
    } };
    page.onLoad({ assetId: 'asset' });
    return { owner, load, page };
}
afterEach(() => vi.unstubAllGlobals());

const selection = (key: string, value: string) => ({ currentTarget: { dataset: { [key]: value } } }) as unknown as WechatMiniprogram.TouchEvent;

test.each(['dismiss', 'select', 'role', 'hide', 'unload'] as const)('filter overlay hides the native tab bar and restores it on %s', async exit => {
    const { page, load } = harness();
    const bar = { setData: vi.fn() };
    Object.assign(page, { getTabBar: () => bar });
    page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    page.openFilterMenu(selection('group', 'more'));
    expect(bar.setData).toHaveBeenLastCalledWith({ overlayHidden: true });
    expect(load).toHaveBeenCalledOnce();
    if (exit === 'dismiss') page.closeFilterMenu();
    else if (exit === 'select') page.chooseFilter(selection('filter', 'CLOSED'));
    else if (exit === 'role') page.chooseRole(selection('role', 'lend'));
    else if (exit === 'hide') page.onHide();
    else page.onUnload();
    expect(bar.setData).toHaveBeenLastCalledWith({ overlayHidden: false });
    if (exit !== 'unload') { expect(page.data.filterMenuOpen).toBe(false); page.onUnload(); }
});

test('expired list session releases its captured tab bar without changing a replacement page bar', async () => {
    const { page, load, owner } = harness(), pending = deferred();
    const original = { setData: vi.fn() }, replacement = { setData: vi.fn() };
    let current = original;
    Object.assign(page, { getTabBar: () => current });
    page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    load.mockReturnValueOnce(pending.promise); page.onReachBottom();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    page.openFilterMenu(selection('group', 'more'));
    current = replacement; owner.value = null; pending.reject(new Error('expired'));
    await vi.waitFor(() => expect(page.data.loggedIn).toBe(false));
    expect(original.setData).toHaveBeenLastCalledWith({ overlayHidden: false });
    expect(replacement.setData).not.toHaveBeenCalled(); page.onUnload();
});

test('asset-scoped order panels never hide a root tab bar', async () => {
    const { page } = harness(true), bar = { setData: vi.fn() };
    Object.assign(page, { getTabBar: () => bar });
    page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    page.openFilterMenu(selection('group', 'more')); page.closeFilterMenu(); page.onHide(); page.onUnload();
    expect(bar.setData).not.toHaveBeenCalled();
});

test('returning to orders revalidates the loaded window and continues its own cursor and scroll', async () => {
    const { load, page } = harness();
    load.mockImplementation(async filter => ({ items: [{ order_id: filter.cursor === 'page-2' ? 'two' : filter.cursor === 'page-3' ? 'three' : 'one' }], hasMore: filter.cursor !== 'page-3', nextCursor: filter.cursor === 'page-3' ? null : filter.cursor === 'page-2' ? 'page-3' : 'page-2' }));
    page.onShow(); await vi.waitFor(() => expect(page.data.items).toEqual([{ id: 'one' }]));
    page.onReachBottom(); await vi.waitFor(() => expect(page.data.items).toHaveLength(2));
    page.onPageScroll({ scrollTop: 415 }); page.onHide(); expect(page.data.items).toEqual([]);
    page.onShow(); await vi.waitFor(() => { expect(load).toHaveBeenCalledTimes(4); expect(page.data.listState).toMatchObject({ phase: 'ready', incremental: 'idle' }); });
    expect(page.data.items).toEqual([{ id: 'one' }, { id: 'two' }]);
    expect(wx.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 415, duration: 0 });
    page.onReachBottom(); await vi.waitFor(() => expect(page.data.items).toHaveLength(3));
    expect(load.mock.lastCall?.[0].cursor).toBe('page-3'); page.onUnload();
});

test('tenant and lessor each restore their own filter and scroll without per-card reads', async () => {
    const { load, page } = harness();
    load.mockImplementation(async filter => ({ items: [{ order_id: filter.role + ':' + filter.display_status_code }], hasMore: false, nextCursor: null }));
    page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    page.chooseFilter(selection('filter', 'IN_USE')); await vi.waitFor(() => expect(page.data.items[0]?.id).toBe('TENANT:IN_USE'));
    page.onPageScroll({ scrollTop: 380 });
    page.chooseRole(selection('role', 'lend')); await vi.waitFor(() => expect(page.data.items[0]?.id).toBe('LESSOR:'));
    page.chooseFilter(selection('filter', 'COMPLETED')); await vi.waitFor(() => expect(page.data.items[0]?.id).toBe('LESSOR:COMPLETED'));
    page.onPageScroll({ scrollTop: 190 });
    page.chooseRole(selection('role', 'rent')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(5));
    expect(page.data.filter).toBe('IN_USE'); expect(page.data.items).toEqual([{ id: 'TENANT:IN_USE' }]);
    expect(wx.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 380, duration: 0 });
    page.chooseRole(selection('role', 'lend')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(6));
    expect(page.data.filter).toBe('COMPLETED'); expect(wx.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 190, duration: 0 }); page.onUnload();
});

test('account replacement destroys role caches even if the first account later returns', async () => {
    const { load, page, owner } = harness();
    load.mockImplementation(async filter => ({ items: [{ order_id: owner.value + ':' + filter.role }], hasMore: false, nextCursor: null }));
    page.onShow(); await vi.waitFor(() => expect(page.data.items[0]?.id).toBe('first:TENANT'));
    page.chooseRole(selection('role', 'lend')); await vi.waitFor(() => expect(page.data.items[0]?.id).toBe('first:LESSOR'));
    page.onPageScroll({ scrollTop: 500 }); page.onHide(); owner.value = 'second'; page.onShow();
    expect(page.data.items).toEqual([]); expect(page.data.role).toBe('rent');
    await vi.waitFor(() => expect(page.data.items[0]?.id).toBe('second:TENANT'));
    owner.value = 'first'; page.onShow(); expect(page.data.items).toEqual([]);
    await vi.waitFor(() => expect(page.data.items[0]?.id).toBe('first:TENANT'));
    expect(wx.pageScrollTo).toHaveBeenLastCalledWith({ scrollTop: 0, duration: 0 }); page.onUnload();
});

test('orders page selects its own native tab on show while asset detail does not change tab selection',()=>{
    const bar={setData:vi.fn()};
    const {page}=harness();
    Object.assign(page,{getTabBar:()=>bar});
    page.onShow();
    expect(bar.setData).toHaveBeenCalledExactlyOnceWith({selected:1});
    const asset=harness(true).page;
    Object.assign(asset,{getTabBar:()=>bar});
    asset.onShow();
    expect(bar.setData).toHaveBeenCalledTimes(1);
    page.onUnload();asset.onUnload();
});

test.each([false, true])('order list initial session failure returns to existing login UI (assetScoped=%s)', async assetScoped => {
    const { owner, load, page } = harness(assetScoped), pending = deferred(); load.mockReturnValueOnce(pending.promise);
    page.onShow(); await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(page.data.listState.phase).toBe('initial-loading');
    owner.value = null; pending.reject(new Error('401 session cleared'));
    await vi.waitFor(() => expect(page.data.loggedIn).toBe(false));
    expect(page.data).toMatchObject({ items: [], sheetOpen: false, recordGroups: [], listState: { phase: 'empty' } });
    page.retryInitial(); page.onReachBottom();
    await Promise.resolve(); expect(load).toHaveBeenCalledOnce();
    owner.value = 'first'; page.onShow(); await vi.waitFor(() => expect(page.data.items).toEqual([{ id: 'old-order' }]));
    expect(page.data.loggedIn).toBe(true);
});
test('order list loses rows and open sheet when pagination expires its session', async () => {
    const { owner, load, page } = harness(); page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    page.openRental({ currentTarget: { dataset: { id: 'old-order' } } } as unknown as WechatMiniprogram.TouchEvent);
    const pending = deferred(); load.mockReturnValueOnce(pending.promise); page.onReachBottom();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2)); owner.value = null; pending.reject(new Error('401 session cleared'));
    await vi.waitFor(() => expect(page.data.loggedIn).toBe(false));
    expect(page.data).toMatchObject({ items: [], recordGroups: [], sheetOpen: false, listState: { phase: 'empty' } });
});
test.each(['hidden', 'new-account', 'new-filter'])('old order list completion cannot overwrite %s state', async mode => {
    const { owner, load, page } = harness(), pending = deferred(); load.mockReturnValueOnce(pending.promise); page.onShow();
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    if (mode === 'hidden') { page.onHide(); owner.value = null; }
    else {
        load.mockResolvedValue({ items: [{ order_id: 'new-order' }], hasMore: false, nextCursor: null });
        if (mode === 'new-account') { owner.value = 'second'; page.onShow(); }
        else page.chooseFilter({ currentTarget: { dataset: { filter: 'IN_USE' } } } as unknown as WechatMiniprogram.TouchEvent);
        await vi.waitFor(() => expect(page.data.items).toEqual([{ id: 'new-order' }]));
    }
    const current = structuredClone(page.data); pending.reject(new Error('old failure'));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(page.data).toEqual(current);
});

test.each([false, true])('superseded order list request still clears a truly expired session (assetScoped=%s)', async assetScoped => {
    const { owner, load, page } = harness(assetScoped), pending = deferred(); load.mockReturnValueOnce(pending.promise); page.onShow();
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    page.chooseFilter({ currentTarget: { dataset: { filter: 'IN_USE' } } } as unknown as WechatMiniprogram.TouchEvent);
    await vi.waitFor(() => expect(page.data.items).toEqual([{ id: 'old-order' }]));
    page.openRental({ currentTarget: { dataset: { id: 'old-order' } } } as unknown as WechatMiniprogram.TouchEvent);
    owner.value = null; pending.reject(new Error('401 session cleared'));
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(page.data).toMatchObject({ loggedIn: false, items: [], recordGroups: [], sheetOpen: false, listState: { phase: 'empty' } });
    const count = load.mock.calls.length; page.retryInitial(); page.onReachBottom(); await Promise.resolve(); expect(load).toHaveBeenCalledTimes(count);
});

test('five R4 filter entries resolve to one explicit server status without aggregating page cursors', async () => {
    const { load, page } = harness();
    page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    expect(page.data.primaryFilters.map(item => item.label)).toEqual(['全部', '待签约', '待支付']);
    page.openFilterMenu(selection('group', 'processing'));
    expect(page.data.filterMenuOptions.map(item => item.id)).toEqual(['AWAITING_DELIVERY', 'IN_USE', 'RETURNING', 'RETURN_REVIEW', 'AWAITING_SUPPLEMENT']);
    expect(load).toHaveBeenCalledOnce();
    page.chooseFilter(selection('filter', 'AWAITING_SUPPLEMENT'));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load.mock.lastCall?.[0]).toMatchObject({ display_status_code: 'AWAITING_SUPPLEMENT', role: 'TENANT' });
    expect(page.data).toMatchObject({ activeFilterGroup: 'processing', filterMenuOpen: false, selectedFilterLabel: '待补缴' });
    page.openFilterMenu(selection('group', 'more'));
    expect(page.data.filterMenuOptions.map(item => item.id)).toEqual(['REFUND_PROCESSING', 'SETTLEMENT_CONFIRMING', 'COMPLETED', 'CLOSED']);
    page.onHide(); page.openFilterMenu(selection('group', 'more')); expect(page.data.filterMenuOpen).toBe(false); page.onUnload();
});

test('order detail return selects the authenticated lessor context and restores its original filter', async () => {
    const { setOrderListContext } = await import('../miniprogram/shared/interaction/order-list-context');
    const { page, load } = harness(); page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    page.onHide(); setOrderListContext('first', 'LESSOR'); page.onShow(); await vi.waitFor(() => expect(load.mock.lastCall?.[0].role).toBe('LESSOR')); expect(page.data.role).toBe('lend');
    page.chooseFilter(selection('filter', 'COMPLETED')); await vi.waitFor(() => expect(load.mock.lastCall?.[0].display_status_code).toBe('COMPLETED'));
    page.onHide(); setOrderListContext('first', 'LESSOR'); page.onShow(); await vi.waitFor(() => expect(page.data.listState.phase).toBe('ready')); expect(page.data.filter).toBe('COMPLETED'); page.onUnload();
});
test('cross-account navigation context is discarded', async () => {
    const { setOrderListContext } = await import('../miniprogram/shared/interaction/order-list-context');
    const { page, load } = harness(); setOrderListContext('someone-else', 'LESSOR'); page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1)); expect(load.mock.lastCall?.[0].role).toBe('TENANT'); page.onUnload();
});

test('lessor primary filters distinguish unshipped orders from outbound and preserve server pagination', async () => {
    const { page, load } = harness(); page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    page.chooseRole(selection('role', 'lend')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(page.data.primaryFilters.map(item => item.label)).toEqual(['全部', '待发货', '待收回', '已完成']);
    expect(page.data.showProcessingFilter).toBe(false);
    page.chooseFilter(selection('filter', 'AWAITING_DELIVERY'));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    expect(load.mock.lastCall?.[0]).toMatchObject({ role: 'LESSOR', display_status_code: 'AWAITING_DELIVERY', physical_status: 'NOT_DELIVERED' });
    expect(page.data).toMatchObject({ activeFilterGroup: '', selectedFilterLabel: '待发货' });
    page.onReachBottom(); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(4));
    expect(load.mock.lastCall?.[0]).toMatchObject({ physical_status: 'NOT_DELIVERED', cursor: 'next' });
    page.openFilterMenu(selection('group', 'more'));
    expect(page.data.filterMenuOptions.map(item => item.label)).toContain('已发货');
    expect(page.data.filterMenuOptions.map(item => item.label)).not.toContain('待发货');
    page.chooseFilter(selection('filter', 'OUTBOUND'));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(5));
    expect(load.mock.lastCall?.[0]).toMatchObject({ role: 'LESSOR', display_status_code: 'AWAITING_DELIVERY', physical_status: 'OUTBOUND' });
    page.chooseFilter(selection('filter', 'RETURNING'));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(6));
    expect(load.mock.lastCall?.[0]).toMatchObject({ role: 'LESSOR', display_status_code: 'RETURNING' });
    expect(load.mock.lastCall?.[0]).not.toHaveProperty('physical_status');
    page.onUnload();
});

test('role changes close the old filter menu and restore independent filters without shipping constraints leaking to tenant', async () => {
    const { page, load, owner } = harness(); page.onShow(); await vi.waitFor(() => expect(page.data.items).toHaveLength(1));
    page.openFilterMenu(selection('group', 'processing'));
    page.chooseRole(selection('role', 'lend')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(page.data.filterMenuOpen).toBe(false);
    page.openFilterMenu(selection('group', 'processing')); expect(page.data.filterMenuOpen).toBe(false);
    page.chooseFilter(selection('filter', 'AWAITING_DELIVERY')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    page.chooseRole(selection('role', 'rent')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(4));
    expect(page.data.primaryFilters.map(item => item.label)).toEqual(['全部', '待签约', '待支付']);
    expect(page.data.showProcessingFilter).toBe(true);
    const count = load.mock.calls.length;
    page.chooseFilter(selection('filter', 'OUTBOUND')); expect(load).toHaveBeenCalledTimes(count);
    page.chooseFilter(selection('filter', 'AWAITING_DELIVERY')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(5));
    expect(load.mock.lastCall?.[0]).toMatchObject({ role: 'TENANT', display_status_code: 'AWAITING_DELIVERY' });
    expect(load.mock.lastCall?.[0]).not.toHaveProperty('physical_status');
    page.chooseRole(selection('role', 'lend')); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(6));
    expect(page.data.filter).toBe('AWAITING_DELIVERY');
    expect(load.mock.lastCall?.[0]).toMatchObject({ role: 'LESSOR', physical_status: 'NOT_DELIVERED' });
    page.onHide(); owner.value = 'second'; page.onShow(); await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(7));
    expect(page.data).toMatchObject({ role: 'rent', filter: '', showProcessingFilter: true });
    expect(load.mock.lastCall?.[0]).not.toHaveProperty('physical_status'); page.onUnload();
});
