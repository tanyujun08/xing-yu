import { demoWx } from '../../preview/platform';
import { cabinetApi } from '../../shared/api/supply-api';
import { openSupplyLocation } from '../../shared/presentation/supply-location';
import { testPaymentNote } from '../../shared/presentation/rental-payment-mode';
import { designAssets } from '../../shared/design/assets';
import { emptyFundingHistory, fundingHistoryRow } from './funding-history';
import { accountApi, addressApi, findOwnAddress, ApiProblem, type OwnAddress } from '../../shared/api/account-api';
import { rentalOrderApi, type RentalOrder, type RentalRecord, type RentalPayment, type RentalReturn } from '../../shared/api/rental-api';
import { createRentalPageState } from '../../shared/interaction/rental-page-state';
import { navigateBackWithFallback } from '../../shared/interaction/navigate-once';
import { rentalStateLabel, rentalActions, rentalActionAllowed, rentalBlockers, rentalMoney, beijingTime, rentalDate, rentalDateRange, beijingInputToUTC, rentalDepositSettlementVisible } from '../../shared/presentation/rental-order';
import { publicMedia } from '../../shared/presentation/material-media';
import { finalRentalAssessment } from '../../shared/presentation/rental-fees';
import { readNavigationMetrics } from '../../shared/presentation/navigation-metrics';
import { rentalOrderResult } from '../../shared/presentation/rental-order-result';
import { rentalOrderPreparation } from '../../shared/presentation/rental-order-preparation';
import { anchorOrderPaymentClock, orderPaymentNow, currentOrderPayments, assertOrderPayment, originalOrderPayment, paymentCanInvoke, paymentDeadlineValid, rentalOrderPayment } from '../../shared/presentation/rental-order-payment';
import { personalDeliveryAction, rentalDeliveryAddressText, rentalOrderDelivery } from '../../shared/presentation/rental-order-delivery';
import { rentalOrderPickup } from '../../shared/presentation/rental-order-pickup';
import { assertOriginalOrderRefund, rentalOrderSettlement } from '../../shared/presentation/rental-order-settlement';
import { rentalOrderNonfulfillment } from '../../shared/presentation/rental-order-nonfulfillment';
import { rentalOrderCompletion } from '../../shared/presentation/rental-order-completion';
import { originalPostedEarning, rentalReturnReview } from '../../shared/presentation/rental-return-review';
import { setOrderListContext } from '../../shared/interaction/order-list-context';
import { rentalReturnDispatch, returnAddressSnapshot } from '../../shared/presentation/rental-return-dispatch';
import { rememberReturnAddressConfirmation, clearReturnAddressConfirmation } from '../../shared/interaction/return-address-confirmation';

const emptyDeliveryView = () => ({ orderCabinetId: '', orderCabinetName: '', orderCabinetAddress: '', preparationPage: null as ReturnType<typeof rentalOrderPreparation>, nonfulfillmentPage: null as ReturnType<typeof rentalOrderNonfulfillment>, returnDispatchPage: null as ReturnType<typeof rentalReturnDispatch>, returnAddressChecked: false, returnReviewPage: null as ReturnType<typeof rentalReturnReview>, earningError: '', completionPage: null as ReturnType<typeof rentalOrderCompletion>, completionRecordsExpanded: false, settlementPage: null as ReturnType<typeof rentalOrderSettlement>, pickupPage: null as ReturnType<typeof rentalOrderPickup>, pickupSigned: false, pickupContractError: '', deliveryPage: null as ReturnType<typeof rentalOrderDelivery>, deliveryUnknown: false, deliveryTenant: '', deliveryTenantError: '', deliveryAddressAction: '', deliveryAddressKnown: false, shipmentPending: false, shipmentError: '', shipmentErrorField: '' });
type ReviewMedia = { key: string; materialId: string; kind: 'PHOTO' | 'VIDEO'; available: boolean; url: string; poster: string };
type ReviewLoss = { key: string; description: string; amount: string; evidence: ReviewMedia[] };
type ReviewVideo = { key: string; src: string; poster: string };
type Assessment = NonNullable<RentalOrder['bill']['assessment']>;
type ReceiptBody = { received_at: string; note: string | null };
function returnAddressOption(a: OwnAddress) { return { id: a.address_id, name: a.recipient_name, phone: a.phone_country_code + ' ' + a.phone, region: a.province_name + a.city_name + a.district_name, detail: a.detail_address }; }
function usableReturnAddress(a: OwnAddress) { return a.status === 'ACTIVE' && [a.address_id, a.recipient_name, a.phone_country_code, a.phone, a.province_id, a.city_id, a.district_id, a.province_name, a.city_name, a.district_name, a.detail_address].every(value => !!value?.trim()); }
const emptyReturnForm = () => ({ returnSheet: '' as '' | 'receipt' | 'address', returnBusy: false, returnError: '', returnErrorField: '', returnPending: false, receiptDate: '', receiptTime: '', receiptNote: '', addressOptions: [] as ReturnType<typeof returnAddressOption>[], addressNext: false, addressListOpen: false, addressListBusy: false, selectedAddressId: '', addressNotice: '' });
function couponStatusLabel(status: RentalOrder['coupon_status']): string {
    if (status === null) return '本单未使用优惠券';
    const labels = { RESERVED: '本单预占中', CONSUMED: '已使用', RELEASED: '预占已释放', RESTORED: '已恢复' };
    return labels[status] ?? '待核实';
}
function projectReviewMedia(items: Assessment['evidence'], prefix: string): ReviewMedia[] {
    return items.map((item, index) => {
        // Existing business media requires a video's own poster; absent poster is unavailable, never fabricated.
        const media = item.availability === 'READY' && item.media?.material_id === item.material_id ? publicMedia(item.media) : null;
        const available = !!media && (item.kind === 'VIDEO' ? item.media?.role === 'VIDEO' : item.media?.role !== 'VIDEO');
        return { key: prefix + '-' + index, materialId: item.material_id, kind: item.kind, available, url: available ? media!.url : '', poster: available ? media!.poster : '' };
    });
}
function projectAssessment(assessment: Assessment | null | undefined) {
    const lossItems: ReviewLoss[] = assessment?.loss_items.map((item, index) => ({
        key: 'loss-' + index, description: item.description, amount: rentalMoney(item.confirmed_fen),
        evidence: projectReviewMedia(item.evidence, 'loss-' + index),
    })) ?? [];
    const shown = new Set(lossItems.flatMap(item => item.evidence.map(media => media.materialId)));
    const labels = { APPROVE_FINAL: '官方费用已核定', REVIEW_PENDING: '官方审核中', MATERIAL_REQUIRED: '需补充材料' };
    return {
        assessmentVisible: !!assessment,
        assessmentStatus: assessment ? labels[assessment.decision] : '',
        assessmentNotes: assessment ? [
            { key: 'rejection', text: assessment.rejection_reason ?? '' },
            { key: 'adjustment', text: assessment.adjustment_reason ?? '' },
            { key: 'missingItems', text: assessment.missing_items.length ? '待补充凭证：' + assessment.missing_items.map(item => item.reason).join('；') : '' },
        ].filter(item => !!item.text) : [],
        lossItems,
        reviewEvidence: assessment ? projectReviewMedia(assessment.evidence.filter(item => !shown.has(item.material_id)), 'review') : [],
    };
}
const states = new WeakMap<object, ReturnType<typeof createRentalPageState<RentalRecord<RentalOrder>>> & {
    returnGuideRequested: boolean; returnAddressAck: string; readSequence: number; returnRecord: RentalRecord<RentalReturn> | null; sheetSequence: number; commandOwner: string; paymentQueryAfter: Record<string, number>;
    addresses: OwnAddress[]; addressCursor: string | null; originalAddress: OwnAddress | null;
    addressBookReturn: { selectedId: string } | null; appliedAddressId: string;
    pendingReceipt: ReceiptBody | null; pendingAddressId: string;
}>();
function state(page: object) { let s = states.get(page); if (!s) {
    s = { ...createRentalPageState<RentalRecord<RentalOrder>>(), returnGuideRequested: false, returnAddressAck: '', readSequence: 0, returnRecord: null, sheetSequence: 0, commandOwner: '', paymentQueryAfter: {}, addresses: [], addressCursor: null, originalAddress: null, addressBookReturn: null, appliedAddressId: '', pendingReceipt: null, pendingAddressId: '' };
    states.set(page, s);
} return s; }
function captureExpiredDetailView(page: object) {
    const s = state(page), epoch = s.epoch, owner = s.owner;
    return () => s.visible && !s.scope.disposed && s.epoch === epoch && s.owner === owner && (accountApi.sessionIdentity() ?? '') !== owner;
}
Page({
    async showFundingHistory(event?: WechatMiniprogram.TouchEvent) {
		const kind = event?.currentTarget.dataset['kind'] === 'refund' ? 'refund' : 'payment';
		if (this.data.fundingHistoryBusy) return;
		this.setData({ ...emptyFundingHistory(), fundingHistoryOpen: true, fundingHistoryKind: kind });
		await this.loadFundingHistory('');
	},
	async nextFundingHistory() {
		if (this.data.fundingHistoryNext && !this.data.fundingHistoryBusy) {
			const old = this.data.fundingHistoryCursor;
			if (await this.loadFundingHistory(this.data.fundingHistoryNext)) this.setData({ fundingHistoryPrevious: [...this.data.fundingHistoryPrevious, old] });
		}
	},
	async previousFundingHistory() {
		const previous = this.data.fundingHistoryPrevious;
		if (previous.length && !this.data.fundingHistoryBusy && await this.loadFundingHistory(previous[previous.length - 1]!)) this.setData({ fundingHistoryPrevious: previous.slice(0, -1) });
	},
	async loadFundingHistory(cursor?: string) {
        cursor ??= this.data.fundingHistoryCursor;
		const s = state(this), active = s.capture(accountApi.sessionIdentity), sequence = s.readSequence;
		if (!active() || !s.current || s.current.value.order.viewer_role !== 'TENANT' || this.data.fundingHistoryBusy) return false;
		this.setData({ fundingHistoryBusy: true, fundingHistoryError: '' });
		try {
			const handle = this.data.fundingHistoryKind === 'payment' ? rentalOrderApi.paymentHistory(s.id, cursor || undefined) : rentalOrderApi.refundHistory(s.id, cursor || undefined);
			const response = await handle.promise;
			if (!active() || s.readSequence !== sequence) return false;
			if (response.value.items.some(item => item.order_id !== s.id)) throw new Error('交易记录与本订单不匹配');
			this.setData({ fundingHistoryRows: response.value.items.map(fundingHistoryRow), fundingHistoryNext: response.value.next_cursor ?? '', fundingHistoryCursor: cursor });
			return true;
		} catch (error) {
			if (active() && s.readSequence === sequence) this.setData({ fundingHistoryError: error instanceof Error ? error.message : '读取失败，请重试' });
			return false;
		} finally { if (active() && s.readSequence === sequence) this.setData({ fundingHistoryBusy: false }); }
	},
    retryFundingHistory() { void this.loadFundingHistory(); },
    // A result screen is only selected from the current authenticated server snapshot.
    data: { testPaymentNotice: '', ...emptyFundingHistory(), ...emptyDeliveryView(), paymentSummary: '', paymentPage: null as ReturnType<typeof rentalOrderPayment>, cancelDialog: false, paymentUnknown: false, discount: '', hasDiscount: false, viewContract: false, resultPage: null as ReturnType<typeof rentalOrderResult> | null, icons: designAssets, recoveryHeight: 480, feeBasisVisible: false, returnLanding: false, returnDeadline: '', returnEntryAction: '', returnGuideOpen: false, returnPhotoCount: 0, pickupGuideOpen: false, ...emptyReturnForm(), returnTracking: '', paymentRows: [] as { id: string; canQuery: boolean; purpose: string; status: string; amount: string; cash: string; created: string; verified: string }[], quotaVisible: false, quotaState: '', quotaValidUntil: '', quotaError: '', pickupVisible: false, pickupCode: '', pickupError: '', pickupStart: '', pickupEnd: '', pickupName: '', pickupAddress: '', pickupCompartment: '', returnAddress: '', returnVersion: '', returnMaterialState: '', depositSettlementVisible: false, refundRecordVisible: false, refundTitle: '', refundHelp: '', refundFailed: false, refundStatus: '', refundId: '', refundReason: '', refundAmount: '', refundCash: '', refundAt: '', loaded: false, loading: false, busy: false, errorText: '', orderId: '', title: '', media: '', assetId: '', assetFacts: [] as {
            label: string;
            value: string;
        }[], orderNo: '', role: '', peerContact: '', status: '', blockers: '', hasException: false, exceptions: [] as string[], stage: '', physical: '', review: '', term: '', deadline: '', pickupText: '', recipient: '', tracking: '', carrier: '', delivered: '', returned: '', completed: '', closed: '', couponStatus: '', rent: '', deposit: '', total: '', paid: '', overtime: '', loss: '', refundDue: '', refunded: '', supplement: '', billFinalized: false, ...projectAssessment(null), reviewVideo: null as ReviewVideo | null, reviewVideoKey: '', reviewVideoEpoch: 0, reviewPlayerVersion: 0, reviewVideoError: '', actions: [] as ReturnType<typeof rentalActions>, orderInfoExpanded: false, progressExpanded: false, shipmentSheet: false, trackingInput: '', carrierInput: '', correctionReason: '', shipmentCorrection: false, paymentNotice: '' },
    dismissFeedback() { if (!this.data.busy) this.setData({ errorText: '', pickupGuideOpen: false }); },
    onLoad(options: Record<string, string | undefined>) { state(this).id = options['id'] ?? options['orderId'] ?? ''; this.setData({ orderId: state(this).id }); this.measureRecovery(); },
    onResize() { this.measureRecovery(); },
    measureRecovery() {
        try {
            const info = wx.getWindowInfo(), navigation = readNavigationMetrics(52);
            const safeBottom = Math.max(0, info.screenHeight - (info.safeArea?.bottom ?? info.screenHeight));
            const height = info.windowHeight - navigation.totalHeight - 136 - safeBottom;
            if (Number.isFinite(height)) this.setData({ recoveryHeight: Math.max(240, height) });
        } catch { /* The error page remains readable when window metrics are unavailable. */ }
    },
    onShow() { const s = state(this), owner = accountApi.sessionIdentity() ?? ''; if (owner && s.commandOwner && s.commandOwner !== owner) { s.returnAddressAck = ''; s.paymentQueryAfter = {}; s.addressBookReturn = null; s.appliedAddressId = ''; s.pendingReceipt = null; s.pendingAddressId = ''; s.originalAddress = null; s.addresses = []; this.setData(emptyReturnForm()); } if (owner) s.commandOwner = owner; s.show(owner); this.clearReviewMedia(); void this.resumeOrderView(); },
    async resumeOrderView() {
        const s = state(this), active = s.capture(accountApi.sessionIdentity);
        await this.refreshStatus();
        if (!active() || !this.data.loaded || !s.addressBookReturn) return;
        const selection = s.addressBookReturn; s.addressBookReturn = null;
        await this.openReturnSheet('address');
        if (!active() || this.data.returnSheet !== 'address' || !selection.selectedId) return;
        const sequence = s.sheetSequence;
        this.setData({ addressListBusy: true });
        try {
            const address = await findOwnAddress(selection.selectedId);
            if (!active() || sequence !== s.sheetSequence) return;
            if (!address || !usableReturnAddress(address)) { this.setData({ selectedAddressId: '', returnError: '所选地址已不可用，请重新选择。' }); return; }
            s.addresses = [address, ...s.addresses.filter(item => item.address_id !== address.address_id)];
            this.setData({ addressOptions: s.addresses.map(returnAddressOption) });
            this.selectReturnAddress(address.address_id);
        } catch (error) { if (active() && sequence === s.sheetSequence) this.setData({ returnError: error instanceof Error ? error.message : '所选地址读取失败，请重新选择。' }); }
        finally { if (active() && sequence === s.sheetSequence) this.setData({ addressListBusy: false }); else if (captureExpiredDetailView(this)()) this.clearUnavailableOrder(); }
    },
    toggleReturnPreparation() { if (state(this).capture(accountApi.sessionIdentity)() && this.data.returnLanding) this.setData({ returnGuideOpen: !this.data.returnGuideOpen }); },
    showReturnGuide() { if (state(this).capture(accountApi.sessionIdentity)()) void wx.showModal({ title: '归还前请准备', content: '按示例拍摄设备与配件、录制验机视频。凭证提交后选择归还柜格，放妥设备，拍摄入柜照片并关门，再点击确认归还。', showCancel: false, confirmText: '知道了' }); },
    onHide() { const s = state(this); s.hide(); s.returnGuideRequested = false; s.returnAddressAck = ''; s.sheetSequence++; s.returnRecord = null; s.addresses = []; this.clearReviewMedia(); this.setData({ ...emptyFundingHistory(), ...emptyDeliveryView(), returnLanding: false, returnEntryAction: '', pickupGuideOpen: false, ...emptyReturnForm(), loading: false, busy: false, pickupVisible: false, pickupCode: '', pickupError: '', returnAddress: '', refundReason: '', loaded: false, resultPage: null, paymentPage: null, cancelDialog: false, actions: [], shipmentSheet: false, couponStatus: '', recipient: '', tracking: '', carrier: '', assetFacts: [], trackingInput: '', carrierInput: '', correctionReason: '', paymentNotice: '', paymentRows: [], quotaVisible: false, quotaState: '', quotaValidUntil: '', quotaError: '', returnTracking: '' }); }, onUnload() { this.clearReviewMedia(); state(this).dispose(); },
    clearUnavailableOrder() {
        const s = state(this);
        s.current = null; s.returnRecord = null; s.returnGuideRequested = false; s.returnAddressAck = ''; s.sheetSequence++;
        // Retain owner-bound unknown command intents for explicit same-account recovery.
        // onShow clears them only when the page actually changes account ownership.
        s.addresses = [];
        this.clearReviewMedia();
        this.setData({ ...emptyFundingHistory(), ...emptyDeliveryView(), returnLanding: false, returnEntryAction: '', pickupGuideOpen: false, ...emptyReturnForm(), loading: false, loaded: false, busy: false, resultPage: null, paymentPage: null, cancelDialog: false, actions: [], shipmentSheet: false,
            title: '', media: '', assetId: '', assetFacts: [], orderNo: '', role: '', peerContact: '', status: '',
            pickupVisible: false, pickupCode: '', pickupError: '', pickupName: '', pickupAddress: '', pickupCompartment: '',
            recipient: '', tracking: '', carrier: '', returnAddress: '', returnVersion: '', refundReason: '',
            trackingInput: '', carrierInput: '', correctionReason: '', paymentNotice: '', paymentRows: [], quotaVisible: false, quotaState: '', quotaValidUntil: '', quotaError: '', returnTracking: '',
            errorText: '登录状态已失效或变化，请返回重新登录后进入本人订单' });
    },
    async queryNonfulfillment() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !s.owner || !s.current || !this.data.loaded || this.data.loading || this.data.busy) return;
        const view = rentalOrderNonfulfillment(s.current.value);
        if (!view) return;
        if (view.canQuery) await this.runAction('QUERY_REFUND');
        else await this.refreshStatus();
    },
    async refreshStatus() { const s = state(this); s.abort?.(); const readSequence = ++s.readSequence, epoch = s.epoch; this.clearReviewMedia(); this.setData({ nonfulfillmentPage: null, returnDispatchPage: null, returnAddressChecked: false, returnAddress: '', returnTracking: '', returnVersion: '', returnMaterialState: '', returnReviewPage: null, earningError: '', completionPage: null, completionRecordsExpanded: false });
        // View ownership may finish a spinner; only the authenticated lease may publish order data.
        const viewCurrent = () => s.visible && !s.scope.disposed && s.epoch === epoch && s.readSequence === readSequence;
        const lease = s.capture(accountApi.sessionIdentity), active = () => viewCurrent() && lease(), expiredView = captureExpiredDetailView(this);
        if (!active()) { if (viewCurrent()) this.clearUnavailableOrder(); return; }
        if (!s.owner || !s.id) {
        this.clearUnavailableOrder();
        this.setData({ errorText: '请登录并从本人订单进入' });
        return;
    } s.current = null; s.returnRecord = null; this.setData({ loading: true, loaded: false, preparationPage: null, settlementPage: null, returned: '', pickupPage: null, pickupSigned: false, pickupContractError: '', deliveryAddressKnown: false, deliveryPage: null, deliveryTenant: '', deliveryTenantError: '', deliveryAddressAction: '', resultPage: null, paymentPage: null, cancelDialog: false, actions: [], errorText: '', pickupCode: '', pickupVisible: false, pickupError: '' }); try {
        const handle = rentalOrderApi.get(s.id);
        s.abort = handle.abort;
        const result = await handle.promise;
        if (!active())
            return;
        if (result.value.order.order_id !== s.id)
            throw new Error('订单回读不匹配');
        s.current = result; anchorOrderPaymentClock(result.value); this.setData(emptyFundingHistory());
        const v = result.value, o = v.order, b = v.bill;
        const durationDays = (Date.parse(o.rental_end_at) - Date.parse(o.rental_start_at)) / 86400000;
        const supplyLabel = o.supply_channel === 'PERSONAL' ? '个人' : o.supply_channel === 'OFFICIAL_CABINET' ? '官方' : '';
        this.setData({ testPaymentNotice: o.payment_mode === 'FIXED_10_FEN' ? testPaymentNote : '', paymentSummary: [supplyLabel, rentalDateRange(o.rental_start_at, o.rental_end_at), Number.isInteger(durationDays) && durationDays > 0 ? `共${durationDays}天` : ''].filter(Boolean).join(' · '), completionPage: rentalOrderCompletion(v), preparationPage: rentalOrderPreparation(v) });
        this.setData({ settlementPage: rentalOrderSettlement(v), pickupPage: rentalOrderPickup(v), pickupSigned: false, pickupContractError: '', deliveryPage: rentalOrderDelivery(v), deliveryUnknown: false, resultPage: rentalOrderResult(v), paymentPage: rentalOrderPayment(v), paymentUnknown: false, discount: rentalMoney(v.fees.rent_discount_fen), hasDiscount: /^[1-9][0-9]*$/.test(v.fees.rent_discount_fen), viewContract: !!v.contract_id && rentalActionAllowed(o.allowed_actions, 'VIEW_CONTRACT') });
        const nonfulfillment = rentalOrderNonfulfillment(v);
        this.setData({ nonfulfillmentPage: nonfulfillment });
        if (nonfulfillment) this.setData({ pickupPage: null, deliveryPage: null, resultPage: null });
        this.setData({ returnLanding: v.delivery.method === 'CABINET' && o.viewer_role === 'TENANT' && o.physical_status === 'IN_USE' && !o.has_exception && o.allowed_actions.some(a => a.allowed && ['SAVE_RETURN_EVIDENCE', 'START_RETURN'].includes(a.action_code)), returnDeadline: beijingTime(o.rental_end_at), returnPhotoCount: (v.requirements?.return_evidence_template?.slots ?? []).filter(slot => slot.stage === 'PRE_RETURN' && slot.kind === 'PHOTO').reduce((n,slot) => n + slot.min_count,0), returnEntryAction: o.allowed_actions.find(a => a.allowed && ['SAVE_RETURN_EVIDENCE', 'START_RETURN'].includes(a.action_code))?.action_code ?? '', loaded: true, title: o.asset.title, media: o.asset.cover_media?.url ?? '', orderNo: o.order_no, role: o.viewer_role === 'LESSOR' ? '我的出租订单' : '我的租赁订单', peerContact: o.supply_channel === 'PERSONAL' && ['TENANT', 'LESSOR'].includes(o.viewer_role) ? o.viewer_role === 'TENANT' ? '联系出租方' : '联系承租方' : '', status: o.display_status, blockers: rentalBlockers(o.blockers), hasException: o.has_exception, exceptions: o.exception_codes, stage: rentalStateLabel(o.stage), physical: rentalStateLabel(o.physical_status), review: rentalStateLabel(o.review_status), assetId: o.asset.asset_id, assetFacts: v.asset_snapshot ? [{ label: "设备说明", value: v.asset_snapshot.description }, { label: "成色", value: v.asset_snapshot.condition_description }, { label: "设备编号", value: v.asset_snapshot.physical_identifier_display ?? "" }, { label: "随附配件", value: v.asset_snapshot.accessories.map(item => item.name + " × " + item.quantity).join("、") }].filter(item => !!item.value) : [], term: rentalDateRange(o.rental_start_at, o.rental_end_at), deadline: beijingTime(o.stage === 'PREPARING' ? v.hold_expires_at : v.payment_due_at), pickupText: v.delivery.method === 'CABINET' ? '租赁柜取还' : '快递往返', recipient: rentalDeliveryAddressText(v.delivery.recipient), tracking: v.delivery.tracking_no ?? '', carrier: v.delivery.carrier ?? '', delivered: beijingTime(v.delivery.delivered_at), completed: beijingTime(v.completed_at), closed: beijingTime(v.closed_at), couponStatus: couponStatusLabel(v.coupon_status), rent: rentalMoney(v.fees.rent_gross_fen), deposit: rentalMoney(v.fees.deposit_due_fen), total: rentalMoney(v.fees.initial_due_fen), paid: rentalMoney(o.initial_payer_total_fen), overtime: rentalMoney(b.overtime_fen), loss: rentalMoney(b.loss_fen), refundDue: rentalMoney(b.refund_due_fen), refunded: rentalMoney(b.deposit_refunded_fen), supplement: rentalMoney(b.supplement_due_fen), billFinalized: b.finalized, ...projectAssessment(b.assessment), reviewVideoEpoch: readSequence, actions: rentalActions(o.allowed_actions) });
        const paymentLabels = { CREATED: '待付款', PROCESSING: '支付处理中', UNKNOWN: '支付结果待核实', SUCCEEDED: '支付已成功', FAILED_CONFIRMED: '支付未完成', CLOSED_UNPAID: '未支付已关闭' };
        this.setData({ paymentRows: [b.initial_payment, b.supplement?.active_payment, b.supplement?.paid_payment].filter((p): p is RentalPayment => !!p).filter((p, i, all) => all.findIndex(other => other.payment_id === p.payment_id) === i).map(payment => ({ id: payment.payment_id, canQuery: o.viewer_role === 'TENANT' && (payment.allowed_actions ?? []).some(action => action.action_code === 'QUERY_PAYMENT' && action.allowed), purpose: payment.purpose === 'INITIAL' ? '订单支付' : '补缴支付', status: paymentLabels[payment.status] ?? '待核实', amount: rentalMoney(payment.amount_fen), cash: rentalMoney(payment.payer_total_fen), created: beijingTime(payment.created_at), verified: beijingTime(payment.last_verified_at) })), quotaVisible: o.stage === 'CLOSED', quotaState: '待核实', quotaValidUntil: '待核实', quotaError: '' });
        const depositSettlementVisible = rentalDepositSettlementVisible(v);
        const refund = b.refund_summary.latest_refund?.purpose === 'OBSERVED_NONFULFILLMENT' || depositSettlementVisible ? b.refund_summary.latest_refund : null;
        const nonfulfillmentRefund = refund?.purpose === 'OBSERVED_NONFULFILLMENT';
        this.setData({ depositSettlementVisible, feeBasisVisible: !!finalRentalAssessment(v), refundRecordVisible: !!refund, refundTitle: nonfulfillmentRefund ? '未履约退款记录' : '原退押记录', refundHelp: nonfulfillmentRefund ? '请联系客服处理原退款；以原交易的渠道结果为准。' : '请联系客服处理原退款；当前失败不代表订单已完成。' });
        this.setData({ actions: rentalActions(o.allowed_actions.filter(action => action.action_code !== 'READ_PICKUP_CODE' && (action.action_code !== 'QUERY_REFUND' || !!refund))).map(action => action.action_code === 'QUERY_REFUND' && nonfulfillmentRefund ? { ...action, label: '查询退款结果' } : o.viewer_role === 'LESSOR' && action.action_code === 'START_RETURN' ? { ...action, label: '设置返程收货地址' } : action.action_code === 'OPEN_CABINET' && !v.return_id && !v.latest_cabinet_tasks.some(task => task.purpose === 'PICKUP') ? { ...action, label: '取件指引' } : action) });
        const refundWord = nonfulfillmentRefund ? '退款' : '退押';
        const refundLabels = { CREATED: `待${refundWord}`, PROCESSING: `${refundWord}处理中`, UNKNOWN: `${refundWord}结果待核实`, SUCCEEDED: `${refundWord}已成功`, FAILED_CONFIRMED: `${refundWord}失败，请联系官方处理` };
        this.setData({ refundFailed: refund?.status === 'FAILED_CONFIRMED', refundId: refund?.refund_id ?? '', refundStatus: refund ? refundLabels[refund.status] : '', refundReason: refund ? rentalBlockers(refund.blockers) || refund.allowed_actions.map(a => a.display_reason ?? '').filter(Boolean).join('；') : '', refundAmount: refund ? rentalMoney(refund.amount_fen) : '', refundCash: refund ? rentalMoney(refund.payer_refund_fen) : '', refundAt: beijingTime(refund?.refunded_at) });
        if (v.return_id) {
            const returned = await rentalOrderApi.return(s.id).promise;
            if (!active()) return;
            if (returned.value.order_id !== s.id || returned.value.return_id !== v.return_id) throw new Error('归还记录与本单不匹配');
            s.returnRecord = returned; this.setData({ deliveryAddressKnown: true });
            const r = returned.value;
            this.setData({ returnTracking: r.tracking_no ?? '', returned: beijingTime(r.received_at), returnAddress: rentalDeliveryAddressText(r.address), returnVersion: r.address_version, returnMaterialState: rentalStateLabel(r.material_status) });
        } else this.setData({ deliveryAddressKnown: true, returnTracking: '', returned: '', returnAddress: '', returnVersion: '', returnMaterialState: '' });
        const dispatch = rentalReturnDispatch(v, s.returnRecord?.value ?? null, Date.now(), s.returnGuideRequested), addressSnapshot = returnAddressSnapshot(s.returnRecord?.value);
        if (!addressSnapshot || dispatch?.code !== 'F1b' || s.returnAddressAck !== addressSnapshot) s.returnAddressAck = '';
        this.setData({ returnDispatchPage: dispatch, returnAddressChecked: !!s.returnAddressAck, returnReviewPage: rentalReturnReview(v, s.returnRecord?.value ?? null) });
        if (dispatch) this.setData({ returnLanding: false, deliveryPage: null });
        if (this.data.returnReviewPage?.complete && v.earning_id) {
            try {
                const earning = (await rentalOrderApi.earning(v.earning_id).promise).value;
                if (!active()) return;
                if (!originalPostedEarning(v, earning)) throw new Error('收益记录与本单不匹配，请刷新后核实。');
                this.setData({ returnReviewPage: rentalReturnReview(v, s.returnRecord?.value ?? null, earning) });
            } catch (error) { if (active()) this.setData({ earningError: error instanceof Error ? error.message : '收益记录读取失败，请刷新本单。' }); }
        }
        if (active() && this.data.deliveryPage && !this.data.deliveryPage.tenant) {
            this.setData({ shipmentPending: !!rentalOrderApi.pendingShipment(s.id), deliveryAddressAction: this.data.deliveryPage.kind === 'using' && this.canManageReturn('address') ? s.returnRecord ? 'SET_RETURN_ADDRESS' : 'START_RETURN' : '' });
            if (this.data.deliveryPage.kind === 'using' && this.data.viewContract) {
                try {
                    const contract = (await rentalOrderApi.contract(s.id).promise).value;
                    if (!active()) return;
                    if (contract.order_id !== s.id || contract.contract_id !== v.contract_id || contract.status !== 'SUCCEEDED' || contract.tenant_signature.status !== 'SUCCEEDED') throw new Error('承租人信息与本单合同不匹配');
                    this.setData({ deliveryTenant: contract.tenant_signature.name, deliveryTenantError: '' });
                } catch (error) { if (active()) this.setData({ deliveryTenant: '', deliveryTenantError: error instanceof Error ? error.message : '承租人信息暂不可用，请刷新本单' }); }
            }
        }
        if (o.stage === 'PREPARING' && v.contract_id) {
            try {
                const contract = (await rentalOrderApi.contract(s.id).promise).value;
                if (!active()) return;
                if (contract.order_id !== s.id || contract.contract_id !== v.contract_id) throw new Error('合同与本单不匹配，请刷新订单');
                this.setData({ preparationPage: rentalOrderPreparation(v, contract) });
            } catch (error) {
                if (active()) this.setData({ errorText: error instanceof Error ? error.message : '合同读取失败，请刷新订单' });
            }
        }
        if (active()) this.setData({ orderCabinetId: v.pickup?.cabinet_id ?? '', orderCabinetName: v.pickup?.name ?? '', orderCabinetAddress: v.pickup?.address ?? '' });
        await this.readPickupCode(result, active);
        if (active() && this.data.pickupPage && this.data.viewContract) {
            try {
                const contract = (await rentalOrderApi.contract(s.id).promise).value;
                if (!active()) return;
                if (contract.order_id !== s.id || contract.contract_id !== v.contract_id || contract.status !== 'SUCCEEDED' || contract.tenant_signature.status !== 'SUCCEEDED' || !contract.final_artifact) throw new Error('本单已签合同尚未核实，请刷新订单');
                this.setData({ pickupSigned: true });
            } catch (error) { if (active()) this.setData({ pickupContractError: error instanceof Error ? error.message : '合同读取失败，请刷新本单' }); }
        }
        if (active() && o.stage === 'CLOSED') await this.readClosedQuota(result, active);
    }
    catch (error) {
        if (active())
            this.setData({ errorText: error instanceof Error ? error.message : '订单读取失败', pickupCode: '', pickupVisible: false });
    }
    finally {
        if (expiredView()) this.clearUnavailableOrder();
        else if (active()) this.setData({ loading: false });
    } },
    openOrderCabinet() {
        const s = state(this), id = s.current?.value.pickup?.cabinet_id;
        if (!this.data.loaded || !s.capture(accountApi.sessionIdentity)() || !id) return;
        s.navigation.navigateOnce('order-cabinet', callbacks => wx.navigateTo({ url: '/pages/cabinet-detail/index?id=' + encodeURIComponent(id), ...callbacks }));
    },
    async navigateOrderCabinet() {
        const s = state(this), id = s.current?.value.pickup?.cabinet_id, active = s.capture(accountApi.sessionIdentity), sequence = s.readSequence;
        if (!this.data.loaded || !active() || !id) return;
        try {
            const cabinet = await cabinetApi.detail(id).promise;
            if (!active() || sequence !== s.readSequence || !this.data.loaded || s.current?.value.pickup?.cabinet_id !== id) return;
            const location = cabinet.address.location;
            openSupplyLocation({ name: cabinet.name, address: [cabinet.address.province_name, cabinet.address.city_name, cabinet.address.district_name, cabinet.address.detail_address].filter(Boolean).join(''), ...(location?.coordinate_system === 'GCJ02' ? { latitude: Number(location.latitude), longitude: Number(location.longitude) } : {}) });
        } catch (error) { if (active() && sequence === s.readSequence) wx.showToast({ title: error instanceof Error ? error.message : '地点暂不可用，请重试', icon: 'none' }); }
    },
    async readClosedQuota(record: RentalRecord<RentalOrder>, active: () => boolean) {
        try {
            const contract = await rentalOrderApi.contract(state(this).id).promise;
            if (!active()) return;
            const v = contract.value;
            if (v.order_id !== state(this).id || v.contract_id !== record.value.contract_id) throw new Error('合同权益与本单不匹配');
            const labels = { NOT_APPLICABLE: '不使用合同次数', RESERVED: '已预占', CONSUMED: '已消费', RELEASED: '预占已释放', RESTORED: '已恢复' };
            this.setData({ quotaState: labels[v.quota_state] ?? '待核实', quotaValidUntil: v.quota_state === 'NOT_APPLICABLE' ? '不适用' : v.quota_valid_until === null ? '长期有效（无期限）' : beijingTime(v.quota_valid_until), quotaError: '' });
        } catch (error) { if (active()) this.setData({ quotaState: '待核实', quotaValidUntil: '待核实', quotaError: error instanceof Error ? error.message : '合同权益读取失败，请刷新本单或联系客服' }); }
    },
    async readPickupCode(record: RentalRecord<RentalOrder>, active: () => boolean) {
        if (!active() || !rentalActionAllowed(record.value.order.allowed_actions, 'READ_PICKUP_CODE')) return;
        const v = record.value;
        this.setData({ pickupVisible: true, pickupStart: rentalDate(v.order.rental_start_at), pickupEnd: rentalDate(v.order.rental_end_at), pickupName: v.pickup?.name ?? '', pickupAddress: v.pickup?.address ?? '', pickupCompartment: String(v.pickup?.compartment_no ?? ''), pickupCode: '', pickupError: '' });
        try {
            const credential = await rentalOrderApi.pickupCredential(state(this).id).promise;
            if (!active()) return;
            if (credential.value.order_id !== state(this).id || !/^\d{6}$/.test(credential.value.pickup_code)) throw new Error('取件码与本单不匹配，请重新查询');
            this.setData({ pickupCode: credential.value.pickup_code });
        } catch (error) { if (active()) this.setData({ pickupCode: '', pickupError: error instanceof Error ? error.message : '取件码读取失败，请查询原订单' }); }
    },
    copyCode() { const s = state(this); return s.run('copy-code', () => {
        if (s.capture(accountApi.sessionIdentity)() && this.data.loaded && rentalActionAllowed(s.current?.value.order.allowed_actions ?? [], 'READ_PICKUP_CODE') && /^\d{6}$/.test(this.data.pickupCode)) wx.setClipboardData({ data: this.data.pickupCode });
        else this.setData({ pickupCode: '', pickupVisible: false });
    }); },
    stopReviewVideo() { if (this.data.reviewVideo && typeof wx.createVideoContext === 'function')
        wx.createVideoContext('order-review-video', this).stop(); },
    clearReviewMedia() {
        this.stopReviewVideo();
        this.setData({ ...projectAssessment(null), reviewVideo: null, reviewVideoKey: '', reviewVideoError: '', reviewPlayerVersion: this.data.reviewPlayerVersion + 1 });
    },
    reviewOwnerCurrent() {
        if (state(this).capture(accountApi.sessionIdentity)()) return true;
        this.clearReviewMedia();
        return false;
    },
    reviewMediaAt(key: string) {
        return [...this.data.lossItems.flatMap(item => item.evidence), ...this.data.reviewEvidence].find(item => item.key === key);
    },
    playReviewVideo(event: WechatMiniprogram.CustomEvent) {
        const s = state(this), key = String(event.currentTarget.dataset['key'] ?? '');
        if (!this.reviewOwnerCurrent() || Number(event.currentTarget.dataset['epoch']) !== s.readSequence) return;
        const original = this.reviewMediaAt(key);
        if (!original?.available || original.kind !== 'VIDEO') return;
        const lease = s.capture(accountApi.sessionIdentity), epoch = s.readSequence, active = () => lease() && s.readSequence === epoch, playerVersion = this.data.reviewPlayerVersion + 1;
        this.stopReviewVideo();
        this.setData({ reviewVideo: null, reviewVideoKey: key, reviewVideoError: '', reviewPlayerVersion: playerVersion });
        wx.nextTick(() => {
            if (!active()) { this.reviewOwnerCurrent(); return; }
            if (this.data.reviewPlayerVersion !== playerVersion) return;
            const current = this.reviewMediaAt(key);
            if (!current?.available || current.url !== original.url || current.poster !== original.poster) return;
            this.setData({ reviewVideo: { key, src: original.url, poster: original.poster }, reviewVideoEpoch: epoch });
        });
    },
    onReviewVideoError(event: WechatMiniprogram.CustomEvent) {
        if (!this.reviewOwnerCurrent() || event.currentTarget.dataset['key'] !== this.data.reviewVideo?.key
            || Number(event.currentTarget.dataset['epoch']) !== state(this).readSequence
            || Number(event.currentTarget.dataset['player']) !== this.data.reviewPlayerVersion) return;
        this.stopReviewVideo();
        this.setData({ reviewVideo: null, reviewVideoError: '视频加载失败，可重试原地址；不会重新申请素材权限。' });
    },
    onReviewMediaActivity() { this.reviewOwnerCurrent(); },
    async handleAction(event: WechatMiniprogram.TouchEvent) {
        const code = String(event.currentTarget.dataset['code'] ?? ''), s = state(this), current = s.current;
        if (!s.capture(accountApi.sessionIdentity)() || !current || !this.data.loaded || this.data.loading || !rentalActionAllowed(current.value.order.allowed_actions, code) || this.data.busy)
            return;
        if (code === 'VIEW_CONTRACT' || code === 'SIGN_CONTRACT') {
            if (code === 'SIGN_CONTRACT' && current.value.order.stage === 'PREPARING' && (!this.data.preparationPage?.canSign || !paymentDeadlineValid(this.data.preparationPage.expiresAt))) { await this.refreshStatus(); return; }
            this.goPage('contract', 'orderId');
            return;
        }
        if (code === 'READ_PICKUP_CODE') {
            await this.refreshStatus();
            const active = s.capture(accountApi.sessionIdentity), sequence = s.readSequence;
            wx.nextTick(() => { if (active() && sequence === s.readSequence && this.data.pickupVisible && this.data.pickupCode)
                wx.pageScrollTo({ selector: '.pickup-code', offsetTop: -Math.round(wx.getWindowInfo().windowHeight * 0.3), duration: 200 }); });
            return;
        }
        if (code === 'SET_RETURN_ADDRESS' || code === 'CONFIRM_RECEIPT' || code === 'START_RETURN' && current.value.order.viewer_role === 'LESSOR') {
            await this.openReturnSheet(code === 'CONFIRM_RECEIPT' ? 'receipt' : 'address');
            return;
        }
        if (['START_RETURN', 'SAVE_RETURN_EVIDENCE', 'SHIP_RETURN', 'CORRECT_RETURN_SHIPMENT'].includes(code)) {
            if (current.value.order.viewer_role === 'TENANT' && current.value.order.supply_channel === 'PERSONAL' && current.value.order.physical_status === 'IN_USE' && current.value.delivery.method === 'EXPRESS') {
                s.returnGuideRequested = true;
                await this.refreshStatus();
                return;
            }
            this.goPage('return-submit', 'orderId');
            return;
        }
        if (code === 'OPEN_CABINET' || code === 'QUERY_CABINET' || code === 'SELECT_COMPARTMENT') {
            const purpose = current.value.return_id ? 'RETURN' : 'PICKUP';
            const task = current.value.latest_cabinet_tasks.find(item => item.purpose === purpose);
            if (task) s.navigation.navigateOnce('cabinet-task', callbacks => wx.navigateTo({ url: purpose === 'PICKUP' ? '/pages/cabinet-open/index?taskId=' + encodeURIComponent(task.task_id) : '/pages/cabinet-return/index?orderId=' + encodeURIComponent(s.id), ...callbacks }));
            else if (purpose === 'RETURN' && code === 'SELECT_COMPARTMENT') s.navigation.navigateOnce('return-cabinet', callbacks => wx.navigateTo({ url: '/pages/cabinets/index?mode=return&orderId=' + encodeURIComponent(s.id), ...callbacks }));
            else if (purpose === 'PICKUP' && code === 'OPEN_CABINET') this.setData({ pickupGuideOpen: true });
            else this.setData({ errorText: '暂无可查询的原柜机任务，请刷新或联系客服；不会创建取件任务。' });
            return;
        }
        if (code === 'SHIP' || code === 'CORRECT_SHIPMENT') {
            if (!personalDeliveryAction(current.value, code)) return;
            try {
                const pending = rentalOrderApi.pendingShipment(s.id);
                if (pending) { this.restoreShipment(); return; }
                this.setData({ shipmentSheet: true, shipmentPending: false, shipmentError: '', shipmentErrorField: '', errorText: '', shipmentCorrection: code === 'CORRECT_SHIPMENT', trackingInput: current.value.delivery.tracking_no ?? '', carrierInput: current.value.delivery.carrier ?? '', correctionReason: '' });
            } catch (error) { this.setData({ shipmentPending: true, errorText: error instanceof Error ? error.message : '原物流请求无法读取，请联系客服核实' }); }
            return;
        }
        if (code === 'CANCEL_UNPAID') {
            const view = rentalOrderPayment(current.value);
            if (this.data.paymentUnknown || view && !view.canCancel) { this.setData({ paymentNotice: '请先查询原支付结果，再核实是否可以取消订单。' }); return; }
            this.setData({ cancelDialog: true }); return;
        }
        if (code === 'CONFIRM_DELIVERY') {
            if (this.data.deliveryUnknown || !personalDeliveryAction(current.value, code)) return;
            const active = s.capture(accountApi.sessionIdentity);
            wx.showModal({ title: '确认已经收到设备？', content: '仅在实际收到设备后确认。运输时间不会顺延租期。', success: result => { if (result.confirm && active())
                    void this.runAction(code); } });
            return;
        }
        await this.runAction(code);
    },
    showPickupGuide() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !s.current || !this.data.loaded || this.data.loading || this.data.busy || !rentalOrderPickup(s.current.value)) return;
        this.setData({ pickupGuideOpen: true });
    },
    closeCancelDialog() { if (!this.data.busy) this.setData({ cancelDialog: false }); },
    async confirmCancelOrder() {
        if (!this.data.cancelDialog || this.data.busy) return;
        this.setData({ cancelDialog: false }); await this.runAction('CANCEL_UNPAID');
    },
    async paymentPrimary() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !s.current || !this.data.loaded || this.data.loading || this.data.busy) return;
        const view = rentalOrderPayment(s.current.value);
        if (!view) return;
        if (view.canPay && !this.data.paymentUnknown) await this.runAction('PAY_INITIAL');
        else if (view.canQuery) await this.runAction('QUERY_PAYMENT');
        else await this.refreshStatus();
    },
    async returnToPaymentOrder() { await this.refreshStatus(); },
    async settlementPrimary() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !s.current || !this.data.loaded || this.data.loading || this.data.busy) return;
        const view = rentalOrderSettlement(s.current.value, this.data.paymentUnknown);
        if (!view) return;
        if (view.canPay) await this.runAction('PAY_SUPPLEMENT');
        else if (view.canQuery) await this.runAction(view.isRefund ? 'QUERY_REFUND' : 'QUERY_PAYMENT', view.isRefund ? undefined : view.paymentId);
        else await this.refreshStatus();
    },
    async queryPaymentRecord(event: WechatMiniprogram.TouchEvent) {
        const s = state(this), id = String(event.currentTarget.dataset['id'] ?? '');
        if (!s.capture(accountApi.sessionIdentity)() || !s.current || !this.data.loaded || this.data.loading || this.data.busy) return;
        const records = currentOrderPayments(s.current.value).filter(payment => payment.payment_id === id);
        if (records.length !== 1 || !rentalActionAllowed(records[0]!.allowed_actions, 'QUERY_PAYMENT')) return;
        await this.runAction('QUERY_PAYMENT', id);
    },
    canManageReturn(kind: 'receipt' | 'address') {
        const s = state(this), o = s.current?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !o || o.order.viewer_role !== 'LESSOR' || o.delivery.method !== 'EXPRESS') return false;
        const code = kind === 'receipt' ? 'CONFIRM_RECEIPT' : 'SET_RETURN_ADDRESS';
        return s.returnRecord ? rentalActionAllowed(s.returnRecord.value.allowed_actions, code) : kind === 'address' && rentalActionAllowed(o.order.allowed_actions, 'START_RETURN');
    },
    async openReturnSheet(kind: 'receipt' | 'address') {
        const s = state(this), active = s.capture(accountApi.sessionIdentity);
        if (this.data.returnBusy) return;
        await this.refreshStatus();
        if (!active()) return;
        if (!this.canManageReturn(kind)) { this.setData({ errorText: '当前记录已不允许此操作，请查看最新状态或联系客服。' }); return; }
        s.sheetSequence++;
        this.setData({ returnSheet: kind, returnError: '', returnErrorField: '', returnPending: kind === 'address' ? !!s.pendingAddressId : !!s.pendingReceipt });
        if (kind === 'receipt' && s.pendingReceipt) {
            const parts = beijingTime(s.pendingReceipt.received_at).split(' ');
            this.setData({ receiptDate: parts[0] ?? '', receiptTime: parts[1] ?? '', receiptNote: s.pendingReceipt.note ?? '', returnPending: true });
        }
        if (kind === 'address' && s.pendingAddressId) {
            const a = s.originalAddress;
            this.setData({ selectedAddressId: s.pendingAddressId, returnPending: true, addressNotice: '原地址应用结果待核实，请恢复原请求。', addressOptions: a ? [returnAddressOption(a)] : [] });
        } else if (kind === 'address') await this.showOwnReturnAddresses();
    },
    closeReturnSheet() { if (this.data.returnBusy) return; state(this).sheetSequence++; this.setData({ returnSheet: '', addressListOpen: false, addressListBusy: false, returnError: '', returnErrorField: '' }); },
    inputReturnField(event: WechatMiniprogram.Input) {
        const field = String(event.currentTarget.dataset['field']), kind = this.data.returnSheet;
        if (!kind || !this.canManageReturn(kind) || this.data.returnBusy || this.data.returnPending) return;
        if (kind !== 'receipt' || field !== 'receiptNote') return;
        this.setData({ receiptNote: event.detail.value, returnError: '', returnErrorField: '' });
    },
    receiptTimeChange(event: WechatMiniprogram.PickerChange) {
        if (!this.canManageReturn('receipt') || this.data.returnBusy || this.data.returnPending) return;
        const field = String(event.currentTarget.dataset['field']);
        if (field === 'receiptDate' || field === 'receiptTime') this.setData({ [field]: String(event.detail.value), returnError: '', returnErrorField: '' });
    },
    async returnWriteFailure(error: unknown, fallback: string, active: () => boolean) {
        if (!active()) return;
        const s = state(this), known = error instanceof ApiProblem && error.statusCode >= 400 && error.statusCode < 500 && ![408, 409, 429].includes(error.statusCode);
        if (known) { s.pendingReceipt = null; s.pendingAddressId = ''; this.setData({ returnPending: false }); }
        if (error instanceof ApiProblem && (error.statusCode === 412 || error.code === 'VERSION_CONFLICT')) {
            s.returnRecord = null;
            await this.refreshStatus();
            if (active()) this.setData({ returnError: '记录已更新，已保留输入；请核对最新信息后再次明确提交。' });
        } else this.setData({ returnError: error instanceof Error ? error.message : fallback });
    },
    async submitReceipt() { const s = state(this); return s.run('actual-receipt', async () => {
        const active = s.capture(accountApi.sessionIdentity), expiredView = captureExpiredDetailView(this), record = s.returnRecord;
        if (!active() || !record || this.data.returnSheet !== 'receipt' || this.data.returnBusy || !this.canManageReturn('receipt')) return;
        let body: ReceiptBody;
        try {
            const delivered = s.current?.value.delivery.delivered_at;
            if (!delivered || !Number.isFinite(Date.parse(delivered))) throw new Error('无法核实本单交付时间，请联系客服处理。');
            body = s.pendingReceipt ?? { received_at: beijingInputToUTC(this.data.receiptDate, this.data.receiptTime), note: this.data.receiptNote.trim() || null };
            if (Date.parse(body.received_at) < Date.parse(delivered)) throw new Error('实际收回时间不能早于本单实际交付时间。');
            if ((body.note?.length ?? 0) > 500) { this.setData({ returnErrorField: 'receiptNote' }); throw new Error('收回备注最多500字。'); }
        } catch (error) { this.setData({ returnError: error instanceof Error ? error.message : '请选择实际收回日期和时间', returnErrorField: this.data.returnErrorField || 'receiptTime' }); return; }
        // The server validates received_at <= its current time; a local device clock is never authority.
        s.pendingReceipt = body;
        this.setData({ returnBusy: true, returnPending: true, returnError: '', returnErrorField: '' });
        try {
            await rentalOrderApi.receipt(s.id, body, record.etag).promise;
            if (!active()) return;
            s.pendingReceipt = null;
            this.setData({ returnSheet: '', returnPending: false, receiptDate: '', receiptTime: '', receiptNote: '' });
            await this.refreshStatus();
        } catch (error) { await this.returnWriteFailure(error, '实际收回结果待核实，请恢复原请求。', active); }
        finally { if (active()) this.setData({ returnBusy: false }); else if (expiredView()) this.clearUnavailableOrder(); }
    }); },
    async showOwnReturnAddresses() { const s = state(this), active = s.capture(accountApi.sessionIdentity); if (!this.canManageReturn('address') || this.data.returnBusy || this.data.returnPending) return;
        s.addresses = []; s.addressCursor = null; s.originalAddress = null; this.setData({ selectedAddressId: '', addressListOpen: true, addressOptions: [], addressNext: false });
        if (active()) await this.loadOwnReturnAddresses();
    },
    async loadOwnReturnAddresses() { const s = state(this), lease = s.capture(accountApi.sessionIdentity), expiredView = captureExpiredDetailView(this), epoch = s.sheetSequence, active = () => lease() && epoch === s.sheetSequence;
        if (!this.canManageReturn('address') || this.data.addressListBusy || !this.data.addressListOpen) return;
        this.setData({ addressListBusy: true, returnError: '' });
        try {
            const result = await addressApi.list(s.addressCursor ?? undefined).promise;
            if (!active()) return;
            s.addresses = [...s.addresses, ...result.items.filter(item => usableReturnAddress(item) && !s.addresses.some(row => row.address_id === item.address_id))]; s.addressCursor = result.page.has_more ? result.page.next_cursor ?? null : null;
            this.setData({ addressOptions: s.addresses.map(returnAddressOption), addressNext: !!s.addressCursor });
        } catch (error) { if (active()) this.setData({ returnError: error instanceof Error ? error.message : '本人地址读取失败' }); }
        finally { if (active()) this.setData({ addressListBusy: false }); else if (expiredView()) this.clearUnavailableOrder(); }
    },
    chooseOwnReturnAddress(event: WechatMiniprogram.TouchEvent) { this.selectReturnAddress(String(event.currentTarget.dataset['id'])); },
    selectReturnAddress(id: string) {
        const s = state(this), address = s.addresses.find(item => item.address_id === id);
        if (!address || !usableReturnAddress(address) || !this.canManageReturn('address') || this.data.returnSheet !== 'address' || this.data.returnBusy || this.data.returnPending) return;
        s.originalAddress = address;
        this.setData({ selectedAddressId: id, addressNotice: '已选择本人地址，尚未应用到本单。', returnError: '', returnErrorField: '' });
    },
    manageReturnAddresses() {
        const s = state(this), owner = s.owner;
        if (!this.canManageReturn('address') || this.data.returnSheet !== 'address' || this.data.returnBusy || this.data.returnPending || this.data.addressListBusy) return;
        s.navigation.navigateOnce('return-address-book', callbacks => {
            const resume = { selectedId: this.data.selectedAddressId }; s.addressBookReturn = resume;
            wx.navigateTo({ url: '/pages/addresses/index?mode=select', ...callbacks,
                events: { addressSelected: (value: { addressId: string }) => {
                    if (!s.scope.disposed && accountApi.sessionIdentity() === owner && s.commandOwner === owner && s.addressBookReturn === resume && typeof value.addressId === 'string') resume.selectedId = value.addressId;
                } },
                fail: error => { if (s.addressBookReturn === resume) s.addressBookReturn = null; callbacks.fail(error); },
            });
        });
    },
    async submitReturnAddress() { const s = state(this); return s.run('return-address-save', async () => {
        const active = s.capture(accountApi.sessionIdentity), expiredView = captureExpiredDetailView(this);
        if (!active() || this.data.returnSheet !== 'address' || this.data.returnBusy || this.data.addressListBusy || !this.canManageReturn('address')) return;
        const addressId = s.pendingAddressId || this.data.selectedAddressId;
        if (!addressId || !s.pendingAddressId && s.originalAddress?.address_id !== addressId) { this.setData({ returnErrorField: 'selectedAddressId', returnError: '请选择一个有效的本人收件地址。' }); return; }
        this.setData({ returnBusy: true, returnError: '', returnErrorField: '' });
        try {
            if (!s.pendingAddressId) {
                const address = await findOwnAddress(addressId);
                if (!active()) return;
                if (!address || !usableReturnAddress(address)) { s.originalAddress = null; this.setData({ selectedAddressId: '', returnError: '所选地址已不可用，请重新选择。' }); return; }
                if (address.version !== s.originalAddress?.version || JSON.stringify(returnAddressOption(address)) !== JSON.stringify(returnAddressOption(s.originalAddress))) {
                    s.addresses = [address, ...s.addresses.filter(item => item.address_id !== addressId)]; s.originalAddress = null;
                    this.setData({ selectedAddressId: '', addressOptions: s.addresses.map(returnAddressOption), returnError: '地址已更新，请核对完整地址后重新选择。' }); return;
                }
                s.pendingAddressId = addressId;
            }
            this.setData({ returnPending: true });
            if (!s.appliedAddressId) {
                if (!s.returnRecord) {
                    const order = s.current;
                    if (!order || !rentalActionAllowed(order.value.order.allowed_actions, 'START_RETURN')) throw new Error('当前不可建立归还上下文，请刷新。');
                    const created = await rentalOrderApi.startReturn(s.id, 'EXPRESS', order.etag).promise;
                    if (!active()) return;
                    if (created.value.order_id !== s.id) throw new Error('归还记录与本单不匹配');
                    s.returnRecord = created;
                }
                if (!this.canManageReturn('address')) throw new Error('返程地址已不可修改，请查询最新记录。');
                const commandOwner = s.commandOwner;
                await rentalOrderApi.returnAddress(s.id, addressId, s.returnRecord.etag).promise;
                if (s.commandOwner === commandOwner && s.pendingAddressId === addressId) s.appliedAddressId = addressId;
                if (!active()) return;
            }
            this.setData({ addressNotice: '应用请求已完成，正在回读本单返程地址。' });
            await this.refreshStatus();
            if (!active() || !this.data.loaded || !s.returnRecord) return;
            s.pendingAddressId = ''; s.appliedAddressId = ''; s.originalAddress = null;
            if (s.returnRecord.value.address?.source_id !== addressId) {
                this.setData({ selectedAddressId: '', returnPending: false, returnError: '应用请求已完成，但当前订单地址与所选地址不同，请核对后重新选择。' }); return;
            }
            this.setData({ ...emptyReturnForm(), addressNotice: '已用于本单返程地址。' });
        } catch (error) {
            if (!active()) return;
            this.setData({ addressNotice: '本人地址已保存，尚未应用到本单或结果待核实；请核对原请求。' });
            await this.returnWriteFailure(error, '地址应用结果待核实，请恢复原请求。', active);
        } finally { if (active()) this.setData({ returnBusy: false }); else if (expiredView()) this.clearUnavailableOrder(); }
    }); },
    async runAction(code: string, paymentId?: string) { const s = state(this); await s.run('order-command', async () => { const current = s.current, active = s.capture(accountApi.sessionIdentity), expiredView = captureExpiredDetailView(this); if (!current || !active() || !this.data.loaded || this.data.loading || !rentalActionAllowed(current.value.order.allowed_actions, code))
        return;
        if (code === 'CONFIRM_DELIVERY' && (this.data.deliveryUnknown || !personalDeliveryAction(current.value, code))) return;
        if (code === 'CONFIRM_ORDER') {
            if (!this.data.loaded || this.data.loading || this.data.busy || current.value.order.viewer_role !== 'TENANT' || current.value.order.stage !== 'PREPARING') return;
            if (!this.data.preparationPage?.canConfirm || !paymentDeadlineValid(this.data.preparationPage.expiresAt)) { await this.refreshStatus(); return; }
            s.navigation.navigateOnce('confirm-order', callbacks => wx.navigateTo({ url: '/pages/confirm/index?orderId=' + encodeURIComponent(s.id), ...callbacks }));
            return;
        }
        this.setData({ busy: true, errorText: '' }); try {
        if (this.data.paymentUnknown && ['PAY_INITIAL', 'PAY_SUPPLEMENT', 'CANCEL_UNPAID'].includes(code)) {
            this.setData({ paymentNotice: '原操作结果待核实，请先查询原订单。' }); return;
        }
        if (code === 'PAY_INITIAL' && rentalOrderPayment(current.value)?.kind === 'checking') {
            this.setData({ paymentNotice: '支付结果待核实，请先查询原支付结果；不会重新发起支付。' }); return;
        }
        if (code === 'CANCEL_UNPAID') {
            const view = rentalOrderPayment(current.value);
            if (view && !view.canCancel) { this.setData({ paymentNotice: '请先查询原支付结果，再核实是否可以取消订单。' }); return; }
            await rentalOrderApi.cancel(s.id, current.etag).promise;
        }
        else if (code === 'CONFIRM_DELIVERY')
            await rentalOrderApi.confirmDelivery(s.id, current.etag).promise;
        else if (code === 'PAY_INITIAL' || code === 'PAY_SUPPLEMENT')
            await this.pay(code === 'PAY_INITIAL' ? 'INITIAL' : 'SUPPLEMENT');
        else if (code === 'QUERY_PAYMENT') {
            const id = paymentId ?? current.value.order.allowed_actions.find(action => action.action_code === 'QUERY_PAYMENT' && action.allowed)?.target;
            const selected = id ? currentOrderPayments(current.value).filter(payment => payment.payment_id === id) : [];
            if (paymentId && (selected.length !== 1 || !rentalActionAllowed(selected[0]!.allowed_actions, 'QUERY_PAYMENT'))) return;
            const purpose = current.value.order.stage === 'AWAITING_PAYMENT' ? 'INITIAL' : selected[0]?.purpose ?? (current.value.order.display_status_code === 'AWAITING_SUPPLEMENT' ? 'SUPPLEMENT' : 'INITIAL');
            const original = originalOrderPayment(current.value, purpose);
            if (paymentId && original?.payment_id !== paymentId) return;
            if (original) await this.queryOriginalPayment(current, purpose, original.payment_id);
        }
        else if (code === 'QUERY_REFUND' && current.value.bill.refund_summary.latest_refund) {
            const original = current.value.bill.refund_summary.latest_refund;
            assertOriginalOrderRefund(original, current.value);
            if (!rentalActionAllowed(original.allowed_actions, 'QUERY_REFUND')) return;
            const refund = await rentalOrderApi.refund(original.refund_id).promise;
            if (!active()) return;
            assertOriginalOrderRefund(refund.value, current.value);
            if (rentalActionAllowed(refund.value.allowed_actions, 'QUERY_REFUND'))
                await rentalOrderApi.queryRefund(refund.value.refund_id, refund.etag).promise;
        }
        if (active())
            await this.refreshStatus();
    }
    catch (error) {
        if (active()) {
            this.setData({ errorText: error instanceof Error ? error.message : '结果待核实，请查询原订单' });
            if (code === 'CONFIRM_DELIVERY') this.setData({ deliveryUnknown: true });
            if (['PAY_INITIAL', 'PAY_SUPPLEMENT', 'QUERY_PAYMENT', 'CANCEL_UNPAID'].includes(code)) {
                const view = this.data.paymentPage;
                this.setData({ paymentUnknown: true, settlementPage: rentalOrderSettlement(current.value, true), cancelDialog: false, paymentPage: view ? { ...view, kind: 'checking', title: '支付结果确认中', canPay: false, canCancel: false, primaryLabel: '查询支付结果', note: '原操作结果待核实，请先查询原订单；不会自动重发。' } : null });
            }
        }
    }
    finally {
        if (active())
            this.setData({ busy: false });
        else if (expiredView()) this.clearUnavailableOrder();
    } }); },
    async pay(purpose: 'INITIAL' | 'SUPPLEMENT') {
        const s = state(this), current = s.current, active = s.capture(accountApi.sessionIdentity);
        if (!current || !active() || !this.data.loaded || this.data.loading || current.value.order.viewer_role !== 'TENANT'
            || !rentalActionAllowed(current.value.order.allowed_actions, purpose === 'INITIAL' ? 'PAY_INITIAL' : 'PAY_SUPPLEMENT'))
            return;
        if (purpose === 'INITIAL' && !paymentDeadlineValid(current.value.payment_due_at, orderPaymentNow(current.value))) {
            this.setData({ paymentNotice: '支付期限已到或待核实，请查询原订单；不会重新发起支付。' }); return;
        }
        let record: RentalRecord<RentalPayment>;
        const existing = originalOrderPayment(current.value, purpose);
        if (existing)
            record = await rentalOrderApi.payment(existing.payment_id).promise;
        else
            record = await rentalOrderApi.createPayment(s.id, purpose, current.etag, purpose === 'SUPPLEMENT' ? current.value.bill.supplement?.supplement_id ?? null : null).promise;
        if (!active())
            return;
        assertOrderPayment(record.value, current.value, purpose, existing?.payment_id);
        if (!paymentCanInvoke(record.value, orderPaymentNow(current.value))) {
            this.setData({ paymentNotice: rentalBlockers(record.value.blockers) || '原支付正在核实，请查询结果；不会重新发起支付' });
            return;
        }
        const invocation = await rentalOrderApi.invocation(record.value.payment_id, record.etag).promise;
        if (!active())
            return;
        const v = invocation.value;
        if (v.payment_id !== record.value.payment_id)
            throw new Error('支付参数与原订单不匹配');
        if (!paymentDeadlineValid(v.expires_at, orderPaymentNow(current.value)) || !paymentCanInvoke(record.value, orderPaymentNow(current.value)) || purpose === 'INITIAL' && !paymentDeadlineValid(current.value.payment_due_at, orderPaymentNow(current.value))) {
            this.setData({ paymentNotice: '原支付参数已过期或待核实，请查询结果；不会重新发起支付。' }); return;
        }
        const account = wx.getAccountInfoSync();
        if (account.miniProgram.appId !== v.app_id)
            throw new Error('支付应用标识不一致，请联系客服');
        await s.scope.singleFlight('invoke-original-payment', () => new Promise<void>(resolve => demoWx.requestPayment({ timeStamp: v.time_stamp, nonceStr: v.nonce_str, package: v.package, signType: v.sign_type, paySign: v.pay_sign, complete: () => resolve() })));
        if (active()) {
            this.setData({ paymentNotice: '微信操作已结束，正在查询原支付。取消或返回不代表未付款。' });
            await this.queryOriginalPayment(current, purpose, record.value.payment_id);
        }
    },
    async queryOriginalPayment(order: RentalRecord<RentalOrder>, purpose: 'INITIAL' | 'SUPPLEMENT', id: string) {
        const s = state(this), active = s.capture(accountApi.sessionIdentity);
        if (!active() || order.value.order.viewer_role !== 'TENANT') return;
        if ((s.paymentQueryAfter[id] ?? 0) > Date.now()) { this.setData({ paymentNotice: '查询已提交，请稍后再查询原支付结果。' }); return; }
        const payment = await rentalOrderApi.payment(id).promise;
        if (!active()) return;
        assertOrderPayment(payment.value, order.value, purpose, id);
        if (rentalActionAllowed(payment.value.allowed_actions, 'QUERY_PAYMENT')) {
            const result = await rentalOrderApi.queryPayment(id, payment.etag).promise;
            if (!active()) return;
            const interval = result.value.poll_after_seconds;
            if (Number.isFinite(interval) && interval > 0) s.paymentQueryAfter[id] = Date.now() + interval * 1000;
        }
    },
    restoreShipment() {
        const s = state(this), value = s.current?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !value || !this.data.loaded || this.data.loading || this.data.busy || value.order.viewer_role !== 'LESSOR' || value.order.supply_channel !== 'PERSONAL' || value.delivery.method !== 'EXPRESS') return;
        try {
            const pending = rentalOrderApi.pendingShipment(s.id);
            if (!pending) { this.setData({ shipmentPending: false }); return; }
            this.setData({ shipmentSheet: true, shipmentPending: true, shipmentCorrection: pending.correction, trackingInput: pending.body.tracking_no, carrierInput: pending.body.carrier ?? '', correctionReason: pending.body.reason ?? '', shipmentError: '', shipmentErrorField: '', errorText: '' });
        } catch (error) { this.setData({ shipmentPending: true, errorText: error instanceof Error ? error.message : '原物流请求无法读取，请联系客服核实' }); }
    },
    inputShipment(event: WechatMiniprogram.Input) {
        const s = state(this), value = s.current?.value, field = String(event.currentTarget.dataset['field']);
        if (!s.capture(accountApi.sessionIdentity)() || !value || !this.data.loaded || this.data.loading || this.data.busy || !this.data.shipmentSheet || this.data.shipmentPending || !personalDeliveryAction(value, this.data.shipmentCorrection ? 'CORRECT_SHIPMENT' : 'SHIP')) return;
        if (['trackingInput', 'carrierInput', 'correctionReason'].includes(field)) this.setData({ [field]: event.detail.value, shipmentError: '', shipmentErrorField: '' });
    },
    closeShipment() { if (!this.data.busy) this.setData({ shipmentSheet: false, shipmentError: '', shipmentErrorField: '', errorText: '' }); },
    async submitShipment() { const s = state(this); await s.run('shipment', async () => {
        const active = s.capture(accountApi.sessionIdentity), expiredView = captureExpiredDetailView(this), record = s.current;
        if (!active() || !record || !this.data.loaded || this.data.loading || this.data.busy || !this.data.shipmentSheet || record.value.order.viewer_role !== 'LESSOR' || record.value.order.supply_channel !== 'PERSONAL' || record.value.delivery.method !== 'EXPRESS') return;
        this.setData({ busy: true, shipmentError: '', shipmentErrorField: '', errorText: '' });
        try {
            const pending = rentalOrderApi.pendingShipment(s.id), correction = pending?.correction ?? this.data.shipmentCorrection;
            if (!pending && !personalDeliveryAction(record.value, correction ? 'CORRECT_SHIPMENT' : 'SHIP')) throw new Error('当前已不允许发货或更正，请刷新原订单');
            const body = pending?.body ?? { tracking_no: this.data.trackingInput.trim(), carrier: this.data.carrierInput.trim() || null, ...(correction ? { reason: this.data.correctionReason.trim() } : {}) };
            const fieldError = !/^\S{1,64}$/.test(body.tracking_no) ? ['trackingInput', '快递单号应为1–64位非空白字符']
                : (body.carrier?.length ?? 0) > 64 ? ['carrierInput', '快递公司最多64字'] : correction && (!body.reason?.trim() || body.reason.length > 500) ? ['correctionReason', '请填写更正原因，最多500字'] : null;
            if (fieldError) { this.setData({ shipmentError: fieldError[1]!, shipmentErrorField: fieldError[0]! }); return; }
            const etag = pending?.etag ?? record.etag;
            if (correction) await rentalOrderApi.correctShipment(s.id, { tracking_no: body.tracking_no, carrier: body.carrier, reason: body.reason! }, etag).promise;
            else await rentalOrderApi.ship(s.id, { tracking_no: body.tracking_no, carrier: body.carrier }, etag).promise;
            if (!active()) return;
            this.setData({ shipmentSheet: false, shipmentPending: false }); await this.refreshStatus();
        } catch (error) {
            if (!active()) return;
            let shipmentPending = true;
            try { shipmentPending = !!rentalOrderApi.pendingShipment(s.id); } catch { /* Unreadable original intent must remain locked. */ }
            this.setData({ shipmentPending, shipmentError: error instanceof Error ? error.message : '发货结果待核实，请查询原订单' });
            if (error instanceof ApiProblem && (error.statusCode === 412 || error.code === 'VERSION_CONFLICT')) {
                await this.refreshStatus();
                if (active()) this.setData({ shipmentError: '订单已更新，输入已保留；请核对最新信息后再次明确提交。' });
            }
        } finally { if (active()) this.setData({ busy: false }); else if (expiredView()) this.clearUnavailableOrder(); }
    }); },
    goPage(page: string, param: string) { const s = state(this); s.navigation.navigateOnce(page, callbacks => wx.navigateTo({ url: '/pages/' + page + '/index?' + param + '=' + encodeURIComponent(s.id), ...callbacks })); },
    openProduct() { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.assetId)
        return; s.navigation.navigateOnce('product', callbacks => wx.navigateTo({ url: '/pages/detail/index?id=' + encodeURIComponent(this.data.assetId), ...callbacks })); },
    copyOrderNumber() { const s = state(this); if (s.capture(accountApi.sessionIdentity)() && this.data.loaded && s.current) wx.setClipboardData({ data: s.current.value.order.order_no }); },
    toggleReturnAddress() {
        const s = state(this), order = s.current?.value, record = s.returnRecord?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !order || rentalReturnDispatch(order, record ?? null, Date.now(), s.returnGuideRequested)?.code !== 'F1b') return;
        const snapshot = returnAddressSnapshot(record);
        s.returnAddressAck = snapshot && s.returnAddressAck !== snapshot ? snapshot : '';
        this.setData({ returnAddressChecked: !!s.returnAddressAck });
    },
    copyReturnAddress() {
        const s = state(this), active = s.capture(accountApi.sessionIdentity), record = s.returnRecord?.value;
        if (!active() || !this.data.loaded || this.data.loading || !returnAddressSnapshot(record)) return;
        wx.setClipboardData({ data: rentalDeliveryAddressText(record?.address), fail: () => { if (active()) this.setData({ errorText: '复制失败，请重试或核对本单地址。' }); } });
    },
    async returnDispatchPrimary() {
        const s = state(this), active = s.capture(accountApi.sessionIdentity), current = s.current?.value;
        if (!active() || !this.data.loaded || this.data.loading || this.data.busy || !current) return;
        const view = rentalReturnDispatch(current, s.returnRecord?.value ?? null, Date.now(), s.returnGuideRequested);
        if (!view) return;
        if (view.code === 'E6') { if (view.canReceive) await this.openReturnSheet('receipt'); return; }
        if (view.code === 'F2') { this.openDispatchRecord(); return; }
        if (view.code === 'F1c') { await this.refreshStatus(); return; }
        if (!view.canReturn) return;
        const acknowledged = s.returnAddressAck;
        if (view.code === 'F1b' && (!acknowledged || acknowledged !== returnAddressSnapshot(s.returnRecord?.value))) {
            s.returnAddressAck = ''; this.setData({ returnAddressChecked: false });
            if (acknowledged) await this.refreshStatus();
            if (active()) this.setData({ errorText: acknowledged ? '归还地址已更新，请重新核对并勾选。' : '请先核对并勾选本单最新归还地址。' }); return;
        }
        await this.refreshStatus();
        if (!active() || !s.current || this.data.loading) return;
        const latest = rentalReturnDispatch(s.current.value, s.returnRecord?.value ?? null, Date.now(), s.returnGuideRequested);
        if (!latest || latest.code !== view.code || !latest.canReturn) {
            this.setData({ errorText: this.data.errorText || '归还状态或地址已变化，请查看最新信息后再操作。' }); return;
        }
        const snapshot = returnAddressSnapshot(s.returnRecord?.value), version = s.returnRecord?.value.address_version ?? '';
        if (latest.code === 'F1b' && (!snapshot || acknowledged !== snapshot || s.returnAddressAck !== snapshot)) {
            this.setData({ errorText: '归还地址已更新，请重新核对并勾选。' }); return;
        }
        s.navigation.navigateOnce('return-dispatch', callbacks => {
            if (latest.code === 'F1b') rememberReturnAddressConfirmation(s.owner, s.id, snapshot, version);
            wx.navigateTo({ url: '/pages/return-submit/index?orderId=' + encodeURIComponent(s.id) + (latest.code === 'F1b' ? '&addressVersion=' + encodeURIComponent(version) : ''), ...callbacks,
                fail: error => { clearReturnAddressConfirmation(s.owner, s.id); callbacks.fail(error); if (active()) this.setData({ errorText: '归还页面打开失败，请重试。' }); } });
        });
    },
    openDispatchRecord(event?: WechatMiniprogram.TouchEvent) {
        const s = state(this), order = s.current?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !order) return;
        const view = rentalReturnDispatch(order, s.returnRecord?.value ?? null, Date.now(), s.returnGuideRequested), correction = event?.currentTarget.dataset['mode'] === 'correction';
        if (!view?.transit || correction && !view.canCorrect) return;
        s.navigation.navigateOnce('dispatch-record', callbacks => wx.navigateTo({ url: '/pages/return-submit/index?orderId=' + encodeURIComponent(s.id) + '&mode=' + (correction ? 'correction' : 'record'), ...callbacks }));
    },
    copyTracking(event: WechatMiniprogram.TouchEvent) { const s = state(this); if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded) return;
        const tracking = event.currentTarget.dataset['kind'] === 'return' ? s.returnRecord?.value.tracking_no : s.current?.value.delivery.tracking_no;
        if (tracking) wx.setClipboardData({ data: tracking });
    },
    copyRecipient() { const s = state(this), recipient = s.current?.value.delivery.recipient; if (!s.capture(accountApi.sessionIdentity)() || !recipient) return;
        const active = s.capture(accountApi.sessionIdentity);
        wx.setClipboardData({ data: rentalDeliveryAddressText(recipient), fail: () => { if (active()) this.setData({ shipmentError: '复制失败，请重试或手动复制本单地址。' }); } }); },
    toggleOrderInfo() { this.setData({ orderInfoExpanded: !this.data.orderInfoExpanded }); }, toggleProgress() { this.setData({ progressExpanded: !this.data.progressExpanded }); },
    openPeerConversation() {
        const s = state(this), order = s.current?.value.order;
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || !order || order.supply_channel !== 'PERSONAL' || !['TENANT', 'LESSOR'].includes(order.viewer_role)) return;
        s.navigation.navigateOnce('order-conversation', callbacks => wx.navigateTo({ url: '/pages/chat/index?mode=c2c&orderId=' + encodeURIComponent(order.order_id), ...callbacks }));
    },
    openFeeBasis() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || !s.current || !finalRentalAssessment(s.current.value)) return;
        this.goPage('order-fees', 'orderId');
    },
    openCompletedReturn() {
        const s = state(this), current = s.current?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !current) return;
        const view = rentalOrderCompletion(current);
        if (!view || view.closed || !view.returnId) return;
        if (s.returnRecord?.value.order_id !== s.id || s.returnRecord.value.return_id !== view.returnId) {
            this.setData({ errorText: '原归还记录尚未核实，请刷新本单后再查看。' }); return;
        }
        this.goPage('return-submit', 'orderId');
    },
    openReviewEvidence(event: WechatMiniprogram.TouchEvent) {
        const s = state(this), current = s.current?.value, record = s.returnRecord?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !current || !record) return;
        const view = rentalReturnReview(current, record);
        if (!view) return;
        const supplement = event.currentTarget.dataset['mode'] === 'supplement';
        if (supplement && !view.canSupplement) { this.setData({ errorText: '当前没有可补交的材料，请刷新本单。' }); return; }
        const query = supplement ? '&mode=supplement' : '&mode=record';
        s.navigation.navigateOnce('review-evidence', callbacks => wx.navigateTo({ url: '/pages/return-submit/index?orderId=' + encodeURIComponent(s.id) + query, ...callbacks }));
    },
    openOrderEarning() {
        const s = state(this), order = s.current?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !order || !this.data.returnReviewPage?.booked || !order.earning_id) return;
        s.navigation.navigateOnce('order-earning', callbacks => wx.navigateTo({ url: '/pages/wallet/index?earningId=' + encodeURIComponent(order.earning_id!) + '&orderId=' + encodeURIComponent(s.id), ...callbacks }));
    },
    toggleCompletionRecords() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || !s.current || !rentalOrderCompletion(s.current.value)?.closed) return;
        this.setData({ completionRecordsExpanded: !this.data.completionRecordsExpanded });
    },
    browseOtherDevices() {
        const s = state(this);
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !s.current || !rentalOrderCompletion(s.current.value)?.closed) return;
        s.navigation.navigateOnce('browse-devices', callbacks => wx.switchTab({ url: '/pages/home/index', ...callbacks }));
    },
    backToOrders() {
        const s = state(this);
        if (this.data.busy || !s.visible || s.scope.disposed) return;
        if (s.capture(accountApi.sessionIdentity)() && s.current) setOrderListContext(s.owner, s.current.value.order.viewer_role);
        s.navigation.navigateOnce('orders', callbacks => wx.switchTab({ url: '/pages/orders/index', ...callbacks }));
    },
    reorder() {
        const s = state(this), current = s.current?.value;
        if (!s.capture(accountApi.sessionIdentity)() || !this.data.loaded || this.data.loading || this.data.busy || !current || !rentalOrderResult(current).canReorder) return;
        s.navigation.navigateOnce('reorder', callbacks => wx.navigateTo({ url: '/pages/confirm/index?deviceId=' + encodeURIComponent(current.order.asset.asset_id), ...callbacks }));
    },
    onSecondaryNavigationBack() { navigateBackWithFallback(state(this).navigation); },
demoSupport() { wx.navigateTo({ url: '/pages/demo-support/index' }); },
});
