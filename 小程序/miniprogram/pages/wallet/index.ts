import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, type RentalIncome, type RentalRecord } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { rentalMoney, beijingTime } from '../../shared/presentation/rental-order';
const states = new WeakMap<object, ReturnType<typeof createRentalPageState<RentalRecord<RentalIncome>>> & { detailEpoch: number; readSequence: number; entry: { owner: string; id: string; orderId: string } | null }>();
function state(page: object) { let s = states.get(page); if (!s) {
    s = { ...createRentalPageState<RentalRecord<RentalIncome>>(), detailEpoch: 0, readSequence: 0, entry: null };
    states.set(page, s);
} return s; }
function captureView(s: ReturnType<typeof state>) { const epoch = s.epoch, sequence = s.readSequence; return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readSequence === sequence; }
function captureExpiredView(s: ReturnType<typeof state>) { const epoch = s.epoch, owner = s.owner; return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner; }
function incomeRow(v: RentalIncome) { return { id: v.earning_id, orderId: v.order_id, orderNo: v.order_no, title: v.asset_title, amount: rentalMoney(v.beneficiary_fen), time: beijingTime(v.posted_at) }; }
Page({ data: { loading: false, busy: false, errorText: '', booked: '—', estimated: '—', estimatedCount: 0, items: [] as ReturnType<typeof incomeRow>[], cursor: null as string | null, hasMore: false, detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [] as {
            label: string;
            value: string;
        }[] },
    onLoad(query: Record<string, string | undefined>) { const owner = accountApi.sessionIdentity(); if (owner && query['earningId'] && query['orderId']) state(this).entry = { owner, id: query['earningId'], orderId: query['orderId'] }; },
    onShow() { const s = state(this), owner = accountApi.sessionIdentity() ?? ''; if (s.entry?.owner !== owner) s.entry = null; if (s.owner !== owner) this.clearWallet(); s.show(owner); void this.refresh(); }, onHide() { state(this).hide(); this.clearWallet(); }, onUnload() { state(this).dispose(); },
    clearWallet(errorText = '') { const s = state(this); s.current = null; ++s.detailEpoch; this.setData({ loading: false, busy: false, errorText, items: [], cursor: null, hasMore: false, detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [], booked: '—', estimated: '—', estimatedCount: 0 }); },
    async refresh() { const s = state(this); if (!s.visible || s.scope.disposed)
        return; if (!s.owner || !s.capture(accountApi.sessionIdentity)()) {
        this.clearWallet('请重新登录后查看本人租赁收益');
        return;
    } ++s.readSequence; const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureView(s), active = () => lease() && viewCurrent(), expiredView = captureExpiredView(s); s.current = null; ++s.detailEpoch; this.setData({ loading: true, busy: false, errorText: '', detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [] }); try {
        const [summary, rows] = await Promise.all([rentalOrderApi.income().promise, rentalOrderApi.earnings().promise]);
        if (!active())
            return;
        this.setData({ booked: rentalMoney(summary.value.booked_income_fen), estimated: rentalMoney(summary.value.estimated_income_fen), estimatedCount: summary.value.estimated_order_count, items: rows.value.items.map(incomeRow), cursor: rows.value.next_cursor, hasMore: rows.value.has_more });
    }
    catch (error) {
        if (active())
            this.setData({ errorText: error instanceof Error ? error.message : '收益读取失败，原数据显示保留' });
    }
    finally {
        if (active())
            this.setData({ loading: false });
        else if (expiredView())
            this.clearWallet('请重新登录后查看本人租赁收益');
    } if (active() && s.entry?.owner === s.owner) await this.readIncome(s.entry.id, s.entry.orderId); },
    async loadMore() { const s = state(this); await s.run('earning-page', async () => { const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureView(s), active = () => lease() && viewCurrent(), expiredView = captureExpiredView(s); if (!active() || !s.owner) { if (viewCurrent()) this.clearWallet('请重新登录后查看本人租赁收益'); return; } if (this.data.loading || !this.data.hasMore || !this.data.cursor)
        return; this.setData({ busy: true }); try {
        const result = await rentalOrderApi.earnings(this.data.cursor).promise;
        if (!active())
            return;
        const patch: Record<string, unknown> = { cursor: result.value.next_cursor, hasMore: result.value.has_more };
        let index = this.data.items.length;
        const seen = new Set(this.data.items.map(row => row.id));
        for (const row of result.value.items.map(incomeRow))
            if (!seen.has(row.id)) {
                seen.add(row.id);
                patch['items[' + index++ + ']'] = row;
            }
        this.setData(patch);
    }
    catch (error) {
        if (active())
            this.setData({ errorText: error instanceof Error ? error.message : '更多收益读取失败' });
    }
    finally {
        if (active())
            this.setData({ busy: false });
        else if (expiredView())
            this.clearWallet('请重新登录后查看本人租赁收益');
    } }); },
    async openIncome(event: WechatMiniprogram.TouchEvent) { const id = String(event.currentTarget.dataset['id']), row = this.data.items.find(item => item.id === id); if (row) await this.readIncome(id, row.orderId); },
    async readIncome(id: string, orderId: string) { const s = state(this); await s.run('earning-detail', async () => { const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureView(s), active = () => lease() && viewCurrent(), expiredView = captureExpiredView(s); if (!active() || !s.owner) { if (viewCurrent()) this.clearWallet('请重新登录后查看本人租赁收益'); return; } const listed = this.data.items.some(i => i.id === id && i.orderId === orderId), entry = s.entry; if (this.data.loading || !(listed || entry?.owner === s.owner && entry.id === id && entry.orderId === orderId))
        return; const detailEpoch = ++s.detailEpoch; s.current = null; this.setData({ busy: true, detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [] }); try {
        const result = await rentalOrderApi.earning(id).promise;
        if (!active() || detailEpoch !== s.detailEpoch)
            return;
        const v = result.value;
        if (v.earning_id !== id || v.order_id !== orderId) throw new Error('收益明细与原订单不匹配，请刷新后重试');
        s.current = result;
        this.setData({ detailOpen: true, detailTitle: v.asset_title, detailOrderId: v.order_id, detailOrderNo: v.order_no, detailRows: [{ label: '租金', value: rentalMoney(v.rent_fen) }, { label: '超期费', value: rentalMoney(v.overtime_fen) }, { label: '设备损失', value: rentalMoney(v.loss_fen) }, { label: '优惠补贴', value: rentalMoney(v.subsidy_fen) }, { label: '平台分润', value: rentalMoney(v.platform_fen) }, { label: '本次入账收益', value: rentalMoney(v.beneficiary_fen) }, { label: '入账时间', value: beijingTime(v.posted_at) }] });
    }
    catch (error) {
        if (active())
            this.setData({ errorText: error instanceof Error ? error.message : '明细读取失败' });
    }
    finally {
        if (active())
            this.setData({ busy: false });
        else if (expiredView())
            this.clearWallet('请重新登录后查看本人租赁收益');
    } }); },
    closeDetail() { const s = state(this); ++s.detailEpoch; s.entry = null; this.setData({ detailOpen: false }); }, openOrder() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.detailOpen || !this.data.detailOrderId || s.current?.value.order_id !== this.data.detailOrderId) return; s.navigation.navigateOnce('earning-order', callbacks => wx.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(this.data.detailOrderId), ...callbacks })); }, onReachBottom() { void this.loadMore(); }, async onPullDownRefresh() { try {
        await this.refresh();
    }
    finally {
        wx.stopPullDownRefresh();
    } }, onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
