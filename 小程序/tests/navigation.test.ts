import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { figmaBoards } from '../miniprogram/shared/design/figma-map';

const root = process.cwd();
const miniprogramRoot = join(root, 'miniprogram');
const app = JSON.parse(readFileSync(join(miniprogramRoot, 'app.json'), 'utf8')) as {
  pages: string[];
  window: Record<string, unknown>;
  tabBar: { custom: boolean; list: Array<{ pagePath: string }> };
};
const tabPages = app.tabBar.list.map((item) => `/${item.pagePath}`);

function source(route: string, extension: 'ts' | 'wxml' | 'wxss' | 'json'): string {
  return readFileSync(join(miniprogramRoot, `${route}.${extension}`), 'utf8');
}

/** Match opening tags without treating a comparison inside a quoted binding as a tag end. */
function openTag(markup: string, name: string, attribute?: string, value?: string): string {
  const tags = [...markup.matchAll(/<[a-z][\\w-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g)].map((match) => match[0]);
  const tag = tags.find((candidate) => candidate.startsWith('<' + name + ' ')
    && (!attribute || candidate.includes(attribute + '="' + value + '"')));
  expect(tag, name + ':' + (attribute ?? '') + '=' + (value ?? '')).toBeDefined();
  return tag!;
}

function expectComponent(page: string, name: string): void {
  const config = JSON.parse(source(page, 'json')) as { usingComponents?: Record<string, string> };
  const global = JSON.parse(readFileSync(join(miniprogramRoot, 'app.json'), 'utf8')) as { usingComponents?: Record<string, string> };
  const registered = config.usingComponents?.[name] ?? global.usingComponents?.[name];
  expect(registered, page + ':' + name).toBeTruthy();
  expect(source(page, 'wxml'), page).toContain('<' + name);
}

describe('native navigation contract', () => {
  test('registers four official custom-tab-bar roots', () => {
    expect(app.tabBar.custom).toBe(true);
    expect(tabPages).toEqual(['/pages/home/index', '/pages/orders/index', '/pages/info/index', '/pages/profile/index']);
    expect(source('custom-tab-bar/index', 'ts')).toContain('wx.switchTab');
    expect(source('custom-tab-bar/index', 'wxss')).toContain('env(safe-area-inset-bottom)');
  });

  test('splits the information hub into explicit secondary entries', () => {
    // IA revision: conversations are direct; guides moved to profile; the local pseudo-notice route is retired.
    expect(app.pages).toEqual(expect.arrayContaining(['pages/order-messages/index', 'pages/private-messages/index', 'pages/info-guide/index']));
    expect(app.pages).not.toContain('pages/service-notices/index');
    const markup = source('pages/info/index', 'wxml');
    for (const handler of ['openConversation', 'openLogin']) expect(markup).toContain('bindtap="' + handler + '"');
    expect(markup).toContain('open-type="contact"');
    expect(source('pages/info/index', 'ts')).not.toContain('mode=support');
    expect(markup).not.toMatch(/bindtap="(?:openMessageEntry|openGuide)"/);
    expect(source('pages/profile/index', 'ts')).toContain('/pages/info-guide/index');
    expect(source('pages/order-messages/index', 'ts')).toContain('/pages/order-detail/index?id=');
    expect(source('pages/private-messages/index', 'ts')).toContain('mode=c2c&orderId=');
    // The retired pseudo-notice route and the local mock message hub must not come back through
    // the guide page. Recording the validated guide reading for the configured member mission is
    // not that: memberRules routes the `guide` mission to this page, and the sibling detail pages
    // record their visits the same way.
    expect(source('pages/info-guide/index', 'ts')).not.toMatch(/service-notices|shared\/fixture|localServiceNotices/u);
  });
  test('keeps secondary message records as restrained independent cards', () => {
    // Row layout replaces the former independent-card spacing; preserve identity and disclosure.
    const conversations = source('pages/private-messages/index', 'wxml');
    expect(openTag(conversations, 'view', 'bindtap', 'openConversation')).toContain('data-order-id="{{item.orderId}}"');
    expect(conversations).toContain('wx:key="id"');
    expect(conversations).toContain('{{item.lastMessage}}');
    for (const page of ['pages/private-messages/index']) {
      expect(source(page, 'wxss')).not.toContain('box-shadow: var(--xy-shadow-card);');
    }
  });
  test('uses plain communication headers and magazine-style guide sections', () => {
    const guideMarkup = source('pages/info-guide/index', 'wxml');
    const guideStyle = source('pages/info-guide/index', 'wxss');
    const communicationStyles = [
      source('pages/info/index', 'wxss'),
      source('pages/order-messages/index', 'wxss'),
      source('pages/private-messages/index', 'wxss'),
      source('pages/info-guide/index', 'wxss'),
      source('pages/chat/index', 'wxss'),
    ].join('\n');

    expect(communicationStyles).not.toContain('background-image');
    expect(communicationStyles).not.toContain('page-heading-media');
    expect(communicationStyles).not.toContain('guide-hero-media');
    expect(communicationStyles).not.toContain('chat-header-media');
    expect(guideMarkup).not.toContain('guide-section-list');
    expect(guideMarkup).toContain("index === 0 ? 'is-first' : ''");
    expect(guideStyle).toMatch(/\.guide-index \{[^}]*flex: 0 0 var\(--xy-size-icon-feature\);/s);
    expect(guideStyle).toContain('color: var(--xy-color-text-muted);');
    expect(guideStyle).toContain('padding: 0; background: transparent;');
  });

  test('uses custom navigation for tab roots, internal back steps and the accepted transparent header', () => {
    // All secondary pages now use the registered shared header; membership remains untitled.
    for (const page of app.pages) {
      const config = JSON.parse(source(page, 'json')) as Record<string, unknown>;
      expect(config.navigationStyle, page).toBe('custom');
      expect(config.navigationBarTitleText, page).toBeTypeOf('string');
      if (!tabPages.includes('/' + page) && page !== 'pages/login/index') expectComponent(page, 'page-header');
    }
    const memberHeader = openTag(source('pages/membership/index', 'wxml'), 'page-header');
    expect(memberHeader).toContain('title=""');
    expect(memberHeader).toContain('background="transparent"');
    expect(memberHeader).toContain('inverse="{{true}}"');
  });
  test('uses native navigation for cabinet owners and their dedicated credential page', () => {
    // Shared custom navigation supersedes the old system-title contract without merging routes.
    for (const page of ['pages/cabinet-code/index', 'pages/order-detail/index', 'pages/cabinet-return/index']) {
      expectComponent(page, 'page-header');
      expectComponent(page, 'page-shell');
      const header = openTag(source(page, 'wxml'), 'page-header');
      expect(header).toContain('slot="header"');
      expect(header).toContain('bindback="onSecondaryNavigationBack"');
      expect(source(page, 'ts')).toContain(page === 'pages/cabinet-return/index' ? 'createReturnCabinetState' : 'createRentalPageState');
      expect(source('shared/interaction/order-unavailable', 'ts')).toMatch(/onSecondaryNavigationBack\s*\(/);
    }
  });
  test('keeps custom-navigation measurement in the shared host adapter', () => {
    // Custom heroes measure locally; membership and API draft forms use the shared page-header.
    for (const route of ['pages/home/index']) {
      const script = source(route, 'ts');
      expect(script, route).toContain("from '../../shared/presentation/navigation-metrics'");
      expect(script, route).toContain('readNavigationMetrics()');
      expect(script, route).not.toContain('wx.getSystemInfoSync()');
    }
    expectComponent('pages/confirm/index', 'page-header');
    expectComponent('pages/info/index', 'page-header');
    expectComponent('pages/membership/index', 'page-header');
    expectComponent('pages/publish/index', 'page-header');
    expect(source('pages/publish/index', 'ts')).not.toContain('wx.getSystemInfoSync()');
    const header = source('components/page-header/index', 'ts');
    expect(header).toContain('readNavigationMetrics(minimum)');
    expect(header).toContain('pageLifetimes');
    expect(header).toContain('attached()');
    expect(source('pages/membership/index', 'ts')).not.toContain('wx.getSystemInfoSync()');
  });
  test('uses a half-height login sheet with separate WeChat and phone actions', () => {
    expect(source('pages/login/index', 'wxml')).toContain('<login-sheet id="login-sheet"');
    const markup = source('components/login-sheet/index', 'wxml');
    const style = source('components/login-sheet/index', 'wxss');
    expect(markup).toContain('class="login-sheet"');
    expect(markup).toContain('微信登录');
    expect(markup).toContain('手机号快捷登录');
    expect(markup).toContain('暂不登录，继续逛逛');
    expect(markup).toContain('src="{{icons.loginPhone}}"');
    expect(markup).toContain('src="{{icons.loginWechat}}"');
    expect(markup).not.toMatch(/输入手机号码|获取验证码|将使用你在微信选择的手机号/);
    expect(style).toMatch(/\.login-sheet \{[^}]*max-height: calc\(100vh - var\(--xy-control-height-large\)\);[^}]*overflow-y: auto;/);
    expect(style).toContain('env(safe-area-inset-bottom)');
  });

  test('keeps every documented Figma route registered', () => {
    const registered = new Set(app.pages.map((page) => `/${page}`));
    for (const board of figmaBoards) expect(registered.has(board.route.split('?')[0] ?? ''), board.name).toBe(true);
  });

  test('does not retain copied navigation or capsule components', () => {
    const combined = app.pages.map((page) => `${source(page, 'ts')}\n${source(page, 'wxml')}\n${source(page, 'wxss')}`).join('\n');
    expect(combined).not.toMatch(/<app-nav|top-actions|hero-actions|ghost-actions|wx\.reLaunch/);
    expect(existsSync(join(miniprogramRoot, 'components/app-nav/index.ts'))).toBe(false);
  });

  test('keeps tab and non-tab routing APIs separated', () => {
    const combined = [...app.pages, 'custom-tab-bar/index'].map((page) => source(page, 'ts')).join('\n');
    expect(combined).not.toContain('wx.reLaunch');
    for (const tab of tabPages) {
      expect(combined).not.toMatch(new RegExp(`wx\\.(?:navigateTo|redirectTo)\\(\\{ url: ['"\\x60]${tab.replace(/\//g, '\\/')}`));
    }
  });

  test('backs fixed action areas with bottom safe-area insets', () => {
    const sharedStyle = source('shared/design/components', 'wxss');
    expect(sharedStyle).toContain('.xy-bottom-action');
    expect(sharedStyle).toContain('env(safe-area-inset-bottom)');
    for (const page of ['pages/detail/index', 'pages/confirm/index', 'pages/identity/index', 'pages/contract/index', 'pages/order-detail/index', 'pages/order-detail/index', 'pages/return-submit/index', 'pages/cabinet-return/index', 'pages/dispute/index', 'pages/addresses/index', 'pages/publish-eligibility/index', 'pages/publish/index']) {
      const style = source(page, 'wxss');
      const markup = source(page, 'wxml');
      const usesSharedBottomActions = markup.includes('<bottom-actions') || (markup.includes('<page-shell') && markup.includes('has-footer') && markup.includes('slot="footer"') && source('components/page-shell/index', 'wxss').includes('env(safe-area-inset-bottom)'));
      if (!markup.includes('has-footer="{{false}}"')) expect(style.includes('position: fixed') || markup.includes('xy-bottom-action') || usesSharedBottomActions, page).toBe(true);
      expect(style.includes('env(safe-area-inset-bottom') || markup.includes('xy-bottom-action') || usesSharedBottomActions, page).toBe(true);
    }
  });

  test('binds every declared page interaction to an implementation', () => {
    for (const page of [...app.pages, 'custom-tab-bar/index']) {
      const markup = source(page, 'wxml');
      const pageSource = source(page, 'ts');
      const script = pageSource + (pageSource.includes('...unavailableOrderPage(') ? source('shared/interaction/order-unavailable', 'ts') : '') + (pageSource.includes('createRentalOrdersPage') ? source('shared/interaction/rental-orders-page', 'ts') : '');
      const handlers = [...markup.matchAll(/(?:bind|catch)(?:tap|input|change|confirm)="([A-Za-z][A-Za-z0-9_]*)"/g)].map((match) => match[1] ?? '');
      for (const handler of handlers) expect(script, `${page}:${handler}`).toMatch(new RegExp(`\\b${handler}\\s*(?:\\(|:\\s*blockOrderAction\\b)`));
    }
  });

  test('keeps order state out of URLs and routes return transport through the shared API adapter', () => {
    const flowPages = ['pages/orders/index', 'pages/order-detail/index', 'pages/wechat-waiver/index', 'pages/cabinet-code/index', 'pages/order-detail/index', 'pages/return-submit/index', 'pages/cabinet-return/index', 'pages/cabinet-open/index', 'pages/dispute/index'];
    const combined = flowPages.map((page) => `${source(page, 'ts')}\n${source(page, 'wxml')}`).join('\n');
    expect(combined).not.toContain('?status=');
    expect(combined).not.toMatch(/wx\.(?:uploadFile|request\(|login)/);
    expect(source('pages/order-detail/index', 'wxml')).not.toContain('platformMock');
    expect(source('pages/dispute/index', 'wxml')).not.toContain('platformMock');
  });

  test('does not expose development or simulation copy in user-facing pages', () => {
    const cabinetFlowPages = ['pages/order-detail/index', 'pages/cabinet-return/index'];
    const combined = app.pages.filter((page) => !['pages/profile/index', 'pages/wechat-waiver/index'].includes(page)).map((page) => source(page, 'wxml')).join('\n');
    expect(combined).not.toMatch(/mock|fixture|模拟|虚构|原型|角色视角|平台Mock|本地/i);
    for (const page of cabinetFlowPages) expect(source(page, 'wxml'), page).not.toMatch(/模拟|测试码|完整显示|配置后已发送|失效时间|柜机屏幕/);
    expect(source('pages/profile/index', 'wxml')).not.toMatch(/Mock|重置演示|切换账号/i);
    expect(source('pages/wechat-waiver/index', 'wxml')).toContain('查询校验结果');
    expect(source('pages/wechat-waiver/index', 'wxml')).not.toContain('simulateSuccess');
    expect(source('pages/wechat-waiver/index', 'wxml')).not.toContain('simulateFailure');
    const runtime = [...app.pages, 'app'].map((page) => source(page, 'ts')).join('\n');
    expect(runtime).not.toContain('runMockOrchestrator');
    expect(runtime).not.toContain("'platformMock'");
    expect(runtime).not.toContain('systemOrderAction');
    expect(runtime).not.toContain("externalResult: 'success'");
    const returns = source('pages/return-submit/index', 'ts');
    expect(returns).not.toContain('mockApi');
    expect(returns).not.toContain('fixture');
  });

  test('projects the visible version and B2C responsibility from current authorities', () => {
    const appScript = source('app', 'ts');
    const detailScript = source('pages/order-detail/index', 'ts');
    const detailMarkup = source('pages/order-detail/index', 'wxml');
    const fixtureScript = readFileSync(join(miniprogramRoot, 'shared/fixture/index.ts'), 'utf8');
    expect(appScript).toContain("version: '1.0.1.7'");
    expect(detailScript).not.toContain('mockApi');
    expect(detailMarkup).toContain('wx:for="{{assetFacts}}"');
    expect(detailMarkup).toContain('{{pickupText}}');
    expect(fixtureScript).not.toContain('等待门店确认后再支付');
    expect(fixtureScript).not.toContain('function seedWalletEntries');
  });





  test('keeps main tab titles pinned and projects order-card copy from the current state', () => {
    // List summary no longer duplicates status copy. Pinning is owned by page-shell/header.
    expect(source('pages/orders/index', 'ts')).not.toContain('mockApi');
    const orders = source('pages/orders/index', 'wxml');
    expect(openTag(orders, 'page-shell')).toContain('fixed-header');
    expect(openTag(orders, 'page-header')).toContain('show-back="{{false}}"');
    expect(orders).toContain('{{item.currentNodeText || item.mainStatusText}}');
    expectComponent('pages/orders/index', 'order-product-summary');
    expect(source('components/page-shell/index', 'wxml')).toContain("fixedHeader ? 'page-shell__header--fixed'");
    expect(source('components/page-header/index', 'wxss')).toMatch(/\.page-header\s*\{[^}]*position:\s*fixed/);
    expect(openTag(source('components/page-header/index', 'wxml'), 'view', 'class', 'page-header-space')).toContain('height:{{totalHeight}}px');
    expectComponent('pages/info/index', 'page-header');
    expect(source('pages/profile/index', 'wxml')).toContain('<page-header');
  });









  test('keeps dispute context and resolution details hidden until a submission exists', () => {
    const disputeScript = source('pages/dispute/index', 'ts');
    const disputeMarkup = source('pages/dispute/index', 'wxml');
    const disputeStyle = source('pages/dispute/index', 'wxss');
    expect(disputeScript).not.toContain('等待出租方提交');
    expect(disputeMarkup).toContain("wx:if=\"{{modeCopy && (order.kind !== 'c2c' || editable)}}\" class=\"status-copy\"");
    expect(disputeMarkup).not.toContain('问题类型');
    expect(disputeMarkup).not.toContain('售后状态');
    expect(disputeMarkup).toContain('双方提交内容');
    expect(disputeMarkup).toContain('submission-actor');
    expect(disputeMarkup).toContain("item.actor === 'lessor' ? '出租方提交' : '承租方提交'");
    expect(disputeMarkup).toContain('proposal-amount-input');
    expect(disputeStyle).toContain('.proposal-amount-input { height: var(--xy-control-height); min-height: var(--xy-control-height);');
    expect(disputeStyle).toContain('padding: var(--xy-inset-card);');
    expect(disputeStyle).toContain('font-size: var(--xy-text-body-size);');
    expect(disputeStyle).toContain('margin-top: var(--xy-space-2);');
    expect(disputeStyle).toContain('.proposal-amount-input + .field-head { margin-top: var(--xy-space-4); }');
  });

  test('keeps closed-order status separate from current product read navigation', () => {
    const markup = source('pages/order-detail/index', 'wxml');
    expectComponent('pages/order-detail/index', 'order-product-summary');
    expect(openTag(markup, 'order-product-summary')).toContain('bindopen="openProduct"');
    expect(markup).not.toContain('showSupportFab');
    const script = source('pages/order-detail/index', 'ts');
    expect(script).toContain('openProduct()');
    expect(script).not.toContain('listingIdForOrder');
    expect(script).not.toContain('manage=1');
    expect(script).not.toContain('openSupport');
    expect(source('pages/detail/index', 'ts')).not.toContain('mockApi');
    expect(source('pages/detail/index', 'ts')).toContain('本人发布管理正在接入');
    expect(source('pages/detail/index', 'wxml')).toContain('bindtap="editListing"');
  });










  test('shows real own identity status without simulated verification or an order action', () => {
    const identity = source('pages/identity/index', 'wxml');
    expect(identity).toContain('真实姓名');
    expect(identity).toContain('身份证号');
    expect(identity).toContain('本期不进行第三方身份核验');
    expect(identity).not.toContain('请输入手机号码');
    expect(identity).not.toContain('提交证件信息');
    expect(source('pages/identity/index', 'ts')).toContain('accountApi.identity()');
    expect(source('pages/identity/index', 'ts')).not.toContain('mockApi');
    expect(source('pages/publish-eligibility/index', 'ts')).toContain('publicationApi.eligibility()');
    expect(source('pages/publish-eligibility/index', 'ts')).not.toContain("'/pages/identity/index?from=publish'");
    expect(source('pages/profile/index', 'ts')).not.toContain('mockApi');
    expect(source('pages/order-detail/index', 'ts')).not.toContain('/pages/identity/index?id=');
  });
  test('routes publishing checks and keeps the eligible action explicit', () => {
    const script = source('pages/publish-eligibility/index', 'ts');
    const markup = source('pages/publish-eligibility/index', 'wxml');
    const style = source('pages/publish-eligibility/index', 'wxss');
    const homeScript = source('pages/home/index', 'ts');
    expect(script).toContain('publicationApi.eligibility()');
    expect(script).toContain("'/pages/membership/index'");
    expect(script).toContain("'/pages/publish-quota/index'");
    expect(script).toContain("'/pages/rental-service/index'");
    expect(script).toContain('wx.navigateTo({ url: route })');
    expect(markup).toContain('发布设备');
    expect(style).toContain('.service-card');
    expect(style).toContain('.service-button');
    expect(style).toContain('border-radius: var(--xy-radius-md);');
    expect(style).toContain('padding-top: var(--xy-space-3);');
    expect(homeScript).not.toContain('mockApi');
    expect(homeScript).toContain('发布入口正在接入');
  });

  test('binds profile publishing entries to real quota and rental service pages', () => {
    const profileScript = source('pages/profile/index', 'ts');
    const quotaScript = source('pages/publish-quota/index', 'ts');
    const serviceScript = source('pages/rental-service/index', 'ts');
    expect(profileScript).toContain("{ title: '发布额度', route: '/pages/publish-quota/index' }");
    expect(profileScript).toContain("{ title: '出租服务', route: '/pages/rental-service/index' }");
    expect(quotaScript).toContain('benefitApi.summary()');
    expect(quotaScript).not.toContain('purchasePublishQuota');
    expect(serviceScript).toContain('createBenefitPage'); expect(serviceScript).not.toContain('purchaseService');
    expect(serviceScript).toContain('toggleRecords');
  });

  test('allows profile publication and own-listing entries through its route gate', () => {
    const profileScript = source('pages/profile/index', 'ts');
    const routeGate = profileScript.match(/const connectedRoutes=new Set\(\[([^\]]+)\]\)/u)?.[1];
    expect(routeGate).toBeDefined();
    expect(routeGate).toContain("'/pages/publish-eligibility/index'");
    expect(routeGate).toContain("'/pages/listings/index'");
    expect(routeGate).toContain("'/pages/device-orders/index'");expect(routeGate).toContain("'/pages/wallet/index'");
  });

  test('routes profile device entries to role-scoped secondary order pages', () => {
    const script = source('pages/profile/index', 'ts');
    for (const mode of ['rent', 'lend']) expect(script).toContain('/pages/device-orders/index?mode=' + mode);
    // Current role title is rendered by shared header, not wx.setNavigationBarTitle.
    expectComponent('pages/device-orders/index', 'page-header');
    expect(openTag(source('pages/device-orders/index', 'wxml'), 'page-header')).toContain('title="{{title}}"');
    expect(source('pages/device-orders/index', 'wxml')).toContain('bindtap="openOrder"');
  });
  test('uses progressive disclosure for the current publishing fields', () => {
    const script = source('pages/publish/index', 'ts');
    const markup = source('pages/publish/index', 'wxml');
    const style = source('pages/publish/index', 'wxss');
    const homeScript = source('pages/home/index', 'ts');
    expect(script).toContain("['pricing','details','delivery','accessories','proof'].includes(sheet)");
    expect(script).toContain('view:publicationDraftView(resource)');
    expect(source('shared/presentation/api-publication-draft', 'ts')).toContain('deliveryText:deliveries.filter');
    expect(markup).toContain('data-sheet="pricing"');
    expect(markup).toContain('data-sheet="details"');
    expect(markup).toContain('data-sheet="delivery"');
    expect(markup).toContain('data-sheet="accessories"');
    expect(markup).not.toContain('data-sheet="proof"');
    expect(markup).toContain('data-field="expectedRent"');
    expect(markup).toContain('data-field="expectedDeposit"');
    expect(markup).toContain('data-field="serialNumber"');
    expect(markup).toContain('data-leg="outbound"');
    expect(markup).toContain('data-leg="return"');
    expect(markup).toContain('bindtap="openSheet"');
    expect(markup).toContain('price-capsule-divider');
    expect(markup).toContain('icons.deliveryCheck');
    expect(markup).toContain('<page-header title="{{navigationTitle}}" bindback="handleNavigationBack"');
    expect(markup).toContain('bindchange="changeStartDate"');
    expect(markup).toContain('bindchange="changeEndDate"');
    expect(markup).toContain('bindtap="confirmSheet"');
    expect(markup).toContain('showDraftNotice && draftNoticeText');
    expect(markup).toContain('bindtap="saveDraft"');
    expect(script).toContain('clearDraft(){this.unavailable();}');
    expect(markup).not.toContain('也可以直接修改详细地址');
    expect(markup).not.toContain('sheet-close');
    expect(markup).not.toContain('sheet-date-entry');
    expect(script).toContain('confirmSheet()');
    expect(script).toContain('publicationApi.draft(r.id)');
    expect(script).not.toContain('mockApi');
    expect(script).toContain('showDraftNotice:true');
    expect(script).toContain('clearDraft()');
    expect(homeScript).toContain('supplyApi.list(filter)');
    expect(homeScript).not.toContain('mode=draft&id=');
    expect(markup).toContain('wx:if="{{draftId && !activeSheet}}"');
    expect(markup).not.toContain('images.unsplash.com');
    expect(markup).not.toContain('📷');
    expect(style).toContain('position: fixed');
    expect(style).toContain('env(safe-area-inset-bottom)');
    expect(markup).toContain('xy-bottom-action');
    expect(style).toContain('.form-card {');
    expect(markup).toContain('设备图片');
    expect(markup).not.toContain('第 1 步');
    expect(style).toMatch(/\.form-card \{[^}]*padding: var\(--xy-inset-card\);/s);
    expect(style).toContain('border: 0;');
    expect(style).toContain('.form-card + .form-card,');
    expect(style).toContain('margin-top: var(--xy-space-3);');
    expect(style).toContain('.type-list');
    expect(style).toContain('padding: 0 var(--xy-space-3);');
    expect(style).toContain('min-height: var(--xy-control-height);');
    expect(style).toContain('gap: var(--xy-space-3);');
    expect(style).toContain('.core-card,\n.disclosure-card {\n  padding-bottom: 0;');
    expect(style).toContain('.core-card > .disclosure-row:last-child,');
    expect(style).toContain('padding-bottom: var(--xy-space-3);');
    expect(style).toContain('.price-capsule-divider');
    expect(style).toContain('.sheet-confirm');
    expect(style).not.toContain('min-height: 50vh;');
    expect(style).toContain('max-height: 84vh;');
    expect(style).toContain('width: 152px;');
    expect(style).toContain('.publish-submit-button.is-ready');
    expect(style).toMatch(/\.sheet-confirm \{[^}]*font-size: var\(--xy-text-body-size\)/);
  });




});
