import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { formatDate, formatDateTime } from '../miniprogram/shared/format/date-time';
import { styleValue } from './helpers/style-contract';

const root = process.cwd();
const read = (sourcePath: string) => readFileSync(join(root, sourcePath), 'utf8');
const pageStyle = (page: string) => read(`miniprogram/pages/${page}/index.wxss`);
const pageView = (page: string) => read(`miniprogram/pages/${page}/index.wxml`);

describe('XY-20260903-001 Batch 5 visual follow-up contract', () => {
  test('keeps message boundaries and the current grouped device-order presentation', () => {
    const contracts = [
      ['order-messages', '.message-list', '.order-message'],
    ] as const;

    for (const [page, listSelector, cardSelector] of contracts) {
      const style = pageStyle(page);
      expect(style, page).toMatch(new RegExp(`\\${listSelector} \\{[^}]*gap: var\\(--xy-space-3\\)`));
      expect(style, page).toMatch(new RegExp(`\\${cardSelector} \\{[^}]*border-radius: var\\(--xy-radius-(?:md|container)\\)`));
      expect(style, page).toMatch(new RegExp(`\\${cardSelector} \\{[^}]*border: 0;`));
    }
    expect(styleValue(pageStyle('private-messages'), '.conversation-list', 'overflow')).toBe('hidden');
    expect(styleValue(pageStyle('private-messages'), '.conversation-row', 'min-height')).toBe('44px');
    expect(styleValue(pageStyle('device-orders'), '.rental-card + .rental-card', 'margin-top')).toBe('12px');
    expect(styleValue(pageStyle('device-orders'), '.name', 'overflow-wrap')).toBe('anywhere');
  });

  test('keeps profile, detail and order-detail geometry at the revised owner values', () => {
    const profile = pageStyle('profile');
    expect(styleValue(profile, '.avatar', 'width')).toBe('52px');
    expect(styleValue(profile, '.avatar', 'height')).toBe('52px');
    expect(profile).toMatch(/\.member-entry-shell \{[^}]*min-height: var\(--xy-control-height-compact\)/);

    const detail = pageStyle('detail');
    expect(pageView('detail')).toContain('open-type="contact"');
    expect(styleValue(detail, '.detail-action-group', 'gap')).toBe('12px');

    const orderDetail = pageStyle('order-detail');
    expect(styleValue(orderDetail, '.order-info-basics .detail-line + .detail-line', 'margin-top')).toBe('12px');
    expect(orderDetail).toMatch(/\.order-info-toggle image \{[^}]*width: var\(--xy-size-icon-sm\);[^}]*height: var\(--xy-size-icon-sm\)/);
    expect(styleValue(orderDetail, '.order-info-toggle', 'position')).toBe('relative');
    expect(pageView('order-detail')).toContain('toggleOrderInfo');
  });

  test('shares store product geometry and keeps the missing-store recovery action in the empty state', () => {
    const cabinets = pageStyle('cabinets');
    const stores = pageStyle('stores');
    const discoveryDevice = read('miniprogram/shared/design/discovery-device.wxml');
    const components = read('miniprogram/shared/design/components.wxss');
    expect(styleValue(components, '.xy-discovery-device__media', 'width')).toBe(styleValue(components, '.xy-discovery-device__media', 'height'));
    expect(styleValue(components, '.xy-discovery-device--narrow .xy-discovery-device__media', 'width')).toBe(styleValue(components, '.xy-discovery-device--narrow .xy-discovery-device__media', 'height'));
    expect(discoveryDevice).toContain('class="xy-discovery-device__media"');
    expect(pageView('stores')).toContain('<template is="discovery-device"');
    expect(pageView('cabinets')).toContain('<template is="discovery-device"');
    expect(stores).toContain('.store-gallery');
    expect(cabinets).toContain('.cabinet-device-list');
    expect(pageView('cabinets')).not.toContain('class="device-arrow"');

    const missingStore = pageView('store-detail');
    expect(missingStore).toContain('wx:if="{{missing}}" class="xy-empty-page"');
    expect(missingStore).toContain('class="xy-empty-page__action xy-action-primary xy-action-text xy-tap" bindtap="goBack"');
    expect(missingStore).not.toContain('class="missing-actions');
  });

  test('uses registered quota navigation, solid actions and aligned login agreement', () => {
    const quotaJson = JSON.parse(read('miniprogram/pages/publish-quota/index.json')) as { navigationStyle?: string };
    expect(quotaJson.navigationStyle).toBe('custom');
    expect(pageView('publish-quota')).toContain('<page-header');
    expect(pageView('publish-quota')).toContain('bindback="onSecondaryNavigationBack"');
    expect(pageStyle('publish-quota')).toMatch(/\.quota-button-shell \{[^}]*border-radius: var\(--xy-radius-md\);[^}]*background: var\(--xy-color-brand\);[^}]*color: var\(--xy-color-text-inverse\)/);

    const loginView = read('miniprogram/components/login-sheet/index.wxml');
    const login = read('miniprogram/components/login-sheet/index.wxss');
    expect(pageView('login')).toContain('<login-sheet id="login-sheet"');
    expect(loginView).toContain('《用户协议》<button class="agreement-link-hit"');
    expect(login).toMatch(/\.agreement-row \{[^}]*align-items: center;[^}]*justify-content: center;[^}]*gap: var\(--xy-space-2\)/);
    expect(styleValue(login, '.agreement-row', 'position')).not.toBe('fixed');
    expect(login).toMatch(/\.agreement-text \{[^}]*flex: 0 1 auto/);
    expect(styleValue(login, '.agreement-link-label', 'display')).toBe('inline-block');
    expect(styleValue(login, '.agreement-link-label', 'position')).toBe('relative');
    expect(styleValue(login, '.agreement-link-hit', 'position')).toBe('absolute');
    expect(styleValue(login, '.agreement-link-hit', 'min-height')).toBe('44px');
    expect(styleValue(login, '.agreement-link-hit', 'background')).toBe('transparent');
    const legalButtons = [...loginView.matchAll(/<button\b[^>]*class="agreement-link-hit"[^>]*>/g)].map((match) => match[0]);
    expect(legalButtons).toHaveLength(2);
    for (const legal of ['user-agreement', 'privacy-policy']) {
      expect(legalButtons.some((tag) => tag.includes(`data-legal="${legal}"`) && tag.includes('catchtap="openLegal"'))).toBe(true);
    }
  });

  test('keeps every audited large action on the 6px semantic radius', () => {
    const auditedPages = [
      'cabinet-open', 'cabinet-return', 'detail', 'dispute',
      'info-guide', 'listing-price', 'order-messages', 'private-messages', 'publish-quota',
      'service-detail', 'store-detail',
    ];
    for (const page of auditedPages) {
      expect(pageStyle(page), page).not.toMatch(/(?:state-button|complete-button|back-action|missing-card view|dark-button|primary-action|secondary-action|edit-button|confirm-button|support-action-shell|buy-button|quota-button-shell|missing-back-button)[^{]*\{[^}]*border-radius: var\(--xy-radius-pill\)/);
    }
    expect(JSON.parse(read('miniprogram/app.json')).pages).not.toContain('pages/code/index');
    expect(pageView('cabinet-detail')).not.toContain('<cabinet-credential-input');
  });

  test('closes the S4 corrective layout findings without changing page actions', () => {
    const withdrawal = pageStyle('withdrawal');
    expect(pageView('withdrawal').match(/xy-card/g)).toHaveLength(5);
    expect(pageView('withdrawal')).not.toContain('xy-card--outlined');
    expect(pageView('withdrawal')).toMatch(/class="all-button[^>]*>\s*<text>全部提现<\/text>\s*<button\b[^>]*bindtap="fillAll"/);
    const fillAll = pageView('withdrawal').match(/<button\b[^>]*bindtap="fillAll"[^>]*>/)?.[0] ?? '';
    expect(fillAll).toContain('disabled="{{amountDisabled}}"');
    expect(fillAll).toContain('aria-disabled="{{amountDisabled}}"');
    expect(fillAll).toContain('aria-label="全部提现"');
    expect(styleValue(withdrawal, '.all-button', 'position')).toBe('relative');
    expect(styleValue(withdrawal, '.touch-overlay', 'position')).toBe('absolute');
    expect(styleValue(withdrawal, '.touch-overlay', 'min-width')).toBe('44px');
    expect(styleValue(withdrawal, '.touch-overlay', 'min-height')).toBe('44px');
    expect(styleValue(withdrawal, '.touch-overlay', 'background')).toBe('transparent');
    expect(withdrawal).toMatch(/\.form-section, \.account-section \{[^}]*margin-top: var\(--xy-layout-content-gap\);[^}]*border-radius: var\(--xy-radius-container\)/);
    expect(pageView('withdrawal')).toContain('slot="footer"');
    expect(withdrawal).not.toMatch(/bottom-actions \{[^}]*position: fixed;/);

    expect(pageView('region')).toContain('wx:if="{{!searching && cityGroups.length}}" class="alpha-index" scroll-y="true"');
    expect(pageView('region')).toContain('bindtap="jumpLetter"');
    expect(pageView('region')).toContain('scroll-into-view="{{scrollIntoView}}"');
    expect(read('miniprogram/pages/region/index.ts')).toContain("event.target.dataset['letter']");

    const cabinetMissing = pageView('cabinet-detail');
    expect(cabinetMissing).toContain('class="empty-card xy-empty-page xy-empty-page--surface"');
    expect(cabinetMissing).toContain('class="xy-empty-page__action xy-action-primary xy-action-text xy-tap" bindtap="goBack"');
    expect(cabinetMissing).not.toContain('class="missing-actions');

    const listingPrice = pageView('listing-price');
    expect(listingPrice).toContain('class="listing-price-bottom xy-bottom-action"');
    expect(listingPrice).toContain('<status-view wx:elif="{{!listing && hasDraftTarget}}" state="error"');
    expect(listingPrice).toContain('bindaction="handleErrorAction"');
    expect(listingPrice).toContain('返回发布页');

    const memberSubpage = read('miniprogram/shared/design/member-subpage.wxss');
    expect(memberSubpage).toMatch(/\.member-subpage__button \{[^}]*border-radius: var\(--xy-radius-md\)/);
    expect(memberSubpage).toMatch(/\.member-subpage__button--small \{[^}]*border-radius: var\(--xy-radius-md\)/);
    expect(pageView('no-deposit')).toContain("secondaryNavigationTitle || '押金说明'");
    expect(pageView('no-deposit')).toContain('wx:for="{{visibleRules}}" wx:key="id"');
    expect(pageView('no-deposit')).toContain('{{item.detail}}');
  });

  test('normalizes date presentation without changing source timestamps', () => {
    expect(formatDate('2026-8-9 7:03:12')).toBe('2026-08-09');
    expect(formatDateTime('2026-8-9 7:03:12')).toBe('2026-08-09 07:03');
    expect(formatDateTime('2026-09-01T03:24:00.000Z')).toBe('2026-09-01 03:24');
    expect(formatDateTime('unknown')).toBe('unknown');

    expect(read('miniprogram/shared/presentation/diamond-ledger.ts')).toContain('time: formatDateTime(entry.createdAt)');
    expect(read('miniprogram/pages/listings/index.ts')).toContain('createdDate: formatDate(item.updated_at)');
    expect(read('miniprogram/pages/powder-ledger/index.ts')).toContain('present: pinkLedgerEntry');
    expect(pageView('powder-ledger')).toContain('{{item.movementText}} · {{item.detail}}');
    expect(read('miniprogram/shared/presentation/api-point-ledger.ts')).toContain('detail: formatDateTime(new Date(Date.parse(entry.occurred_at) + 8 * 60 * 60 * 1000).toISOString())');
    expect(pageView('dispute')).toContain('提交时间</text><text class="field-hint">{{proposal.createdText}}');
    expect(pageView('dispute')).toContain('提交时间 {{item.createdText}}');
    const wallet = read('miniprogram/pages/wallet/index.ts');
    expect(wallet).not.toContain("createdAt.slice(0, 16).replace('T', ' ')");
  });
});

describe('XY-20260903-001 revision 8 visual relationship contracts', () => {
  test('separates compact visible controls from their hit targets', () => {
    const components = read('miniprogram/shared/design/components.wxss');
    expect(components).toMatch(/\.xy-control-shell--button \{ border-radius: var\(--xy-radius-md, 6px\); \}/);
    expect(components).toMatch(/\.xy-tab__indicator \{[^}]*height: var\(--xy-divider-selected, 2px\);/);

    const chat = pageStyle('chat');
    expect(chat).toMatch(/\.chat-send \{[^}]*min-height:\s*var\(--xy-control-height-order\);[^}]*border-radius:\s*var\(--xy-radius-container\)/);
    expect(chat).toMatch(/\.chat-input \{[^}]*min-height:\s*var\(--xy-control-height-order\);[^}]*padding:\s*var\(--xy-space-3\) var\(--xy-space-2\)/);

    const rentalService = pageStyle('rental-service');
    expect(pageView('rental-service')).toContain('class="package-button-shell"');
    expect(rentalService).toMatch(/\.package-button \{[^}]*min-height: var\(--xy-size-touch-min\)/);
    expect(rentalService).toMatch(/\.package-button-shell \{[^}]*min-height: var\(--xy-button-height-standard\);[^}]*border-radius: var\(--xy-radius-md\)/);

    expect(pageStyle('growth-tasks')).toMatch(/\.growth-task__action-shell \{[^}]*min-height: var\(--xy-button-height-standard\);[^}]*border-radius: var\(--xy-radius-md\)/);
  });

  test('uses visible-edge spacing and one shared product divider contract', () => {
    const home = pageStyle('home');
    const components = read('miniprogram/shared/design/components.wxss');
    expect(styleValue(home, '.section-more', 'min-height')).toBe('44px');
    expect(styleValue(home, '.device-row::after', 'left')).toBe(`${Number.parseFloat(styleValue(home, '.device-thumb', 'width')) + Number.parseFloat(styleValue(home, '.device-row', 'gap'))}px`);
    expect(components).toMatch(/\.xy-product-item:not\(:last-child\)::after \{[^}]*left: calc\(var\(--xy-product-list-media-size, 100px\) \+ var\(--xy-product-list-media-gap, 12px\)\);[^}]*border-bottom: 1rpx dashed/);
    expect(components).toMatch(/\.xy-product-item--media-72:not\(:last-child\)::after \{[^}]*left: calc\(72px \+ var\(--xy-product-list-media-gap, 12px\)\)/);
    expect(components).toMatch(/\.xy-product-item--media-82:not\(:last-child\)::after \{[^}]*left: calc\(var\(--xy-product-list-media-size-compact, 82px\) \+ var\(--xy-product-list-media-gap, 12px\)\)/);
    expect(components).toMatch(/\.xy-product-item--media-100:not\(:last-child\)::after \{[^}]*left: calc\(100px \+ var\(--xy-product-list-media-gap, 12px\)\)/);
    expect(pageView('home')).toContain('device-row--{{item.homeLayout}}');
    expect(pageView('cabinets')).toContain('<template is="discovery-device"');
    expect(pageView('cabinet-detail')).toContain('<template is="discovery-device"');
    expect(pageView('store-detail')).toContain('<template is="discovery-device"');
    expect(pageView('stores')).toContain('<template is="discovery-device"');
    expect(read('miniprogram/pages/home/index.wxss')).not.toContain('--xy-product-divider-offset');
    expect(pageStyle('check-in')).toMatch(/\.sign-button \{[^}]*justify-content: space-between;[^}]*padding: 0 var\(--xy-space-4\)/);
  });

  test('removes implementation-explainer headers while preserving business titles', () => {
    const orderMessages = pageView('order-messages');
    expect(orderMessages).not.toContain('订单状态和履约节点会在这里更新');
    expect(orderMessages).not.toContain('按时间查看订单状态和履约更新');
    expect(pageStyle('order-messages')).not.toMatch(/\.page-heading \{[^}]*background:/);

    expect(pageView('private-messages')).toContain("secondaryNavigationTitle || '私聊信息'");
    expect(pageView('private-messages')).not.toContain('仅展示已建立订单关系的会话');
    const chat = read('miniprogram/pages/chat/index.ts');
    expect(chat).toContain("title: order.counterpartName + ' · ' + order.counterpartRoleText");
    expect(chat).not.toContain("type ChatMode='support'|'c2c'");
    expect(chat).not.toContain('会在这里跟进');
    expect(pageView('device-orders')).toContain('<task-sheet');
    expect(pageView('device-orders')).toContain('bindtap="toggleRecordGroup"');
    expect(pageView('device-orders')).not.toContain('class="heading-description"');
  });

  test('aligns columns, checkbox and currency fields to shared axes', () => {
    expect(pageStyle('profile')).toMatch(/\.asset-item \{[^}]*align-items: center;[^}]*text-align: center;/);
    const contract = pageStyle('contract');
    expect(styleValue(contract, '.contract-checkbox', 'width')).toBe('20px');
    expect(styleValue(contract, '.contract-checkbox', 'height')).toBe('20px');
    expect(pageView('contract')).toContain('aria-checked="{{agreed}}"');

    const listingPrice = pageStyle('listing-price');
    expect(listingPrice).toMatch(/\.input-wrap \{[^}]*display: flex;[^}]*min-width: 0;[^}]*justify-content: flex-start/);
    expect(listingPrice).not.toContain('min-width: 156px');
    expect(listingPrice).toMatch(/\.price-input-cell \{[^}]*position: relative;[^}]*display: block;[^}]*min-width: 1ch/);
    expect(listingPrice).toMatch(/\.price-input-cell input \{[^}]*position: absolute;[^}]*width: 100%;[^}]*text-align: left/);
    expect(pageView('listing-price').match(/class="price-symbol xy-price__symbol"/g)).toHaveLength(2);
    expect(pageView('listing-price').match(/class="price-measure xy-price__value"/g)).toHaveLength(2);
    expect(pageView('listing-price')).not.toContain('price-unit--empty');
  });

  test('anchors empty-state text actions and compact tabs without stray divider lines', () => {
    const serviceDetail = pageView('service-detail');
    expect(serviceDetail).toContain('class="missing-card xy-empty-page xy-empty-page--surface"');
    expect(serviceDetail).toContain('class="xy-empty-page__illustration"');
    expect(serviceDetail).toContain('class="xy-empty-page__action xy-action-primary xy-action-text xy-tap" bindtap="goBack"');
    expect(serviceDetail).toContain('bindtap="goBack"');

    const storeDetail = pageView('store-detail');
    expect(storeDetail).toContain("{{missing ? 'is-missing' : ''}}");
    expect(storeDetail).toContain('wx:if="{{missing}}" class="xy-empty-page"');
    expect(storeDetail).toContain('class="xy-empty-page__action xy-action-primary xy-action-text xy-tap" bindtap="goBack"');
    expect(read('miniprogram/pages/store-detail/index.ts')).toContain('goBack');

    expect(styleValue(pageStyle('device-orders'), '.tabs', 'border-bottom')).toBe('');
    expect(styleValue(pageStyle('rental-service'), '.service-tabs', 'border-bottom')).toBe('0');
    expect(styleValue(pageStyle('rental-service'), '.service-tabs', 'margin-top')).toBe('16px');
    expect(pageStyle('rental-service')).toMatch(/\.service-stat:not\(:last-child\)::after \{[^}]*top: var\(--xy-inset-card\);[^}]*bottom: var\(--xy-inset-card\)/);
  });

  test('keeps white-list dividers aligned and removes duplicate store boundaries', () => {
    const stores = pageStyle('stores');
    const rail = read('miniprogram/shared/design/discovery-rail.wxss');
    expect(styleValue(stores + rail, '.store-section', 'border-bottom')).toContain('8px solid');
    expect(pageView('stores')).toContain('class="store-preview"');
    expect(pageView('stores')).not.toContain('store-all-hit');
    expect(read('miniprogram/shared/design/discovery-device.wxml')).toContain('class="xy-discovery-device');

    const about = pageStyle('about');
    expect(about).toMatch(/\.about-list \{[^}]*margin-top: var\(--xy-layout-content-gap\)/);
    expect(about).toMatch(/\.about-row:not\(:last-child\)::after \{[^}]*right: 0;[^}]*left: 0/);

    const eligibility = pageStyle('publish-eligibility');
    expect(eligibility).toMatch(/\.service-section \{[^}]*margin-top: var\(--xy-layout-section-gap\)/);
    expect(eligibility).toMatch(/\.section-title \{[^}]*display: block;[^}]*line-height: var\(--xy-text-section-title-line-height\)/);

    const wallet = pageStyle('wallet');
    expect(wallet).toMatch(/\.income-summary \{ padding: var\(--xy-inset-card\)/);
    expect(wallet).toMatch(/\.money-row:not\(:last-child\)::after \{[^}]*right: 0;[^}]*left: 0/);
    expect(wallet).toMatch(/\.income-row:not\(\.is-last\)::after \{[^}]*right: 0;[^}]*left: 0/);
  });

  test('normalizes member geometry and native-button grid participation', () => {
    const member = read('miniprogram/shared/design/member-subpage.wxss');
    expect(member).toMatch(/\.member-subpage__hero \{[^}]*padding: var\(--xy-inset-card\)/);
    expect(member).toMatch(/\.member-subpage__actions \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*gap: var\(--xy-space-3\)/);
    expect(member).toMatch(/\.member-subpage__button \{[^}]*width: 100% !important;[^}]*margin: 0 !important/);
    expect(member).toMatch(/\.member-subpage__section \{[^}]*margin-top: var\(--xy-layout-section-gap\)/);
    expect(member).toMatch(/\.member-subpage__section-title \{[^}]*font-size: var\(--xy-text-section-title-size\)/);
    expect(member).toMatch(/\.member-subpage__surface \{[^}]*margin-top: var\(--xy-layout-card-stack-start-gap\)/);
    expect(member).toMatch(/\.member-subpage__footnote \{[^}]*margin: var\(--xy-space-2\)/);

    const powderLedgerView = pageView('powder-ledger');
    expect(powderLedgerView.match(/class="xy-button-reset xy-button-fluid(?: powder-lottery)?"/g)).toHaveLength(3);
    expect(powderLedgerView).toContain('<section-tabs');
    expect(powderLedgerView).toContain('divider="{{false}}"');
    expect(powderLedgerView).toContain('bindchange="setLedgerFilter"');
    expect(powderLedgerView).toContain('icons.membershipBalanceDiamond');
    expect(powderLedgerView).not.toContain('class="withdraw-panel');

    const mallView = pageView('powder-mall');
    expect(mallView).toContain('class="product-card xy-button-reset xy-button-fluid"');
    expect(pageStyle('powder-mall')).toMatch(/\.product-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*gap: var\(--xy-space-3\)/);
    expect(pageStyle('powder-mall')).toMatch(/\.mall-action-shell \{[^}]*min-height: var\(--xy-button-height-standard\);[^}]*border-radius: var\(--xy-radius-md\)/);
  });
});

