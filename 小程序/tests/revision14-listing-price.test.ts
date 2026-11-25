import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');

describe('XY-20260903-001 revision 14 listing-price Figma contract', () => {
  test('implements the direct 2102:929 card, control and footer geometry', () => {
    const view = read('miniprogram/pages/listing-price/index.wxml');
    const style = read('miniprogram/pages/listing-price/index.wxss');

    // 第 5 批改版：摘要卡 + 白色分组行；行高 56、输入占满整行、底栏次左主右
    expect(view).toContain('class="lp-pd"');
    expect(view).toContain('<text class="pf-ch__t">出租条件</text>');
    expect(view).toContain("{{editable ? '待提交' : '只读'}}");
    expect(view).toContain('可租开始');
    expect(view).toContain('可租截止');
    expect(view).toContain('deliveryItems');
    expect(view).toContain("{{submitting ? '处理中…' : primaryActionText}}");
    expect(style).toMatch(/\.lp-input \{[^}]*height: var\(--xy-pf-row\)/u);
    expect(view).toContain('pf-foot');
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
    expect(view).toContain('{{priceUnitSuffix}}');
    expect(style).toMatch(/\.lp-input \{[^}]*text-align: right/su);
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
