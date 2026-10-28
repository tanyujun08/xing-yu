import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');

describe('XY-20260903-001 revision 14 listing-price Figma contract', () => {
  test('implements the direct 2102:929 card, control and footer geometry', () => {
    const view = read('miniprogram/pages/listing-price/index.wxml');
    const style = read('miniprogram/pages/listing-price/index.wxss');

    expect(style).toMatch(/\.listing-summary-card \{ min-height: 68px;/);
    expect(style).toMatch(/\.price-reference-card \{ min-height: 102px;/);
    expect(style).toMatch(/\.price-settings-card \{ min-height: 380px;/);
    expect(style).toMatch(/\.input-wrap \{[^}]*height: var\(--xy-button-height-standard\);[^}]*justify-content: flex-start/su);
    expect(style).toMatch(/\.date-control \{[^}]*height: var\(--xy-fixed-bottom-height\)/su);
    expect(style).toMatch(/\.delivery-pill \{[^}]*height: var\(--xy-button-height-small\)/su);
    expect(style).toMatch(/\.edit-button,[\s\S]*?\.confirm-button \{[^}]*height: var\(--xy-control-height-standard\)/u);
    expect(view).toContain('<text class="section-title">价格设置</text>');
    expect(view).toContain("{{editable ? '待提交' : '只读'}}");
    expect(view).toContain('<text class="field-label">出租时间</text>');
    expect(view).toContain('<text class="date-label">开始时间</text>');
    expect(view).toContain('<text class="date-label">结束时间</text>');
    expect(view).toContain('wx:for="{{deliveryItems}}"');
    expect(view).toContain("{{submitting ? '处理中…' : primaryActionText}}");
  });

  test('keeps live values and handlers while following the Figma leading value axis', () => {
    const view = read('miniprogram/pages/listing-price/index.wxml');
    const script = read('miniprogram/pages/listing-price/index.ts');
    const style = read('miniprogram/pages/listing-price/index.wxss');

    // The live value and its input handler must stay on the same control; the control also
    // carries the disabled/aria state, so attribute order is not part of the contract.
    expect(view).toMatch(/<input[^>]*value="\{\{rent\}\}"[^>]*bindinput="input"/u);
    expect(view).toMatch(/<input[^>]*value="\{\{deposit\}\}"[^>]*bindinput="input"/u);
    expect(view).toContain('bindchange="changeStartDate"');
    expect(view).toContain('bindchange="changeEndDate"');
    expect(view).toContain('<text class="price-unit xy-price__unit">{{priceUnitSuffix}}</text></view>');
    expect(style).not.toContain('min-width: 156px');
    expect(style).toMatch(/\.price-input-cell \{[^}]*min-width: 1ch/su);
    expect(style).toMatch(/\.price-input-cell input \{[^}]*text-align: left/su);
    expect(style).toMatch(/\.price-unit \{[^}]*margin-left: auto/su);
    expect(script).toContain('publicationApi.prepareUpdateIntent');
    expect(script).toContain('publicationApi.updateDraft');
    expect(script).toContain('publicationApi.submitDraft');
    expect(script).toContain('publicationApi.draft');
    expect(script).toContain('draftMoneyInput(page.data.rent)');
    expect(script).toContain('available_until: requestBoundary(page.data.availabilityEnd, true)');
    expect(script).toContain('/pages/publish/index?draft_id=');
    expect(script).not.toMatch(/mockApi|shared\/fixture|setListingPrice|Number\(this\.data\.(?:rent|deposit)\)/u);
    // The server-validation copy lives in the page model and the view renders it through the
    // binding, so the contract is "the view shows the guidance" plus "the copy names the server".
    expect(view).toContain('{{guidanceText}}');
    expect(script).toContain('提交资格由服务端权威校验');
    expect(view).not.toMatch(/审核通过|确定上架|已上架/u);
    expect(script).not.toContain("rent: '400'");
    expect(script).not.toContain("deposit: '6000'");
  });
});
