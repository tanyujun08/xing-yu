import { expect, type Page } from '@playwright/test';

export async function systemInteractions(page: Page, origin: string) {
  let stage = 'RULE_DEFAULTS';
  const form = () => page.locator('form:visible');
  const save = async (key: string) => {
    const reason = '隔离系统配置验收 ' + key;
    await form().getByLabel('变更原因', { exact: true }).filter({ visible: true }).fill(reason);
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/v1/ops/system-config/business-publications' && r.request().method() === 'POST');
    await form().getByRole('button', { name: '保存并立即生效', exact: true }).click();
    const result = await response;
    if (result.status() !== 201) throw new Error('W6_STAGE_' + stage + '_' + result.status());
    const version = await result.json() as { config_key: string; status: string; publication_mode: string };
    expect(version.config_key).toBe(key); expect(version.status).toBe('PUBLISHED'); expect(version.publication_mode).toBe('DIRECT');
    await expect(form().getByLabel('变更原因', { exact: true }).filter({ visible: true })).toHaveValue('');
    await form().getByRole('button', { name: '版本记录', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: reason }).first()).toBeVisible();
  };
  try {
    await page.goto(origin + '/settings/rules');
    await form().getByLabel('原始支付分阈值').filter({ visible: true }).fill('650');
    await save('rental.creation_defaults');
    await page.getByRole('tab', { name: '租赁基础配置', exact: true }).click();
    await form().getByLabel('按小时最短租期（小时）').filter({ visible: true }).fill('24');
    await form().getByLabel('按天最短租期（天）').filter({ visible: true }).fill('5');
    await save('rental.creation_defaults');
    await page.reload();
    await expect(form().getByLabel('原始支付分阈值').filter({ visible: true })).toHaveValue('650');
    await page.getByRole('tab', { name: '租赁基础配置', exact: true }).click();
    await expect(form().getByLabel('按小时最短租期（小时）').filter({ visible: true })).toHaveValue('24');
    await expect(form().getByLabel('按天最短租期（天）').filter({ visible: true })).toHaveValue('5');
    for (const [tab, code] of [['合同价格', 'contract'], ['发布额度价格', 'quota'], ['组合套餐', 'package']]) {
      stage = 'CATALOG_' + code!.toUpperCase();
      await page.getByRole('tab', { name: tab!, exact: true }).click();
      await form().getByRole('button', { name: code === 'package' ? '新增套餐' : '新增商品', exact: true }).click();
      await form().getByLabel('商品名称', { exact: true }).filter({ visible: true }).fill('合成' + tab);
      await form().getByLabel('商品编号', { exact: true }).filter({ visible: true }).fill('browser-' + code);
      await form().getByLabel('人民币价格（元）', { exact: true }).filter({ visible: true }).fill('1.25');
      await form().getByLabel('粉钻价格（整数）', { exact: true }).filter({ visible: true }).fill('7');
      await save('entitlement.catalog');
      await expect(form().getByLabel('人民币价格（元）', { exact: true }).filter({ visible: true })).toHaveValue('1.25');
      await expect(form().getByLabel('粉钻价格（整数）', { exact: true }).filter({ visible: true })).toHaveValue('7');
    }
    stage = 'SECURITY_APPROVAL';
    await page.getByRole('tab', { name: '安全配置审批', exact: true }).click();
    await expect(page.getByRole('button', { name: '创建配置草案', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存并立即生效', exact: true }).filter({ visible: true })).toHaveCount(0);
    stage = 'LOYALTY_LEVELS';
    await page.goto(origin + '/settings/loyalty');
    await page.getByRole('tab', { name: '等级成长', exact: true }).click();
    await form().getByRole('button', { name: '添加等级', exact: true }).click();
    await form().getByLabel('等级名称', { exact: true }).filter({ visible: true }).fill('初始等级');
    await save('membership.levels');
    stage = 'LOYALTY_DAILY';
    await page.getByRole('tab', { name: '每日签到', exact: true }).click();
    await form().getByRole('button', { name: '添加粉钻', exact: true }).first().click();
    await form().getByLabel('粉钻（整数）', { exact: true }).filter({ visible: true }).fill('2');
    await form().getByRole('button', { name: '添加星光', exact: true }).last().click();
    await form().getByLabel('星光', { exact: true }).filter({ visible: true }).fill('1.5');
    await save('benefits.check_in');
    stage = 'LOYALTY_STREAK';
    await page.getByRole('tab', { name: '连续签到', exact: true }).click();
    await form().getByRole('button', { name: '添加里程碑', exact: true }).click();
    await form().getByLabel('连续签到天数', { exact: true }).filter({ visible: true }).fill('7');
    await form().getByRole('button', { name: '添加粉钻', exact: true }).click();
    await form().getByLabel('粉钻（整数）', { exact: true }).filter({ visible: true }).fill('5');
    await save('benefits.check_in');
    await page.reload();
    await page.getByRole('tab', { name: '每日签到', exact: true }).click();
    await expect(form().getByLabel('粉钻（整数）', { exact: true }).filter({ visible: true })).toHaveValue('2');
    await expect(form().getByLabel('星光', { exact: true }).filter({ visible: true })).toHaveValue('1.5');
    await page.getByRole('tab', { name: '连续签到', exact: true }).click();
    await expect(form().getByLabel('连续签到天数', { exact: true }).filter({ visible: true })).toHaveValue('7');
    stage = 'ROLES_OPEN';
    await page.goto(origin + '/settings/roles');
    for (const code of ['ops.super_admin', 'ops.operations', 'ops.after_sales', 'ops.finance']) await expect(page.getByRole('row').filter({ has: page.getByText(code, { exact: true }) })).toHaveCount(1);
    const role = page.getByRole('row').filter({ hasText: 'ops.operations' });
    await role.getByRole('button', { name: '配置权限', exact: true }).click();
    const drawer = page.getByRole('dialog');
    stage = 'ROLES_SELECT';
    const choice = drawer.locator('label.t-checkbox:not(.t-is-disabled)').filter({ has: page.locator('input:not(:checked)') }).first();
    const chosenPermission = await choice.locator('input').getAttribute('value');
    await choice.click();
    stage = 'ROLES_SELECTED';
    await expect(drawer.locator('input[value=' + JSON.stringify(chosenPermission) + ']')).toBeChecked();
    stage = 'ROLES_REASON';
    await drawer.getByLabel('修改原因', { exact: true }).fill('隔离角色权限验收');
    stage = 'ROLES_SAVE';
    const permission = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/permissions') && r.request().method() === 'PUT');
    await drawer.getByRole('button', { name: '保存权限', exact: true }).click();
    expect((await permission).status()).toBe(200);
    await expect(drawer).toHaveCount(0);
    const field = (label: string) => drawer.locator('.t-form__item').filter({ has: page.locator('label').filter({ hasText: new RegExp('^' + label + '$') }) });
    stage = 'ADMIN_CREATE';
    await page.goto(origin + '/settings/admins');
    await page.getByRole('button', { name: '新增管理员', exact: true }).click();
    await field('姓名').getByRole('textbox').fill('合成验收管理员');
    await field('手机号').getByRole('textbox').fill('10000000003');
    await field('角色').locator('input').click();
    await page.getByText('运营', { exact: true }).last().click();
    await field('修改原因').getByRole('textbox').fill('隔离管理员创建验收');
    const created = page.waitForResponse(r => new URL(r.url()).pathname === '/v1/ops/iam/accounts' && r.request().method() === 'POST');
    await drawer.getByRole('button', { name: '保存管理员', exact: true }).click();
    expect((await created).status()).toBe(201);
    await expect(drawer).toHaveCount(0);
    const account = page.getByRole('row').filter({ hasText: '合成验收管理员' });
    stage = 'ADMIN_EDIT';
    await account.getByRole('button', { name: '编辑', exact: true }).click();
    await field('姓名').getByRole('textbox').fill('合成验收管理员已修改');
    await field('修改原因').getByRole('textbox').fill('隔离管理员编辑验收');
    const edited = page.waitForResponse(r => /\/v1\/ops\/iam\/accounts\/[^/]+$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH');
    await drawer.getByRole('button', { name: '保存管理员', exact: true }).click();
    expect((await edited).status()).toBe(200);
    await expect(drawer).toHaveCount(0);
    for (const [label, action, status] of [['禁用', 'deactivate', '已禁用'], ['启用', 'reactivate', '正常'], ['删除', 'archive', '']]) {
      stage = 'ADMIN_' + action!.toUpperCase();
      await account.getByRole('button', { name: label!, exact: true }).click();
      const changed = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/' + action) && r.request().method() === 'POST');
      await page.getByRole('button', { name: '确认操作', exact: true }).click();
      expect((await changed).status()).toBe(200);
      if (status) await expect(account.getByText(status, { exact: true })).toBeVisible();
      else await expect(account).toHaveCount(0);
    }
    for (const kind of ['login', 'operation']) {
      stage = 'AUDIT_' + kind.toUpperCase();
      await page.goto(origin + '/settings/' + kind + '-logs');
      await page.getByPlaceholder(kind === 'login' ? '管理员、账号或来源' : '管理员姓名或账号').fill('debug-ops-author');
      const filtered = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/' + kind + '-events') && new URL(r.url()).searchParams.get('keyword') === 'debug-ops-author');
      await page.getByRole('button', { name: '查询', exact: true }).click();
      expect((await filtered).status()).toBe(200);
      await page.getByRole('button', { name: '重置', exact: true }).click();
      await page.getByRole('button', { name: '刷新记录', exact: true }).click();
      await expect(page.getByRole('button', { name: '上一页', exact: true })).toBeDisabled();
      if (kind === 'operation') {
        stage = 'AUDIT_PAGINATION';
        await page.getByLabel('每页条数', { exact: true }).click();
        await page.getByText('5', { exact: true }).filter({ visible: true }).click();
        const firstPage = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/operation-events') && new URL(r.url()).searchParams.get('page_size') === '5' && !new URL(r.url()).searchParams.get('cursor'));
        await page.getByRole('button', { name: '查询', exact: true }).click();
        expect((await firstPage).status()).toBe(200);
        const nextPage = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/operation-events') && Boolean(new URL(r.url()).searchParams.get('cursor')));
        await page.getByRole('button', { name: '下一页', exact: true }).click();
        expect((await nextPage).status()).toBe(200);
        await page.getByRole('button', { name: '上一页', exact: true }).click();
        await expect(page.getByRole('button', { name: '上一页', exact: true })).toBeDisabled();
      }
    }
  } catch (error) {
    if (error instanceof Error && /^W6_STAGE_[A-Z_]+(?:_\d{3})?$/.test(error.message)) throw error;
    throw sanitizedFailure(stage);
  }
}

// Do not retain causes: browser errors may include authentication material.
function sanitizedFailure(stage: string) { return new Error('W6_STAGE_' + stage); }
