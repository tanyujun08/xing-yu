import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi, cashApi, type RentalIncome, type RentalRecord } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { rentalMoney, beijingTime } from '../../shared/presentation/rental-order';
import { designAssets } from '../../shared/design/assets';
import { loginHostMethods, openLoginHere } from '../../shared/interaction/login-host';
const LOGIN_TEXT = '请重新登录后查看本人租赁收益';
const states = new WeakMap<object, ReturnType<typeof createRentalPageState<RentalRecord<RentalIncome>>> & { detailEpoch: number; readSequence: number; entry: { owner: string; id: string; orderId: string } | null }>();
function state(page: object) { let s = states.get(page); if (!s) {
    s = { ...createRentalPageState<RentalRecord<RentalIncome>>(), detailEpoch: 0, readSequence: 0, entry: null };
    states.set(page, s);
} return s; }
function captureView(s: ReturnType<typeof state>) { const epoch = s.epoch, sequence = s.readSequence; return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readSequence === sequence; }
function captureExpiredView(s: ReturnType<typeof state>) { const epoch = s.epoch, owner = s.owner; return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner; }
function incomeRow(v: RentalIncome) { return { id: v.earning_id, orderId: v.order_id, orderNo: v.order_no, orderTail: String(v.order_no ?? "").slice(-6), title: v.asset_title, amount: rentalMoney(v.beneficiary_fen), time: beijingTime(v.posted_at).replace(/^\d{4}-/, "") }; }
Page({ ...loginHostMethods, data: { guest: false, icons: designAssets, availableFen: null as number | null, available: '—', withdrawOpen: false, wAmount: '', wError: '', wValid: false, wDone: false, wDoneAmount: '', wSubmitting: false, loading: false, busy: false, errorText: '', booked: '—', estimated: '—', estimatedCount: 0, items: [] as ReturnType<typeof incomeRow>[], cursor: null as string | null, hasMore: false, detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [] as {
            label: string;
            value: string;
        }[] },
    onLoad(query: Record<string, string | undefined>) { const owner = accountApi.sessionIdentity(); if (owner && query['earningId'] && query['orderId']) state(this).entry = { owner, id: query['earningId'], orderId: query['orderId'] }; },
    onShow() { const s = state(this), owner = accountApi.sessionIdentity() ?? ''; if (s.entry?.owner !== owner) s.entry = null; if (s.owner !== owner) this.clearWallet(); s.show(owner); void this.refresh(); }, onHide() { state(this).hide(); this.clearWallet(); }, onUnload() { state(this).dispose(); },
    clearWallet(errorText = '') { const s = state(this); s.current = null; ++s.detailEpoch; this.setData({ guest: errorText === LOGIN_TEXT, loading: false, busy: false, errorText, items: [], cursor: null, hasMore: false, detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [], booked: '—', estimated: '—', estimatedCount: 0 }); },
    async refresh() { const s = state(this); if (!s.visible || s.scope.disposed)
        return; if (!s.owner || !s.capture(accountApi.sessionIdentity)()) {
        this.clearWallet(LOGIN_TEXT);
        return;
    } ++s.readSequence; const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureView(s), active = () => lease() && viewCurrent(), expiredView = captureExpiredView(s); s.current = null; ++s.detailEpoch; this.setData({ guest: false, loading: true, busy: false, errorText: '', detailOpen: false, detailTitle: '', detailOrderId: '', detailOrderNo: '', detailRows: [] }); try {
        const [summary, rows] = await Promise.all([rentalOrderApi.income().promise, rentalOrderApi.earnings().promise]);
        if (!active())
            return;
        void this.loadCash();
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
            this.clearWallet(LOGIN_TEXT);
    } if (active() && s.entry?.owner === s.owner) await this.readIncome(s.entry.id, s.entry.orderId); },
    async loadMore() { const s = state(this); await s.run('earning-page', async () => { const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureView(s), active = () => lease() && viewCurrent(), expiredView = captureExpiredView(s); if (!active() || !s.owner) { if (viewCurrent()) this.clearWallet(LOGIN_TEXT); return; } if (this.data.loading || !this.data.hasMore || !this.data.cursor)
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
            this.clearWallet(LOGIN_TEXT);
    } }); },
    async openIncome(event: WechatMiniprogram.TouchEvent) { const id = String(event.currentTarget.dataset['id']), row = this.data.items.find(item => item.id === id); if (row) await this.readIncome(id, row.orderId); },
    async readIncome(id: string, orderId: string) { const s = state(this); await s.run('earning-detail', async () => { const lease = s.capture(accountApi.sessionIdentity), viewCurrent = captureView(s), active = () => lease() && viewCurrent(), expiredView = captureExpiredView(s); if (!active() || !s.owner) { if (viewCurrent()) this.clearWallet(LOGIN_TEXT); return; } const listed = this.data.items.some(i => i.id === id && i.orderId === orderId), entry = s.entry; if (this.data.loading || !(listed || entry?.owner === s.owner && entry.id === id && entry.orderId === orderId))
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
            this.clearWallet(LOGIN_TEXT);
    } }); },
    closeDetail() { const s = state(this); ++s.detailEpoch; s.entry = null; this.setData({ detailOpen: false }); }, openOrder() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.detailOpen || !this.data.detailOrderId || s.current?.value.order_id !== this.data.detailOrderId) return; s.navigation.navigateOnce('earning-order', callbacks => wx.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(this.data.detailOrderId), ...callbacks })); }, onReachBottom() { void this.loadMore(); }, async onPullDownRefresh() { try {
        await this.refresh();
    }
    finally {
        wx.stopPullDownRefresh();
    } }, onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
openLogin() { openLoginHere(this, () => wx.navigateTo({ url: '/pages/login/index?source=wallet' })); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
openWithdrawal() { this.setData({ withdrawOpen: true, wDone: false, wAmount: '', wError: '', wValid: false }); if (this.data.availableFen === null) void this.loadCash(); },
openWithdrawalRecords() { if (this.data.withdrawOpen) this.setData({ withdrawOpen: false }); state(this).navigation.navigateOnce('wallet:withdrawal-records', callbacks => wx.navigateTo({ url: '/pages/withdrawal/index?view=records', ...callbacks })); },
async loadCash() { try { const cash = await cashApi.balance().promise; const fen = Number(cash.withdrawable_fen ?? cash.available_fen); if (Number.isFinite(fen)) this.setData({ availableFen: fen, available: rentalMoney(String(fen)) }); } catch { this.setData({ availableFen: null, available: '—' }); } },
closeWithdrawal() { if (!this.data.wSubmitting) this.setData({ withdrawOpen: false }); },
withdrawInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) { const wAmount = String(event.detail.value ?? ''); this.setData({ wAmount, wError: '', wValid: this.amountValid(wAmount) }); },
amountValid(text: string) { const fen = this.data.availableFen; if (fen === null || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text.trim())) return false; const amount = Math.round(Number(text) * 100); return amount >= 100 && amount <= fen; },
withdrawAll() { const fen = this.data.availableFen; if (fen !== null) { const wAmount = (fen / 100).toFixed(2); this.setData({ wAmount, wError: '', wValid: this.amountValid(wAmount) }); } },
showIncomeHelp() { wx.showModal({ title: '已入账收益', content: '预计收益为未结算订单，结算后转为已入账，可提现到微信零钱。', showCancel: false, confirmText: '知道了' }); },
showEstimateHelp() { wx.showModal({ title: '预计收益', content: '进行中、尚未结算订单的收益合计。订单完成结算后转入已入账收益，才可以提现。', showCancel: false, confirmText: '知道了' }); },
showBalanceHelp() { wx.showModal({ title: '可提现余额', content: '满 ¥1 可提现。托管押金、待收款和预期收益不计入可提现余额。', showCancel: false, confirmText: '知道了' }); },
submitWithdrawal() {
    if (this.data.wSubmitting) return;
    const text = this.data.wAmount.trim(), fen = this.data.availableFen;
    if (fen === null) { this.setData({ wError: '可提现余额暂不可用，请稍后再试' }); return; }
    if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text)) { this.setData({ wError: '请输入最多两位小数的金额' }); return; }
    const amount = Math.round(Number(text) * 100);
    if (amount < 100 || amount > fen) { this.setData({ wError: '请输入 ¥1 至可提现余额之间的金额' }); return; }
    // 正式接入：后台创建转账单后调用 wx.requestMerchantTransfer 进入微信“确认收款”页，这里不再自己弹确认框
    this.setData({ wSubmitting: true });
    void cashApi.withdraw(amount, cashApi.newIntent()).promise.then(async () => {
        this.setData({ wDone: true, wDoneAmount: rentalMoney(String(amount)), wAmount: '', wValid: false });
        await this.loadCash();
    }).catch((error: unknown) => { this.setData({ wError: error instanceof Error ? error.message : '提现提交失败，请稍后再试' }); }).finally(() => this.setData({ wSubmitting: false }));
},
});
