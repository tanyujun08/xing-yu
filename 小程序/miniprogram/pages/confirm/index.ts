import { accountApi, findOwnAddress, couponApi } from '../../shared/api/account-api';
import { supplyApi } from '../../shared/api/supply-api';
import { rentalOrderApi, type RentalOrder, type RentalQuote, type RentalSelection, type RentalRecord } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { beijingTime, beijingInputToUTC, rentalDate, rentalDateRange, rentalMoney, rentalBlockers, rentalActionAllowed } from '../../shared/presentation/rental-order';
import { buildCalendarMonths, calendarWeekdays, dateDiffDays, addDaysText } from '../../shared/presentation/rental-calendar';
import { checkoutError, validateCheckoutDates } from '../../shared/presentation/checkout-term';
import { validContractArtifact } from '../../shared/presentation/contract-signature';
import { designAssets } from '../../shared/design/assets';
import { rentalQuoteChange } from '../../shared/presentation/rental-quote-change';
import { rentalFreight } from '../../shared/presentation/rental-order-delivery';
const states = new WeakMap<object, ReturnType<typeof createRentalPageState<RentalRecord<RentalOrder>>> & {
    quote: RentalQuote | null;
    changedQuote: RentalQuote | null;
    selection: RentalSelection | null;
    couponEpoch: number;
    quoteEpoch: number;
    readEpoch: number;
    voucherReadEpoch: number;
    draftOwner: string;
    termEpoch: number;
}>();
function state(page: object) { let s = states.get(page); if (!s) {
    s = { ...createRentalPageState<RentalRecord<RentalOrder>>(), quote: null, changedQuote: null, selection: null, couponEpoch: 0, quoteEpoch: 0, readEpoch: 0, voucherReadEpoch: 0, draftOwner: '', termEpoch: 0 };
    states.set(page, s);
} return s; }
function captureCheckoutSessionLoss(s: ReturnType<typeof state>) {
    const epoch = s.epoch, owner = s.owner;
    return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner;
}
Page({
    data: { outboundFreight: '', returnFreight: '', pickupLocation: '', pickupName: '', pickupAddress: '', quoteChange: null as ReturnType<typeof rentalQuoteChange> | null, quoteIcons: { document: designAssets.returnDocument, refresh: designAssets.returnRefresh, info: designAssets.returnInfo }, loaded: false, loading: false, busy: false, errorText: '', step: 1, title: '', productMedia: '', method: '' as '' | 'CABINET' | 'EXPRESS', addressId: '', recipientAddress: '', couponId: '', couponLabel: '不使用优惠券', startDate: '', endDate: '', termText: '请选择完整租期', termSheetOpen: false, frozen: false, orderId: '', statusText: '', deadlineText: '', rent: '—', deposit: '—', total: '—', discount: '—', blockers: '', canPrepare: false, canConfirm: false, voucherSheetOpen: false, voucherLoading: false, voucherError: '', voucherCursor: null as string | null, vouchers: [] as {
            id: string;
            label: string;
        }[], frozenNeedsConfirmation: true, frozenActionText: '确认订单并付款', frozenSigned: false, signedAt: '', confirmationDeadline: '', zeroCash: false, icons: { success: designAssets.returnSuccess, contract: designAssets.returnDocument, chevron: designAssets.returnChevron }, termHint: '', formStartDate: '', formEndDate: '', minimumDays: 1, earliestDate: '', latestDate: '', termDays: 0, formDays: 0, calendarMonths: [] as ReturnType<typeof buildCalendarMonths>, monthIndex: 0, calendarWeekdays, errorOpen: false, hasPendingPreparation: false },
    onLoad(query: Record<string, string | undefined>) { const s = state(this); s.id = query['deviceId'] ?? query['asset_id'] ?? ''; this.setData({ orderId: query['orderId'] ?? '' }); },
    onShow() { const s = state(this), owner = accountApi.sessionIdentity() ?? ''; if (owner && s.draftOwner && s.draftOwner !== owner) {
        s.quote = null;
        s.changedQuote = null;
        s.selection = null;
        this.setData({ quoteChange: null, loaded: false, frozen: !!this.data.orderId, addressId: '', recipientAddress: '', couponId: '', startDate: '', endDate: '', canPrepare: false });
    } if (owner) s.draftOwner = owner; s.show(owner); void this.loadContext(); },
    onHide() { state(this).hide(); state(this).current = null; state(this).couponEpoch++; state(this).termEpoch++; this.setData({ quoteChange: null, loaded: false, canConfirm: false, frozenSigned: false, signedAt: '', loading: false, busy: false, voucherLoading: false, termSheetOpen: false, voucherSheetOpen: false, errorOpen: false }); }, onUnload() { state(this).dispose(); },
    showCheckoutError(error: unknown) { this.setData({ errorText: checkoutError(error), errorOpen: true }); },
    dismissCheckoutError() { this.setData({ errorOpen: false }); },
    clearUnavailableSession() {
        const s = state(this); s.current = null; s.quote = null;
        // Keep explicit selections and the account-bound UNKNOWN preparation; only remove its displayed projection.
        this.setData({ quoteChange: null, loading: false, busy: false, voucherLoading: false, loaded: false, canPrepare: false, canConfirm: false,
            outboundFreight: '', returnFreight: '', pickupLocation: '', pickupName: '', pickupAddress: '', title: '', productMedia: '', recipientAddress: '', statusText: '', deadlineText: '', blockers: '', frozenSigned: false, signedAt: '', confirmationDeadline: '', zeroCash: false,
            rent: '—', deposit: '—', total: '—', discount: '—', vouchers: [], voucherCursor: null,
            termSheetOpen: false, voucherSheetOpen: false, voucherError: '', errorOpen: true, errorText: '登录状态已失效或变化，请重新登录后读取确认订单' });
    },
    async loadContext() {
        const s = state(this), epoch = s.epoch, readEpoch = ++s.readEpoch;
        const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readEpoch === readEpoch;
        const lease = s.capture(accountApi.sessionIdentity), sessionLost = captureCheckoutSessionLoss(s), active = () => viewCurrent() && lease();
        if (!active()) { if (viewCurrent()) this.clearUnavailableSession(); return; }
        if (!s.owner) {
            this.clearUnavailableSession();
            return;
        }
        s.current = null;
        this.setData({ loading: true, loaded: false, outboundFreight: '', returnFreight: '', pickupLocation: '', pickupName: '', pickupAddress: '', canConfirm: false, frozenSigned: false, signedAt: '', confirmationDeadline: '', zeroCash: false, errorText: '', errorOpen: false });
        try {
            const pending = rentalOrderApi.pendingPreparation();
            this.setData({ hasPendingPreparation: !!pending });
            if (pending) {
                const lookup = await rentalOrderApi.lookup('B02', pending.key).promise;
                if (!active())
                    return;
                if (lookup.value.result?.resource_type === 'ORDER')
                    this.setData({ orderId: lookup.value.result.resource_id });
                else {
                    this.setData({ errorOpen: true, errorText: lookup.value.state === 'NOT_FOUND' && lookup.value.retry_same_request ? '原准备请求尚未登记，请点击恢复原请求' : '原准备请求结果待确认，请重新查询或联系客服', canPrepare: false });
                    return;
                }
            }
            if (this.data.orderId) {
                s.changedQuote = null; this.setData({ quoteChange: null });
                const record = await rentalOrderApi.get(this.data.orderId).promise;
                if (!active())
                    return;
                const value = record.value;
                if (value.order.order_id !== this.data.orderId) throw new Error('订单记录不匹配，请重新读取');
                const preparing = value.order.stage === 'PREPARING', zeroCash = value.fees.initial_due_fen === '0';
                let frozenSigned = false, signedAt = '', confirmationDeadline = value.hold_expires_at ?? '';
                if (preparing) {
                    const contract = (await rentalOrderApi.contract(this.data.orderId).promise).value;
                    if (!active()) return;
                    if (contract.order_id !== value.order.order_id || contract.contract_id !== value.contract_id) throw new Error('合同与订单不匹配，请重新读取');
                    if (contract.status === 'SUCCEEDED') {
                        if (contract.tenant_signature.status !== 'SUCCEEDED' || !contract.tenant_signature.signed_at || !Number.isFinite(Date.parse(contract.tenant_signature.signed_at)) || !contract.final_artifact || !validContractArtifact(contract.final_artifact)) throw new Error('已签合同信息不完整，请重新读取');
                        frozenSigned = true;
                        signedAt = beijingTime(contract.tenant_signature.signed_at);
                    }
                    if (contract.tenant_signature.account_id !== s.owner || value.order.viewer_role !== 'TENANT') throw new Error('仅承租人可以确认订单');
                    const deadlines = [value.hold_expires_at, contract.expires_at].filter((date): date is string => !!date && Number.isFinite(Date.parse(date)));
                    if (deadlines.length !== 2) throw new Error('订单确认期限不完整，请重新读取');
                    confirmationDeadline = deadlines.sort((a, b) => Date.parse(a) - Date.parse(b))[0]!;
                }
                s.current = record;
                this.setData({ outboundFreight: rentalFreight(value.requirements?.outbound_freight_payer, '寄出'), returnFreight: rentalFreight(value.requirements?.return_freight_payer, '寄回'), pickupLocation: value.pickup ? value.pickup.name + ' ' + value.pickup.address : '', pickupName: value.pickup?.name ?? '', pickupAddress: value.pickup?.address ?? '' });
                this.setData({ frozenNeedsConfirmation: preparing, frozenSigned, signedAt, confirmationDeadline, zeroCash, frozenActionText: preparing ? zeroCash ? '确认订单 ¥0' : '确认订单并付款' : value.order.stage === 'AWAITING_PAYMENT' ? '查看原订单付款状态' : '查看原订单状态' });
                this.setData({ loaded: true, frozen: true, title: value.order.asset.title, productMedia: value.order.asset.cover_media?.url ?? '', method: value.delivery.method, termText: rentalDateRange(value.order.rental_start_at, value.order.rental_end_at), termHint: '', termDays: dateDiffDays(rentalDate(value.order.rental_start_at), rentalDate(value.order.rental_end_at)), recipientAddress: value.delivery.recipient ? [value.delivery.recipient.recipient_name, value.delivery.recipient.phone, value.delivery.recipient.region_text + value.delivery.recipient.detail].join(' ') : '', statusText: frozenSigned ? '合同已签署' : value.order.display_status, deadlineText: preparing ? beijingTime(confirmationDeadline) : value.order.stage === 'AWAITING_PAYMENT' ? beijingTime(value.payment_due_at) : '', rent: rentalMoney(value.fees.rent_gross_fen), deposit: rentalMoney(value.fees.deposit_due_fen), discount: rentalMoney(value.fees.rent_discount_fen), total: rentalMoney(value.fees.initial_due_fen), blockers: rentalBlockers(value.order.blockers), canConfirm: preparing && frozenSigned && rentalActionAllowed(value.order.allowed_actions, 'CONFIRM_ORDER'), step: 2 });
                return;
            }
            const supply = await supplyApi.get(s.id).promise;
            const pickup = supply.supply_type === 'CABINET' ? supply.pickup_location : null;
            const pickupLocation = pickup ? [pickup.name, pickup.address.province_name, pickup.address.city_name, pickup.address.district_name, pickup.address.detail_address].join(' ') : '';
            if (supply.supply_type === 'CABINET' && (!pickup || ![pickup.name, pickup.address.province_name, pickup.address.city_name, pickup.address.district_name, pickup.address.detail_address].every(part => part.trim()))) throw new Error('取件地点尚未核实，请刷新后再下单');
            if (!active())
                return;
            if (supply.supply_type !== 'CABINET' && supply.supply_type !== 'PERSONAL')
                throw new Error('本期仅支持官方柜机和个人快递租赁');
            const minimumDays = Math.max(1, Math.ceil(Number(supply.minimum_units || '1') / (supply.rental_mode === 'HOUR' ? 24 : 1)));
            const availableDay = rentalDate(supply.available_from), availableTime = Date.parse(supply.available_from);
            const earliestDate = Number.isFinite(availableTime) ? (availableTime > Date.parse(beijingInputToUTC(availableDay, '00:00')) ? addDaysText(availableDay, 1) : availableDay) : '';
            // The open-ended 9999 UTC bound crosses into year 10000 in Beijing.
            // Clamp it to the calendar's four-digit domain before comparing date strings.
            const until = Date.parse(supply.available_until);
            const latestDate = Number.isFinite(until) ? rentalDate(new Date(Math.min(until, Date.parse('9999-12-30T16:00:00Z'))).toISOString()) : '';
            this.setData({ pickupLocation, pickupName: pickup?.name ?? '', pickupAddress: pickup ? [pickup.address.district_name, pickup.address.detail_address].join(' ') : '', loaded: true, title: supply.display_name, method: supply.supply_type === 'CABINET' ? 'CABINET' : 'EXPRESS', productMedia: supply.media.find(media => media.role === 'COVER')?.url ?? '', minimumDays, earliestDate, latestDate, termHint: `${minimumDays} 天起租，结束日期为归还日` });
            if (this.data.addressId) {
                const address = await findOwnAddress(this.data.addressId);
                if (!active())
                    return;
                if (!address)
                    throw new Error('已选地址不可用，请重新选择');
                this.setData({ recipientAddress: address.recipient_name + ' ' + address.phone + ' ' + address.province_name + address.city_name + address.district_name + address.detail_address });
            }
            if (s.changedQuote) this.setData({ quoteChange: rentalQuoteChange(s.changedQuote.fees, null), canPrepare: false });
            if (s.selection)
                await this.refreshQuote();
        }
        catch (error) {
            if (active())
                this.showCheckoutError(error);
        }
        finally {
            if (sessionLost()) this.clearUnavailableSession();
            else if (viewCurrent() && lease()) this.setData({ loading: false });
        }
    },
    selection(coupon?: string): RentalSelection { const term = validateCheckoutDates(this.data.startDate, this.data.endDate, this.data.minimumDays, this.data.earliestDate, this.data.latestDate); return { asset_id: state(this).id, rental_start_at: term.from, rental_end_at: term.to, delivery_method: this.data.method === 'CABINET' ? 'CABINET' : 'EXPRESS', address_id: this.data.method === 'EXPRESS' ? this.data.addressId || null : null, coupon_id: (coupon ?? this.data.couponId) || null }; },
    async refreshQuote(selectedCoupon?: string, couponEpoch?: number, candidate?: RentalSelection, termEpoch?: number) {
        const coupon = selectedCoupon ?? this.data.couponId;
        const s = state(this), epoch = s.epoch, requestEpoch = ++s.quoteEpoch;
        const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && requestEpoch === s.quoteEpoch;
        const lease = s.capture(accountApi.sessionIdentity), sessionLost = captureCheckoutSessionLoss(s), active = () => viewCurrent() && lease() && (termEpoch === undefined || (s.termEpoch === termEpoch && this.data.termSheetOpen));
        if (!active() || !s.owner) { if (viewCurrent()) this.clearUnavailableSession(); return; }
        if (this.data.frozen)
            return;
        this.setData({ busy: true, errorText: '', canPrepare: false });
        try {
            const body = candidate ?? this.selection(coupon);
            if (Date.parse(body.rental_end_at) <= Date.parse(body.rental_start_at))
                throw new Error('结束时间必须晚于开始时间');
            if (body.delivery_method === 'EXPRESS' && !body.address_id)
                throw new Error('请选择收货地址');
            const result = await rentalOrderApi.quote(body).promise;
            if (!active() || requestEpoch !== s.quoteEpoch || (couponEpoch !== undefined && couponEpoch !== s.couponEpoch))
                return;
            s.quote = result.value;
            this.setData({ outboundFreight: rentalFreight(result.value.requirements?.outbound_freight_payer, '寄出'), returnFreight: rentalFreight(result.value.requirements?.return_freight_payer, '寄回') });
            s.selection = body;
            this.setData({ couponId: coupon, couponLabel: this.data.vouchers.find(v => v.id === coupon)?.label ?? (coupon ? '已选优惠券' : '不使用优惠券'), rent: rentalMoney(result.value.fees.rent_gross_fen), deposit: rentalMoney(result.value.fees.deposit_due_fen), total: rentalMoney(result.value.fees.initial_due_fen), discount: rentalMoney(result.value.fees.rent_discount_fen), blockers: rentalBlockers(result.value.blockers), canPrepare: result.value.blockers.length === 0, startDate: rentalDate(body.rental_start_at), endDate: rentalDate(body.rental_end_at), termDays: dateDiffDays(rentalDate(body.rental_start_at), rentalDate(body.rental_end_at)), termText: rentalDateRange(body.rental_start_at, body.rental_end_at), voucherSheetOpen: false, ...(candidate ? { termSheetOpen: false } : {}) });
            if (s.changedQuote) this.setData({ quoteChange: rentalQuoteChange(s.changedQuote.fees, result.value.fees), canPrepare: false });
            return true;
        }
        catch (error) {
            if (active() && requestEpoch === s.quoteEpoch && (couponEpoch === undefined || couponEpoch === s.couponEpoch)) {
                this.setData({ canPrepare: !s.changedQuote && !!s.quote && s.quote.blockers.length === 0 });
                if (s.changedQuote) this.setData({ errorText: checkoutError(error), errorOpen: false });
                else this.showCheckoutError(error);
            }
            return false;
        }
        finally {
            if (sessionLost()) this.clearUnavailableSession();
            else if (viewCurrent() && lease()) this.setData({ busy: false });
        }
    },
    async next() { const s = state(this); await s.run('checkout', async () => { const epoch = s.epoch, readEpoch = s.readEpoch;
        const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readEpoch === readEpoch;
        const active = s.capture(accountApi.sessionIdentity), sessionLost = captureCheckoutSessionLoss(s); if (!active() || !s.owner || s.changedQuote || this.data.busy || this.data.loading || !this.data.loaded)
        return; if (!this.data.orderId && rentalOrderApi.pendingPreparation()) {
        await this.loadContext();
        return;
    } if (!this.data.frozen && !this.data.canPrepare) {
        const updated = await this.refreshQuote();
        if (updated && active() && s.quote && this.data.canPrepare)
            this.setData({ step: 2 });
        return;
    } if (this.data.frozen && this.data.frozenNeedsConfirmation && Date.parse(this.data.confirmationDeadline) <= Date.now()) {
        await this.loadContext();
        return;
    } const submittedQuote = s.quote, submittedOwner = s.owner; this.setData({ busy: true, errorText: '' }); try {
        if (this.data.frozen) {
            if (!s.current || s.current.value.order.order_id !== this.data.orderId) return;
            if (s.current.value.order.stage !== 'PREPARING') { this.setData({ busy: false }); this.openOrder(); return; }
            if (!this.data.canConfirm || !this.data.frozenSigned) return;
            await rentalOrderApi.confirm(this.data.orderId, s.current.etag).promise;
        }
        else {
            if (!s.quote || !s.selection || !this.data.canPrepare)
                return;
            const result = await rentalOrderApi.prepare({ ...s.selection, accepted_terms_hash: s.quote.terms_hash }).promise;
            if (!active() || !viewCurrent())
                return;
            this.setData({ orderId: result.value.order.order_id, frozen: true });
        }
        if (active() && viewCurrent()) {
            await this.loadContext();
            if (active() && this.data.loaded && s.current) { this.setData({ busy: false }); if (s.current.value.order.stage === 'PREPARING' && !this.data.frozenSigned) this.openContract(); else this.openOrder(); }
        }
    }
    catch (error) {
        const quoteChanged = error && typeof error === 'object' && 'code' in error && error.code === 'QUOTE_CHANGED';
        if (quoteChanged && submittedQuote && !this.data.orderId && !s.scope.disposed && submittedOwner === accountApi.sessionIdentity() && s.owner === submittedOwner) {
            s.changedQuote = submittedQuote; s.quote = null;
            if (s.visible) this.setData({ step: 1, canPrepare: false, errorOpen: false, quoteChange: rentalQuoteChange(submittedQuote.fees, null) });
        }
        if (active() && viewCurrent()) {
            if (quoteChanged) {
                await this.refreshQuote();
            }
            else if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 412) {
                await this.loadContext();
                if (active()) this.setData({ errorOpen: true, errorText: '订单已更新，已保留本次选择，请核对最新记录后再次确认。' });
            }
            else {
                // A failed confirmation may already have reached the server. Read the
                // original order before offering an explicit replay of its saved intent.
                if (this.data.frozen) { s.current = null; this.setData({ loaded: false, canConfirm: false, frozenSigned: false, signedAt: '' }); }
                this.showCheckoutError(error);
            }
        }
    }
    finally {
        if (active())
            this.setData({ busy: false });
        else if (sessionLost()) this.clearUnavailableSession();
    } }); },
    async recheckChangedQuote() {
        const s = state(this); await s.run('quote-review', async () => {
            const active = s.capture(accountApi.sessionIdentity);
            if (!active() || !s.owner || !s.changedQuote || this.data.busy || this.data.loading || !this.data.loaded) return;
            if (await this.refreshQuote() && active() && s.quote) {
                s.changedQuote = null;
                this.setData({ quoteChange: null, step: 1, canPrepare: s.quote.blockers.length === 0, errorText: '', errorOpen: false });
            }
        });
    },
    returnToDevice() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !s.owner || !s.id || this.data.busy || this.data.loading) return;
        s.navigation.navigateOnce('quote-device', callbacks => wx.redirectTo({ url: '/pages/detail/index?id=' + encodeURIComponent(s.id), ...callbacks }));
    },
    async restorePreparation() { const s = state(this); await s.run('restore-preparation', async () => { const pending = rentalOrderApi.pendingPreparation(); if (!pending || s.changedQuote)
        return; const epoch = s.epoch, readEpoch = s.readEpoch;
        const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readEpoch === readEpoch;
        const active = s.capture(accountApi.sessionIdentity), sessionLost = captureCheckoutSessionLoss(s); if (!active() || !s.owner) { if (viewCurrent()) this.clearUnavailableSession(); return; }
        this.setData({ busy: true }); try {
        const lookup = await rentalOrderApi.lookup('B02', pending.key).promise;
        if (!active())
            return;
        if (lookup.value.state === 'NOT_FOUND' && lookup.value.retry_same_request) {
            const result = await rentalOrderApi.prepare(pending.body as RentalSelection & {
                accepted_terms_hash: string;
            }).promise;
            if (active())
                this.setData({ orderId: result.value.order.order_id });
        }
        await this.loadContext();
    }
    catch (error) {
        if (active() && viewCurrent())
            this.showCheckoutError(error);
    }
    finally {
        if (active())
            this.setData({ busy: false });
        else if (sessionLost()) this.clearUnavailableSession();
    } }); },
    updateCalendar() {
        const today = rentalDate(new Date().toISOString()), anchor = this.data.earliestDate > today ? this.data.earliestDate : today;
        const months = buildCalendarMonths(anchor, this.data.formStartDate, this.data.formEndDate).map(month => ({ ...month, days: month.days.map(day => ({ ...day, disabled: day.disabled || !!(this.data.latestDate && day.date > this.data.latestDate) })) }));
        this.setData({ calendarMonths: months, formDays: this.data.formStartDate && this.data.formEndDate ? Math.max(0, dateDiffDays(this.data.formStartDate, this.data.formEndDate)) : 0 });
    },
    openTermSheet() { if (this.data.frozen || this.data.busy || state(this).changedQuote) return; state(this).termEpoch++; this.setData({ termSheetOpen: true, formStartDate: this.data.startDate, formEndDate: this.data.endDate, monthIndex: 0 }); this.updateCalendar(); const index = this.data.calendarMonths.findIndex(month => month.key.substring(0, 7) === this.data.formStartDate.substring(0, 7)); if (index >= 0) this.setData({ monthIndex: index }); },
    moveCalendarMonth(event: WechatMiniprogram.TouchEvent) { const index = this.data.monthIndex + Number(event.currentTarget.dataset['direction']); if (!this.data.busy && index >= 0 && index < this.data.calendarMonths.length) this.setData({ monthIndex: index }); },
    chooseCalendarDate(event: WechatMiniprogram.TouchEvent) {
        if (this.data.frozen || this.data.busy || !this.data.termSheetOpen) return;
        this.updateCalendar();
        const date = String(event.currentTarget.dataset['date']);
        const day = this.data.calendarMonths.flatMap(month => month.days).find(item => item.date === date);
        if (!day || day.disabled || day.isPlaceholder) return;
        if (!this.data.formStartDate || this.data.formEndDate || date <= this.data.formStartDate) this.setData({ formStartDate: date, formEndDate: '' });
        else this.setData({ formEndDate: date });
        this.updateCalendar();
    },
    resetPricingDates() { if (this.data.busy || this.data.frozen) return; this.setData({ formStartDate: '', formEndDate: '' }); this.updateCalendar(); },
    async applyTermSheet() { if (this.data.frozen || this.data.busy) return; try {
        const term = validateCheckoutDates(this.data.formStartDate, this.data.formEndDate, this.data.minimumDays, this.data.earliestDate, this.data.latestDate);
        const body: RentalSelection = { asset_id: state(this).id, rental_start_at: term.from, rental_end_at: term.to, delivery_method: this.data.method === 'CABINET' ? 'CABINET' : 'EXPRESS', address_id: this.data.method === 'EXPRESS' ? this.data.addressId || null : null, coupon_id: this.data.couponId || null };
        await this.refreshQuote(undefined, undefined, body, state(this).termEpoch);
    } catch (error) { this.showCheckoutError(error); } },
    closeTermSheet() { const s = state(this); s.termEpoch++; this.setData({ termSheetOpen: false, canPrepare: !!s.quote && s.quote.blockers.length === 0 }); },
    openAddressBook() { if (!state(this).capture(accountApi.sessionIdentity)() || this.data.frozen || state(this).changedQuote)
        return; const s = state(this), owner = s.owner; s.navigation.navigateOnce('address', callbacks => wx.navigateTo({ url: '/pages/addresses/index?mode=select', events: { addressSelected: (value: {
                addressId: string;
            }) => { if (!s.scope.disposed && accountApi.sessionIdentity() === owner) {
                s.quote = null;
                this.setData({ addressId: value.addressId, canPrepare: false });
            } } }, ...callbacks })); },
    openVoucherSheet() { if (!this.data.frozen && !state(this).changedQuote) {
        this.setData({ voucherSheetOpen: true });
        void this.loadVouchers(false);
    } }, closeVoucherSheet() { state(this).couponEpoch++; this.setData({ voucherSheetOpen: false }); },
    async loadVouchers(more: boolean) { const s = state(this); if (this.data.voucherLoading || (more && !this.data.voucherCursor))
        return; const epoch = s.epoch, readEpoch = ++s.voucherReadEpoch;
        const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && s.voucherReadEpoch === readEpoch;
        const lease = s.capture(accountApi.sessionIdentity), sessionLost = captureCheckoutSessionLoss(s), active = () => viewCurrent() && lease();
        if (!active() || !s.owner) { if (viewCurrent()) this.clearUnavailableSession(); return; }
        this.setData({ voucherLoading: true, voucherError: '' }); try {
        const result = await couponApi.list('AVAILABLE', more ? this.data.voucherCursor : null).promise;
        if (!active())
            return;
        const rows = result.items.filter(v => v.coupon_type === 'DEPOSIT_WAIVER' || v.coupon_type === 'ONE_DAY_RENT').map(v => ({ id: v.coupon_id, label: v.coupon_type === 'DEPOSIT_WAIVER' ? '免押券' : '一日租金券' }));
        this.setData({ vouchers: more ? [...this.data.vouchers, ...rows.filter(row => !this.data.vouchers.some(v => v.id === row.id))] : rows, voucherCursor: result.page.next_cursor });
    }
    catch (error) {
        if (active())
            this.setData({ voucherError: error instanceof Error ? error.message : '优惠券读取失败' });
    }
    finally {
        if (sessionLost()) this.clearUnavailableSession();
        else if (viewCurrent() && lease()) this.setData({ voucherLoading: false });
    } },
    loadMoreVouchers() { void this.loadVouchers(true); }, retryVouchers() { void this.loadVouchers(false); }, chooseVoucher(event: WechatMiniprogram.TouchEvent) { if (!this.data.busy)
        void this.refreshQuote(String(event.currentTarget.dataset['id'] ?? ''), ++state(this).couponEpoch); },
    retryQuote() { void this.refreshQuote(); }, openIdentity() { state(this).navigation.navigateOnce('identity', callbacks => wx.navigateTo({ url: '/pages/identity/index', ...callbacks })); },
    openOrder() { const s = state(this); if (s.capture(accountApi.sessionIdentity)() && s.owner && this.data.loaded && !this.data.loading && !this.data.busy && this.data.orderId && s.current?.value.order.order_id === this.data.orderId)
        state(this).navigation.navigateOnce('order', callbacks => wx.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(this.data.orderId), ...callbacks })); },
    openContract() { const s = state(this); if (s.capture(accountApi.sessionIdentity)() && s.owner && this.data.loaded && !this.data.loading && !this.data.busy && this.data.orderId && s.current?.value.order.order_id === this.data.orderId)
        state(this).navigation.navigateOnce('contract', callbacks => wx.navigateTo({ url: '/pages/contract/index?orderId=' + encodeURIComponent(this.data.orderId), ...callbacks })); },
    handleNavigationBack() { if (!this.data.busy) navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
