import { expect, test, type Page } from '@playwright/test';

const MOCK_VERSION_LABEL = 'v1.0.0.10';
const MOCK_SHELL_LABEL = 'MOCK DEMO · 不连接真实业务 API';
const BUSINESS_RESOURCE_TYPES = new Set(['xhr', 'fetch', 'eventsource']);
const observedBusinessRequests = new WeakMap<Page, string[]>();

async function loginAsMockAdmin(page: Page) {
  await page.goto('/login');

  await expect(page.getByText(MOCK_VERSION_LABEL, { exact: true })).toBeVisible();
  await page.getByPlaceholder('请输入手机号').fill('13800138000');
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(page.getByText('Mock 验证码：246810', { exact: true })).toBeVisible();
  await page.getByPlaceholder('请输入验证码').fill('246810');
  await page.getByRole('button', { name: '登录', exact: true }).click();

  await expect(page).toHaveURL(/\/$/);
  const mockEnvironmentTag = page.locator('.app-mock-environment-tag');
  const fullMockEnvironmentLabel = mockEnvironmentTag.locator('.app-mock-environment-tag__full');
  const compactMockEnvironmentLabel = mockEnvironmentTag.locator('.app-mock-environment-tag__compact');
  const viewportWidth = page.viewportSize()?.width ?? Number.POSITIVE_INFINITY;

  await expect(fullMockEnvironmentLabel).toHaveText(MOCK_SHELL_LABEL);
  await expect(compactMockEnvironmentLabel).toHaveText('MOCK');
  if (viewportWidth <= 760) {
    await expect(mockEnvironmentTag).toBeHidden();
  } else {
    await expect(mockEnvironmentTag).toBeVisible();
    await expect(viewportWidth <= 1100 ? compactMockEnvironmentLabel : fullMockEnvironmentLabel).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: '经营工作台', exact: true, level: 1 })).toBeVisible();
}

async function navigateFromSidebar(page: Page, itemLabel: string, expectedPath: RegExp) {
  const navigation = page.getByRole('complementary', { name: '后台主导航' });
  const label = navigation.getByText(itemLabel, { exact: true });
  const menuItem = label.locator('xpath=ancestor::*[contains(@class, "t-menu__item")][1]');
  await menuItem.click();
  await expect(page).toHaveURL(expectedPath);
}

async function navigateOrderChild(page: Page, itemLabel: '购买合同订单', expectedPath: RegExp) {
  const navigation = page.getByRole('complementary', { name: '后台主导航' });
  const groupLabel = navigation.getByText('订单管理', { exact: true });
  const orderGroup = groupLabel.locator('xpath=ancestor::li[contains(@class, "t-submenu")][1]');
  if (!(await orderGroup.getAttribute('class'))?.split(/\s+/).includes('t-is-opened')) {
    await groupLabel.click();
    await expect(orderGroup).toHaveClass(/\bt-is-opened\b/);
  }
  const childLabel = navigation.getByText(itemLabel, { exact: true });
  await expect(childLabel).toBeVisible();
  await childLabel.click();
  await expect(page).toHaveURL(expectedPath);
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
}

test.beforeEach(async ({ page }) => {
  const requests: string[] = [];
  observedBusinessRequests.set(page, requests);

  page.on('request', (request) => {
    if (!BUSINESS_RESOURCE_TYPES.has(request.resourceType())) return;
    if (!/^https?:\/\//i.test(request.url())) return;
    const requestUrl = new URL(request.url());
    requests.push(`${request.method()} ${requestUrl.origin}${requestUrl.pathname}`);
  });

  await page.addInitScript(() => {
    const initializedKey = 'xingyu-e2e-storage-initialized';
    if (window.sessionStorage.getItem(initializedKey) === 'true') return;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(initializedKey, 'true');
  });
});

test.afterEach(({ page }) => {
  expect(
    observedBusinessRequests.get(page) ?? [],
    'Mock Demo 不应发出任何 http(s) XHR、fetch 或 EventSource 业务请求',
  ).toEqual([]);
});

test('手机号验证码 Mock 登录后持续显示 Mock 后台壳', async ({ page }) => {
  await loginAsMockAdmin(page);

  await expect(page.getByRole('complementary', { name: '后台主导航' })).toContainText('订单管理');
  await page.getByRole('complementary', { name: '后台主导航' }).getByText('订单管理', { exact: true }).click();
  await expect(page.getByRole('complementary', { name: '后台主导航' })).not.toContainText('租赁订单');
  await expect(page.getByRole('complementary', { name: '后台主导航' })).toContainText('购买合同订单');
  await expect(page.getByText(MOCK_VERSION_LABEL, { exact: true })).toBeVisible();
});

test('Mock 控制面按权限切换角色并保持登录审计可追溯', async ({ page }) => {
  await loginAsMockAdmin(page);

  await page.getByRole('button', { name: /账户菜单/ }).click();
  await page.getByText('Mock 场景控制', { exact: true }).click();
  const drawer = page.locator('.t-drawer').filter({ hasText: 'Mock 场景控制' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('正常经营场景');
  await expect(drawer).toContainText('写操作与结果未知不会自动重试');

  const identitySection = drawer.locator('.mock-control-section').filter({ hasText: '数据与身份' });
  await identitySection.locator('.t-select').nth(1).click();
  await page.getByText('运营人员 · 周运营', { exact: true }).last().click();
  await expect(page.getByRole('button', { name: /账户菜单：周运营/ })).toBeVisible();
  await expect(page.getByRole('complementary', { name: '后台主导航' })).not.toContainText('系统配置');

  await identitySection.locator('.t-select').nth(1).click();
  await page.getByText('财务人员 · 王财务', { exact: true }).last().click();
  await expect(page.getByRole('button', { name: /账户菜单：王财务/ })).toBeVisible();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: /账户菜单：王财务/ }).click();
  await expect(page.getByText('Mock 场景控制', { exact: true })).toHaveCount(0);
  await page.getByText('退出后台', { exact: true }).click();

  await loginAsMockAdmin(page);

  await page.goto('/settings/login-logs');
  await expect(page.getByRole('heading', { name: '登录日志', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '林运营' }).first()).toContainText('成功');
});

test('商家合作信息与财务未接入状态保持真实边界', async ({ page }) => {
  await loginAsMockAdmin(page);
  await navigateFromSidebar(page, '商家管理', /\/merchants$/);
  const merchantRow = page.getByRole('row').filter({ hasText: '星遇合作影像空间（演示）' });
  await merchantRow.getByRole('button', { name: '查看详情', exact: true }).click();
  await expect(page).toHaveURL(/\/merchants\/merchant_seed_001$/);
  await expect(page.getByRole('heading', { name: '星遇合作影像空间（演示）', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText('自然月；次月线下统计打款', { exact: true })).toBeVisible();
  await page.goto('/finance?merchant=merchant_seed_001&period=2026-09');
  await expect(page.getByRole('heading', { name: '财务与商家结算', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText('财务与结算数据尚未接入，当前没有可展示的收益、金额或结算批次。', { exact: true })).toBeVisible();
});

test('目标桌面视口不产生 document 级滚动条', async ({ page }) => {
  await page.goto('/login');
  const loginDimensions = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(loginDimensions.scrollHeight).toBe(loginDimensions.clientHeight);
  await expectNoDocumentHorizontalOverflow(page);

  await loginAsMockAdmin(page);
  await expectNoDocumentHorizontalOverflow(page);
});

test('系统配置使用六个独立二级路由', async ({ page }) => {
  await loginAsMockAdmin(page);
  const navigation = page.getByRole('complementary', { name: '后台主导航' });

  await navigation.getByText('系统配置', { exact: true }).click();
  for (const label of ['业务规则', '星钻与签到', '管理员管理', '角色管理', '登录日志', '操作日志']) {
    await expect(navigation).toContainText(label);
  }

  await navigation.getByText('业务规则', { exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/rules$/);
  await expect(page.getByRole('heading', { name: '规则配置', exact: true, level: 1 })).toBeVisible();

  await navigation.getByText('星钻与签到', { exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/loyalty$/);
  await expect(page.getByRole('heading', { name: '忠诚度配置', exact: true, level: 1 })).toBeVisible();

  await navigation.getByText('操作日志', { exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/operation-logs$/);
  await expect(page.getByRole('heading', { name: '操作日志', exact: true, level: 1 })).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
});

test('规则首屏只读回显并通过抽屉编辑租赁基础配置', async ({ page }) => {
  await loginAsMockAdmin(page);
  await page.goto('/settings/rules');

  await expect(page.getByRole('heading', { name: '规则配置', exact: true, level: 1 })).toBeVisible();
  await expect(page.locator('.rules-card input')).toHaveCount(0);

  const activeTabBox = await page.locator('.rules-tabs .t-tabs__nav-item.t-is-active').boundingBox();
  const activeIndicatorBox = await page.locator('.rules-tabs .t-tabs__bar:visible').boundingBox();
  const tabNavigationBox = await page.locator('.rules-tabs .t-tabs__nav-wrap').boundingBox();
  expect(activeTabBox, '规则选项卡需要存在可测量的当前项').not.toBeNull();
  expect(activeIndicatorBox, '规则选项卡需要存在可测量的选中指示线').not.toBeNull();
  expect(tabNavigationBox, '规则选项卡需要存在可测量的导航容器').not.toBeNull();
  if (activeTabBox !== null && activeIndicatorBox !== null && tabNavigationBox !== null) {
    const tabCenter = activeTabBox.x + activeTabBox.width / 2;
    const indicatorCenter = activeIndicatorBox.x + activeIndicatorBox.width / 2;
    expect(Math.abs(tabCenter - indicatorCenter), '选中指示线必须与当前选项卡水平居中').toBeLessThanOrEqual(1);
    expect(
      Math.abs(activeIndicatorBox.y + activeIndicatorBox.height - (tabNavigationBox.y + tabNavigationBox.height)),
      '选中指示线底边必须与选项卡导航底边对齐',
    ).toBeLessThanOrEqual(1);
  }

  await page.getByText('租赁基础配置', { exact: true }).click();
  const minimumPanel = page.locator('.rules-panel').filter({ hasText: '最短租期配置' });
  await expect(minimumPanel).toContainText('12 小时');
  await expect(minimumPanel).toContainText('3 天');
  await minimumPanel.getByRole('button', { name: '编辑规则', exact: true }).click();

  await expect(page.locator('.admin-form-drawer')).toBeVisible();
  await expect(page.getByRole('heading', { name: '编辑租赁基础配置', exact: true, level: 2 })).toBeVisible();
  await expect(page.getByText('用于新建资产时的运营参考；已存在资产的租赁条件与历史订单快照不会被全局规则覆盖。', { exact: true })).toBeVisible();
  const rulesDrawer = page.locator('.admin-form-drawer');
  await expect(rulesDrawer.locator('.t-form__item').filter({ hasText: '按小时最短租期' }).locator('input')).toHaveValue('12');
  await expect(rulesDrawer.locator('.t-form__item').filter({ hasText: '按天最短租期' }).locator('input')).toHaveValue('3');
});

test('管理员通过抽屉新增并在列表中脱敏回显', async ({ page }) => {
  await loginAsMockAdmin(page);
  await page.goto('/settings/admins');

  await expect(page.getByRole('heading', { name: '管理员管理', exact: true, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: '新增管理员', exact: true }).click();
  await expect(page.locator('.admin-form-drawer')).toBeVisible();
  await expect(page.getByRole('heading', { name: '新增管理员', exact: true, level: 2 })).toBeVisible();

  await page.getByPlaceholder('请输入姓名').fill('E2E 新管理员');
  await page.getByPlaceholder('例如：13800001008').fill('13900001008');
  const adminDrawer = page.locator('.admin-form-drawer');
  await expect(adminDrawer.getByText('管理员默认可以使用手机号登录；微信绑定状态由账号身份投影维护。', { exact: true })).toBeVisible();
  await expect(adminDrawer.locator('.t-form__item').filter({ hasText: '登录方式' })).toHaveCount(0);
  await adminDrawer.locator('.t-form__item').filter({ hasText: '初始状态' }).locator('.t-select-input input').click();
  await page.getByText('已锁定', { exact: true }).last().click();
  await page.getByRole('button', { name: '保存管理员', exact: true }).click();

  const adminRow = page.getByRole('row').filter({ hasText: 'E2E 新管理员' });
  await expect(adminRow).toBeVisible();
  await expect(adminRow).toContainText('139****1008');
  await expect(adminRow).toContainText('运营人员');
  await expect(adminRow).toContainText('未绑定微信');
  await expect(adminRow).toContainText('未绑定');
  await expect(adminRow).toContainText('已锁定');
});

test('忠诚度连续签到回显默认里程碑并允许临时新增自定义项', async ({ page }) => {
  await loginAsMockAdmin(page);
  await page.goto('/settings/loyalty');

  await expect(page.getByRole('heading', { name: '忠诚度配置', exact: true, level: 1 })).toBeVisible();
  await page.getByText('连续签到', { exact: true }).click();
  const streakPanel = page.locator('.loyalty-panel').filter({ hasText: '连续签到里程碑' });
  for (const days of [7, 15, 30, 90, 150, 365]) {
    await expect(streakPanel.getByText(`${days} 天`, { exact: true })).toBeVisible();
  }

  await streakPanel.getByRole('button', { name: '编辑配置', exact: true }).click();
  await expect(page.locator('.admin-form-drawer')).toBeVisible();
  await expect(page.getByRole('heading', { name: '编辑连续签到', exact: true, level: 2 })).toBeVisible();
  await expect(page.locator('.loyalty-editor-row--streak')).toHaveCount(6);
  await page.getByRole('button', { name: '新增里程碑', exact: true }).click();
  await expect(page.locator('.loyalty-editor-row--streak')).toHaveCount(7);
});

test('会员身份与支付分回显并进入非订单用户档案', async ({ page }) => {
  await loginAsMockAdmin(page);
  await navigateFromSidebar(page, '用户与会员', /\/membership$/);

  await expect(page.getByRole('heading', { name: '用户与会员', exact: true, level: 1 })).toBeVisible();
  const memberRow = page.getByRole('row').filter({ hasText: '星野旅人' });
  await expect(memberRow).toContainText('oXY***d001');
  await expect(memberRow).toContainText('已实名');
  await expect(memberRow).toContainText('668');
  await memberRow.getByRole('button', { name: '用户档案', exact: true }).click();

  await expect(page).toHaveURL(/\/membership\/user_seed_001$/);
  await expect(page.getByRole('heading', { name: '星野旅人 · 用户档案', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText('微信支付分原始分', { exact: true })).toBeVisible();
  await page.getByText('签到记录', { exact: true }).click();
  await expect(page.getByText('当前连续签到', { exact: true })).toBeVisible();
  await expect(page.getByText('下一里程碑', { exact: true })).toBeVisible();
  await page.getByText('星钻流水', { exact: true }).click();
});

test('标准商品与官方、C2C 唯一资产保持清晰分工', async ({ page }) => {
  await loginAsMockAdmin(page);
  await navigateFromSidebar(page, '商品管理', /\/catalog$/);

  await expect(page.getByRole('heading', { name: '商品管理', exact: true, level: 1 })).toBeVisible();
  const cameraProduct = page.getByRole('row').filter({ hasText: 'Sony Alpha 7 IV 全画幅微单' });
  await expect(cameraProduct).toContainText('Sony Alpha 7 IV');
  await expect(cameraProduct).toContainText('相机');
  await expect(cameraProduct).not.toContainText('租金');
  await expect(cameraProduct).not.toContainText('押金');
  await expect(cameraProduct.getByRole('img', { name: /标准封面/ })).toBeVisible();

  await page.getByRole('button', { name: '新增标准商品', exact: true }).click();
  const productDrawer = page.locator('.admin-form-drawer');
  await expect(productDrawer.getByRole('heading', { name: '新增标准商品', exact: true, level: 2 })).toBeVisible();
  await expect(productDrawer.getByText('品牌 ID', { exact: true })).toHaveCount(0);
  await expect(productDrawer.getByText(/素材 ID/)).toHaveCount(0);
  await expect(productDrawer.getByRole('button', { name: '上传商品图片文件选择', exact: true })).toBeVisible();
  await expect(productDrawer.getByRole('button', { name: '上传商品视频文件选择', exact: true })).toBeVisible();
  await expect(productDrawer.locator('.t-form__label--required')).toHaveCount(5);
  await productDrawer.getByRole('button', { name: '关闭', exact: true }).click();

  await page.getByRole('tab', { name: '型号补充申请 1', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Fujifilm X-T5 微单机身' })).toContainText('待处理');

  await page.goto('/assets');
  await expect(page.getByRole('tab', { name: '全部', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '官方资产', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新增官方资产', exact: true }).click();
  const assetDrawer = page.locator('.admin-form-drawer');
  await expect(assetDrawer.getByRole('heading', { name: '新增官方资产', exact: true, level: 2 })).toBeVisible();
  await expect(assetDrawer.getByRole('button', { name: '上传设备图片文件选择', exact: true })).toBeVisible();
  await expect(assetDrawer.getByRole('button', { name: '上传设备视频文件选择', exact: true })).toBeVisible();
  await expect(assetDrawer.getByText('日租金', { exact: true })).toBeVisible();
  await expect(assetDrawer.getByText('星钻最高抵扣比例', { exact: true })).toBeVisible();
  await expect(assetDrawer.getByText(/素材 ID/)).toHaveCount(0);
  await assetDrawer.getByRole('button', { name: '关闭', exact: true }).click();

  await page.getByRole('tab', { name: '用户发布', exact: true }).click();
  const c2cRow = page.getByRole('row').filter({ hasText: 'XY-C2C-000001' });
  await expect(c2cRow.getByRole('img', { name: /设备图片/ })).toBeVisible();
  await expect(c2cRow).toContainText('星野旅人');
  await expect(c2cRow).toContainText('深圳市宝安区');
  await expect(c2cRow).toContainText('已通过');
  await expect(c2cRow.getByRole('cell').nth(4)).toHaveText('—');

  await page.getByRole('tab', { name: '官方资产', exact: true }).click();
  const assetRow = page.getByRole('row').filter({ hasText: 'XY-A-000001' });
  await expect(assetRow.getByRole('img', { name: /设备图片/ })).toBeVisible();
  await expect(assetRow).toContainText('星遇直营');
  await expect(assetRow).toContainText('1 号格口');
  await expect(assetRow.getByText('在柜', { exact: true })).toBeVisible();
  await assetRow.getByRole('button', { name: '查看详情', exact: true }).click();

  await expect(page).toHaveURL(/\/assets\/asset_seed_001$/);
  await expect(page.getByRole('heading', { name: 'Sony Alpha 7 IV 全画幅微单 标准机身套装', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('img', { name: /封面|实拍图/ }).first()).toBeVisible();
  await expect(page.getByText('在柜', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('设备唯一标识', { exact: true })).toBeVisible();
  await expect(page.getByText('当前租赁条件', { exact: true })).toBeVisible();
  await expect(page.getByText('商品价值', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '租赁条件版本 1', exact: true }).click();
  await expect(page.getByText('租赁条件变更记录', { exact: true })).toBeVisible();
});

test('商品与订单列表复用同一筛选面板和列表卡规范', async ({ page }) => {
  await loginAsMockAdmin(page);

  const readListContract = async () => page.locator('.admin-list-stack').first().evaluate((stack) => {
    const filterSurface = stack.querySelector<HTMLElement>('.admin-list-panel__filter-surface');
    const filterBar = stack.querySelector<HTMLElement>('.list-filter-bar');
    const listCard = stack.querySelector<HTMLElement>('.admin-list-panel');
    const title = stack.querySelector<HTMLElement>('.admin-list-panel__title-row h2');
    if (!filterSurface || !filterBar || !listCard || !title) throw new Error('标准列表结构缺失');
    const filterRect = filterSurface.getBoundingClientRect();
    const cardRect = listCard.getBoundingClientRect();
    return {
      titleWeight: getComputedStyle(title).fontWeight,
      filterBackground: getComputedStyle(filterSurface).backgroundColor,
      innerFilterBackground: getComputedStyle(filterBar).backgroundColor,
      innerFilterBorderTopWidth: getComputedStyle(filterBar).borderTopWidth,
      sectionGap: Math.round(cardRect.top - filterRect.bottom),
      filterInsideCard: listCard.contains(filterBar),
    };
  });

  await page.goto('/catalog');
  const catalogContract = await readListContract();
  await page.goto('/orders');
  const orderContract = await readListContract();

  expect(catalogContract).toEqual(orderContract);
  expect(orderContract).toMatchObject({
    titleWeight: '700',
    filterBackground: 'rgb(255, 255, 255)',
    innerFilterBackground: 'rgba(0, 0, 0, 0)',
    innerFilterBorderTopWidth: '0px',
    sectionGap: 16,
    filterInsideCard: false,
  });
});

test('租赁柜页在 Mock 模式下拒绝演示柜机和模拟开格', async ({ page }) => {
  await loginAsMockAdmin(page);
  await navigateFromSidebar(page, '租赁柜管理', /\/cabinets$/);

  await expect(page.getByText('请登录具有租赁柜读取权限的后台账户；不使用演示身份或数据。', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '租赁柜管理', exact: true, level: 1 })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /模拟打开格口|推进开格命令|管理员全开/ })).toHaveCount(0);
});

test('电子合同服务购买订单仅提供查看、Mock 查单与追溯', async ({ page }) => {
  await loginAsMockAdmin(page);
  await navigateOrderChild(page, '购买合同订单', /\/orders\/contract-purchases$/);

  await expect(page.getByRole('heading', { name: '电子合同服务购买订单', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText(/不提供代购、代付、发起退款或手工调整权益/)).toBeVisible();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(9);
  for (const label of ['全部', '待支付', '支付确认中', '权益待到账', '已完成', '退款中', '已退款', '已关闭', '异常']) {
    await expect(tabs.filter({ hasText: label })).toHaveCount(1);
  }
  await expect(page.getByPlaceholder('订单号、支付/退款流水号')).toBeVisible();
  await expect(page.getByRole('button', { name: '代付', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '发起退款', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /账户菜单/ }).click();
  await page.getByText('Mock 场景控制', { exact: true }).click();
  const mockDrawer = page.locator('.t-drawer').filter({ hasText: 'Mock 场景控制' });
  const identitySection = mockDrawer.locator('.mock-control-section').filter({ hasText: '数据与身份' });
  await identitySection.locator('.t-select').nth(1).click();
  await page.getByText('运营人员 · 周运营', { exact: true }).last().click();
  await expect(page.getByRole('button', { name: /账户菜单：周运营/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '查询原支付单', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '查询原退款单', exact: true })).toHaveCount(0);
  await identitySection.locator('.t-select').nth(1).click();
  await page.getByText('财务人员 · 王财务', { exact: true }).last().click();
  await expect(page.getByRole('button', { name: /账户菜单：王财务/ })).toBeVisible();
  await expect(mockDrawer).toBeHidden();
  await page.getByRole('button', { name: /账户菜单：王财务/ }).click();
  await expect(page.getByText('Mock 场景控制', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const queryPayment = page.getByRole('button', { name: '查询原支付单', exact: true }).first();
  await expect(queryPayment).toBeVisible();
  await queryPayment.click();
  await expect(page.getByText(/Mock 查单/)).toBeVisible();

  await tabs.filter({ hasText: '已完成' }).click();
  await expect(page).toHaveURL(/status=COMPLETED/);
  const completedOrder = page.locator('tbody tr').first();
  await completedOrder.getByRole('button', { name: '查看', exact: true }).click();
  const detail = page.locator('.contract-purchase-detail');
  await expect(detail).toContainText('微信支付事实（Mock）');
  await expect(detail).toContainText('不可变服务次数账本');
  await expect(detail).toContainText('审计时间线');
});
