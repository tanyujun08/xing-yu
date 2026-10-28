import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoginLogsSettingsPage, OperationLogsSettingsPage } from './IntegratedAuditSettingsPage';
const fixture = vi.hoisted(() => ({ listLoginEvents: vi.fn(), listOperationEvents: vi.fn(), permissions: ['ops.audit.read'] }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ iam: fixture }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'admin', permissions: fixture.permissions }) }));
afterEach(cleanup);
beforeEach(() => { fixture.permissions = ['ops.audit.read']; fixture.listOperationEvents.mockReset(); fixture.listLoginEvents.mockReset(); fixture.listLoginEvents.mockResolvedValue({ items: [{ event_id: 'event-1', account_id: 'operator', current_display_name: '张管理员', current_roles: ['ops.operations'], login_method: 'QR_CHALLENGE', provider_code: 'WECHAT_MINI', result_code: 'SUCCESS', occurred_at: '2026-09-20T12:00:00Z' }], page: { has_more: true, next_cursor: 'next-1', page_size: 20 } }); });
it('uses server filters, resets the signed cursor and labels current identity separately', async () => {
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoginLogsSettingsPage /></QueryClientProvider></MemoryRouter>);
  expect(await screen.findByText('张管理员')).toBeInTheDocument();
  expect(screen.getByText('管理员（当前名称）')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  await waitFor(() => expect(fixture.listLoginEvents.mock.calls.at(-1)?.[0]).toBe('next-1'));
  fireEvent.change(screen.getByPlaceholderText('管理员、账号或来源'), { target: { value: '张管' } });
  fireEvent.click(screen.getByRole('button', { name: '查询' }));
  await waitFor(() => expect(fixture.listLoginEvents.mock.calls.at(-1)?.[2]).toEqual({ audience: 'OPS', keyword: '张管', page_size: 20 }));
  expect(fixture.listLoginEvents.mock.calls.at(-1)?.[0]).toBe('');
});

it('pages operation events using the server cursor and submitted object filter', async () => {
 fixture.listOperationEvents.mockResolvedValueOnce({items:[{event_id:'operation-1',actor_account_id:'operator',action_code:'UPDATE',operation_id:'updateOpsAdmin',result_code:'SUCCESS',field_change_summary:{},occurred_at:'2026-09-20T12:00:00Z'}],page:{has_more:true,next_cursor:'op-next',page_size:20}}).mockResolvedValue({items:[],page:{has_more:false,page_size:20}});
 render(<MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><OperationLogsSettingsPage /></QueryClientProvider></MemoryRouter>);
 await screen.findByText('updateOpsAdmin');
 fireEvent.click(screen.getByRole('button',{name:'下一页'}));
 await waitFor(()=>expect(fixture.listOperationEvents.mock.calls.at(-1)?.[0]).toBe('op-next'));
 await waitFor(()=>expect(screen.getByRole('button',{name:'下一页'})).toBeDisabled());
 fireEvent.change(screen.getByPlaceholderText('类型或编号'),{target:{value:'OPS_ACCOUNT'}});
 fireEvent.click(screen.getByRole('button',{name:'查询'}));
 await waitFor(()=>expect(fixture.listOperationEvents.mock.calls.at(-1)?.[2]).toEqual({page_size:20,object_keyword:'OPS_ACCOUNT'}));
 expect(fixture.listOperationEvents.mock.calls.at(-1)?.[0]).toBe('');
});

it('does not read audit data without permission and retains the page identity', () => {
 fixture.permissions=[];
 render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><LoginLogsSettingsPage /></QueryClientProvider></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'登录日志'})).toBeInTheDocument();
 expect(screen.getByText('当前账号没有审计读取权限')).toBeInTheDocument();
 expect(fixture.listLoginEvents).not.toHaveBeenCalled();
});

it('classifies only complete lottery operation facts as completed and preserves other result labels', async () => {
  const base = { actor_account_id: 'operator', resource_type: 'AUDIT_CLASSIFICATION_FIXTURE', field_change_summary: {}, occurred_at: '2026-09-20T12:00:00Z' };
  const cases = [
    { event_id: 'draw-win', operation_id: 'loyalty.lottery.draw', action_code: 'EXECUTE', http_status: 201, result_code: 'WIN', label: '完成（中奖）', theme: 'success' },
    { event_id: 'draw-no-win', operation_id: 'loyalty.lottery.draw', action_code: 'EXECUTE', http_status: 201, result_code: 'NO_WIN', label: '完成（未中奖）', theme: 'success' },
    { event_id: 'redeem-success', operation_id: 'loyalty.coupon.redeem', action_code: 'EXECUTE', http_status: 201, result_code: 'SUCCESS', label: '成功', theme: 'success' },
    { event_id: 'draw-rejected', operation_id: 'loyalty.lottery.draw', action_code: 'EXECUTE', http_status: 200, result_code: 'REJECTED', label: '失败', theme: 'danger' },
    { event_id: 'wrong-operation', operation_id: 'otherOperation', action_code: 'EXECUTE', http_status: 201, result_code: 'WIN', label: '失败', theme: 'danger' },
    { event_id: 'wrong-action', operation_id: 'loyalty.lottery.draw', action_code: 'READ', http_status: 201, result_code: 'NO_WIN', label: '失败', theme: 'danger' },
    { event_id: 'wrong-status', operation_id: 'loyalty.lottery.draw', action_code: 'EXECUTE', http_status: 200, result_code: 'WIN', label: '失败', theme: 'danger' },
    { event_id: 'unknown-result', operation_id: 'loyalty.lottery.draw', action_code: 'EXECUTE', http_status: 201, result_code: 'FUTURE_RESULT', label: '失败', theme: 'danger' },
    { event_id: 'missing-status', operation_id: 'loyalty.lottery.draw', action_code: 'EXECUTE', result_code: 'NO_WIN', label: '失败', theme: 'danger' },
    { event_id: 'string-status', operation_id: 'loyalty.lottery.draw', action_code: 'EXECUTE', http_status: '201', result_code: 'WIN', label: '失败', theme: 'danger' },
    { event_id: 'redeemed-code', operation_id: 'loyalty.coupon.redeem', action_code: 'EXECUTE', http_status: 201, result_code: 'REDEEMED', label: '失败', theme: 'danger' },
  ];
  fixture.listOperationEvents.mockResolvedValue({ items: cases.map((item) => ({ ...base, event_id: item.event_id, operation_id: item.operation_id, action_code: item.action_code, ...(item.http_status === undefined ? {} : { http_status: item.http_status }), result_code: item.result_code })), page: { has_more: false, page_size: 20 } });
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OperationLogsSettingsPage /></QueryClientProvider></MemoryRouter>);
  await screen.findByText('完成（中奖）');
  for (const item of cases) {
    const row = screen.getByText(item.event_id).closest('tr');
    if (row === null) throw new Error('Audit fixture row is missing');
    expect(within(row).getByText(item.label).closest('.t-tag')).toHaveClass('t-tag--' + item.theme);
  }
});

it('keeps every non-SUCCESS login result classified as failure', async () => {
  const results = ['WIN', 'NO_WIN', 'REDEEMED', 'DENIED'];
  fixture.listLoginEvents.mockResolvedValue({ items: results.map((result) => ({ event_id: 'login-' + result, account_id: 'operator', current_display_name: 'login-' + result, current_roles: [], login_method: 'SMS_OTP', provider_code: 'ALIYUN_SMS', result_code: result, occurred_at: '2026-09-20T12:00:00Z' })), page: { has_more: false, page_size: 20 } });
  render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><LoginLogsSettingsPage /></QueryClientProvider></MemoryRouter>);
  await screen.findByText('login-WIN');
  for (const result of results) {
    const row = screen.getByText('login-' + result).closest('tr');
    if (row === null) throw new Error('Login fixture row is missing');
    expect(within(row).getByText('失败').closest('.t-tag')).toHaveClass('t-tag--danger');
  }
});
