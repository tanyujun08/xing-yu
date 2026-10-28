import { readFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { styleRule, styleValue } from './helpers/style-contract';
const read = (page: string, ext = 'wxml') => readFileSync('miniprogram/pages/' + page + '/index.' + ext, 'utf8');
test('current orders keep progressive receipt, financial and authoritative action hierarchy', () => { const markup = read('order-detail'); for (const token of ['status-card', 'object-panel', 'order-info-card', 'fulfillment-card', 'finance-card', 'orderInfoExpanded', 'progressExpanded', 'assetFacts', 'billFinalized', 'refundDue', 'refunded', 'supplement'])
    expect(markup).toContain(token); expect(markup).toContain('wx:for="{{actions}}"'); expect(markup).toContain('disabled="{{busy || !item.allowed}}"'); expect(markup).toContain('wx:key="action_code"'); expect(markup).toContain('bindopen="openProduct"'); for (const field of ['guard', 'insurance', 'renewalOpen', 'submitPaidCancellation', 'approveOrder', 'rejectOrder'])
    expect(markup).not.toContain(field); });
test('forms expose calendar date ranges, one coupon and authoritative return address', () => { const confirm = read('confirm'), returns = read('return-submit'), detail = read('order-detail'); expect(confirm).not.toContain('北京时间'); expect(confirm).toContain('calendar-grid'); expect(confirm).not.toContain('mode="time"'); expect(confirm).toContain('<confirmation-dialog'); expect(confirm).toContain('限一张'); expect(confirm).not.toContain('choosePickup'); expect(confirm).not.toContain('chooseReturn'); expect(returns).toContain('addressConfirmed'); expect(returns).not.toContain('addressVersion'); expect(read('return-submit','ts')).toContain('confirmed_address_version: r.value.address_version'); expect(detail).toContain('maxlength="64"'); expect(detail).toContain('更正原因（必填）'); expect(detail).not.toContain('发货方地址'); });
test('cabinet scan input and credential read are separate and physical facts have no local checkbox proof', () => { expect(read('cabinet-code')).toContain('show-display-code="{{false}}"'); expect(read('cabinet-code')).toContain('bindprimary="submitCredential"'); expect(read('order-detail')).not.toContain('cabinet-credential-input'); expect(read('order-detail')).not.toContain('submitCredential'); expect(read('order-detail')).toContain('租期开始前不能开柜'); expect(read('cabinet-return')).not.toContain('<checkbox'); expect(read('cabinet-open', 'ts')).not.toContain('openCabinet('); expect(read('cabinet-open')).toContain('rfid'); });
test('all current order routes retain shared shells and use native customer service', () => { for (const page of ['confirm', 'order-detail', 'contract', 'cabinet-code', 'cabinet-open', 'cabinet-return', 'return-submit', 'wallet']) {
    const markup = read(page);
    expect(markup, page).toContain('<page-shell');
    expect(markup, page).toContain('<page-header');
    expect(markup, page).toContain('open-type="contact"');
    expect(markup, page).not.toMatch(/模拟|fixture|Mock/);
} });
test('contract uses native handwriting entry and explicit exact-preview confirmation with accessible checks', () => { const m = read('contract'); expect(m).toContain('role="checkbox"'); expect(m).toContain('aria-checked="{{agreed}}"'); expect(m).toContain('{{agreementText}}'); expect(m).toContain('去手写签名'); expect(m).toContain('确认签署'); expect(m).toContain('!checkedPreview || !previewLoaded'); expect(m).not.toMatch(/web-view|required_signers|确认同意协议/); });
test('order flow text keeps system scaling and role pairs without JavaScript font scaling', () => {
    const roles = [ ['confirm','.section-title'], ['confirm','.term-date'], ['contract','.contract-title'], ['contract','.contract-copy'], ['return-submit','.card-title'], ['return-submit','.card-copy'], ['cabinet-return','.result-title'], ['cabinet-return','.result-copy'], ['wallet','.summary-label'], ['wallet','.summary-value'], ['identity','.identity-title'], ['identity','.identity-copy'], ['identity','.identity-row input'] ];
    for (const [route, selector] of roles) {
        const css = read(route!, 'wxss'), rule = styleRule(css,selector!);
        expect(rule['font-size'],route+' '+selector).toMatch(/^var\(--xy-/);expect(rule['line-height'],route+' '+selector).toMatch(/^var\(--xy-/);
    }
    for(const route of ['confirm','order-detail','return-submit','contract','cabinet-code','cabinet-open','cabinet-return','wallet','identity']) {
        expect(read(route)).toContain('<page-meta root-font-size="system" />');
        expect(read(route,'wxss')).not.toMatch(/(?:font-size|line-height)\s*:\s*\d+(?:\.\d+)?rpx/);
        expect(read(route,'ts')).not.toMatch(/fontSizeSetting|fontSizeScale|setFontSize/);
    }
});
test('existing checkout wallet and return cards preserve their spacing owners and ordinary card boundaries', () => {
    const confirm=read('confirm','wxss'),wallet=read('wallet','wxss'),returns=readFileSync('miniprogram/shared/design/return-flow.wxss','utf8'),detail=read('order-detail','wxss');
    expect(styleValue(confirm,'.confirm-page','padding')).toBe('12px 16px 16px');
    expect(styleValue(confirm,'.confirm-section','padding')).toBe('16px');expect(styleValue(confirm,'.confirm-section','background')).toBe('#fff');
    expect(styleValue(wallet,'.wallet-page','padding')).toBe('16px 16px 24px');expect(styleValue(wallet,'.income-summary','padding')).toBe('12px');
    expect(styleValue(returns,'.return-page','padding')).toBe('12px 16px 16px');expect(styleValue(returns,'.return-card','padding')).toBe('12px');expect(styleValue(returns,'.return-page','gap')).toBe('12px');
    for(const [css,selector] of [[returns,'.return-card'],[detail,'.detail-block'],[wallet,'.income-summary'],[confirm,'.confirm-section']]) {
        expect(styleValue(css!,selector!,'font-weight')).toBe('');expect(['','none']).toContain(styleValue(css!,selector!,'box-shadow'));
    }
    const walletMarkup=read('wallet');for(const part of ['wallet-hero-section','income-summary--hero','summary-kpis','detail-section','income-list'])expect(walletMarkup).toContain(part);
});
test('unpaid checkout shows the chargeable deposit without refund fields or unsupported deposit plans', () => {
    const markup=read('confirm'),script=read('confirm','ts');
    expect(markup).toContain('租赁押金'); expect(markup).not.toMatch(/退押金额|应退押金|已退押金|refundDue|refunded/);
    expect(markup).not.toMatch(/deposit_plan|会员免押|粉币免押|PINK|chooseDeposit|deposit-option/);expect(script).not.toMatch(/deposit_plan|toggleDeposit|depositPlan/);
    expect(markup).toMatch(/<task-sheet open="{{voucherSheetOpen}}"[^>]*title="[^"]*"[^>]*>/);
    const sheet=markup.slice(markup.indexOf('<task-sheet open="{{voucherSheetOpen}}"'));expect(sheet).not.toContain('slot="footer"');expect(sheet).toContain('show-footer="{{false}}"');
});

