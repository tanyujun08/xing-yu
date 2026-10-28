import { returnEvidenceFixture } from './returnEvidenceFixture';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiProblem } from '../../shared/services/testing/problemFixture';
import type { RentalOrder, RentalReturn, Versioned } from '../../shared/services/rentalOrders';
import { RentalReviewPanel } from './RentalReviewPanel';

const fixture = vi.hoisted(() => ({
  session: { accountId: 'admin', permissions: ['ops.orders.read', 'ops.returns.receive', 'ops.returns.review'] },
  gateway: { returns: vi.fn(), reviews: vi.fn(), receipt: vi.fn(), correctReceipt: vi.fn(), returnDraft: vi.fn(), preview: vi.fn(), review: vi.fn() },
  materials: { uploadFile: vi.fn(), get: vi.fn() },
}));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: fixture.gateway, materials: fixture.materials }) }));
vi.mock('../../shared/services/useAdminServices', () => ({ useAdminServices: () => ({ materials: fixture.materials }) }));
vi.mock('../../shared/access/session', () => ({ useSession: () => fixture.session }));
vi.mock('../../shared/config/env', () => ({ apiIntegrationEnabled: true, publicEnv: { materialPublicOrigin: 'https://media.example.test' } }));
// The library dropdown is not the subject: preserve the real form and consumer.
vi.mock('tdesign-react', async (importOriginal) => ({ ...await importOriginal<typeof import('tdesign-react')>(), Select: ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) => <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));

const clock = { serverMillis: Date.parse('2026-10-06T08:00:00Z'), observedMonotonicMillis: 100 };
const ready = { material_id: 'loss-original', upload_id: 'upload-original', status: 'READY', public_url: 'https://media.example.test/loss.png', playback_url: null, mime_type: 'image/png', size_bytes: 3, metadata: { schema_version: 1, width: 2, height: 2, duration_ms: null, video_codec: null, audio_codec: null }, poster: null };
let sequence = 0;
let order: Versioned<RentalOrder>;
let returned: Versioned<RentalReturn>;
const clients: QueryClient[] = [];

it.each(['核定超期费（元）', '核定金额（元）'])('normalizes only the trailing decimal draft for %s on blur', async (label) => {
  mount(); await finalReady();
  if (label === '核定金额（元）') { fireEvent.click(screen.getByRole('button', { name: '添加损失项' })); change('损失说明', '原损失说明'); }
  const field = screen.getByLabelText(label);
  expect(field).toHaveAttribute('aria-invalid', 'false');
  change(label, '1.'); expect(field).toHaveValue('1.'); expect(field).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled();
  fireEvent.blur(field); expect(field).toHaveValue('1.00'); expect(field).toHaveAttribute('aria-invalid', 'false');
  change(label, '1.001'); fireEvent.blur(field); expect(field).toHaveValue('1.001'); expect(field).toHaveAttribute('aria-invalid', 'true');
  expect(fixture.gateway.review).not.toHaveBeenCalled();
});

it('shows no untouched empty final loss error but explains it after blur without treating it as zero', async () => {
  mount(); await finalReady(); fireEvent.click(screen.getByRole('button', { name: '添加损失项' })); change('损失说明', '待核定损失');
  const field = screen.getByLabelText('核定金额（元）');
  expect(field).toHaveValue(''); expect(field).toHaveAttribute('aria-invalid', 'false'); expect(field).not.toHaveAttribute('aria-describedby');
  expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled();
  fireEvent.blur(field); expect(field).toHaveAccessibleDescription('最终核定必须填写金额，可填 0。');
  expect(field).toHaveValue(''); expect(fixture.gateway.review).not.toHaveBeenCalled();
});

it('requires a reason only for a known overtime adjustment and excludes the retained reason when the values match again', async () => {
  mount(); await finalReady();
  expect(screen.queryByLabelText('超期调整原因（与系统金额不同时必填）')).not.toBeInTheDocument();
  change('核定超期费（元）', '61.00'); expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled();
  expect(screen.getByText('核定超期费与系统金额不同，请填写调整原因后继续。')).toBeInTheDocument();
  change('超期调整原因（与系统金额不同时必填）', '   '); expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled();
  change('超期调整原因（与系统金额不同时必填）', '现场核实修正'); await previewAndConfirm();
  expect(fixture.gateway.preview).toHaveBeenLastCalledWith('order', expect.objectContaining({ overtime_assessed_fen: '6100', adjustment_reason: '现场核实修正' }), order.etag);
  change('核定超期费（元）', '60.00'); expect(screen.queryByLabelText('超期调整原因（与系统金额不同时必填）')).not.toBeInTheDocument();
  await previewAndConfirm(); fireEvent.click(screen.getByRole('button', { name: '确认最终核定' }));
  await waitFor(() => expect(fixture.gateway.review).toHaveBeenCalledOnce());
  expect(fixture.gateway.review.mock.calls[0]![1].adjustment_reason).toBeNull();
  change('核定超期费（元）', '61.00'); expect(screen.getByLabelText('超期调整原因（与系统金额不同时必填）')).toHaveValue('现场核实修正');
});

it('associates a declared 422 reason error with the original field, restores focus and retains the draft', async () => {
  mount(); await finalReady(); change('核定超期费（元）', '61'); change('超期调整原因（与系统金额不同时必填）', '保留本次说明');
  fixture.gateway.preview.mockRejectedValueOnce(new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '需要核对调整说明', request_id: 'reason-error', details: { errors: [{ field: 'adjustment_reason', reason: '说明需写明调整依据', rule: 'INVALID' }] } }));
  fireEvent.click(screen.getByRole('button', { name: '预览最终费用' }));
  const field = screen.getByLabelText('超期调整原因（与系统金额不同时必填）');
  await waitFor(() => expect(field).toHaveAccessibleDescription('说明需写明调整依据'));
  expect(field).toHaveValue('保留本次说明'); expect(field).toHaveAttribute('aria-invalid', 'true');
  await waitFor(() => expect(field).toHaveFocus()); expect(screen.getByLabelText('核定超期费（元）')).toHaveValue('61');
  expect(fixture.gateway.review).not.toHaveBeenCalled();
});

it('shows a contract loss-items group error without guessing an array index, and keeps unknown fields at form level', async () => {
  mount(); await finalReady(); fireEvent.click(screen.getByRole('button', { name: '添加损失项' })); change('损失说明', '第一项原说明'); change('核定金额（元）', '0');
  fixture.gateway.preview.mockRejectedValueOnce(new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '损失材料待核对', request_id: 'loss-error', details: { errors: [{ field: 'loss_items', reason: '请核对本单损失项材料', rule: 'INVALID' }] } }));
  fireEvent.click(screen.getByRole('button', { name: '预览最终费用' }));
  const group = await screen.findByRole('alert', { name: '损失项校验错误' }); expect(group).toHaveTextContent('请核对本单损失项材料'); await waitFor(() => expect(group).toHaveFocus());
  expect(screen.getByLabelText('损失说明')).toHaveValue('第一项原说明'); expect(screen.getByLabelText('核定金额（元）')).toHaveValue('0');
  fixture.gateway.preview.mockRejectedValueOnce(new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '原请求存在未知字段错误', request_id: 'unknown-field', details: { errors: [{ field: 'unrecognized_field', reason: '无法定位的字段', rule: 'INVALID' }] } }));
  fireEvent.click(screen.getByRole('button', { name: '预览最终费用' })); await screen.findByText('原请求存在未知字段错误');
  expect(screen.queryByText('无法定位的字段')).not.toBeInTheDocument(); expect(screen.getByLabelText('损失说明')).toHaveValue('第一项原说明'); expect(fixture.gateway.review).not.toHaveBeenCalled();
});
const action = (action_code: string, allowed = true) => ({ action_code, allowed, reason_code: null, display_reason: null, target: null, required_version: null });
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(performance, 'now').mockReturnValue(100);
  fixture.session = { accountId: `admin-${++sequence}`, permissions: ['ops.orders.read', 'ops.returns.receive', 'ops.returns.review'] };
  order = { etag: '"ORDER:b3JkZXI:3"', serverClock: clock, data: { order: { order_id: 'order', stage: 'ACTIVE', version: '3', allowed_actions: ['START_RETURN', 'PREVIEW_REVIEW', 'SUBMIT_REVIEW'].map((code) => action(code)) }, return_id: 'return', bill: { finalized: false, deposit_received_fen: '50000' }, delivery: { method: 'EXPRESS', delivered_at: '2026-10-05T00:00:00Z' } } as unknown as RentalOrder };
  returned = { etag: '"RETURN:cmV0dXJu:2"', serverClock: clock, data: { return_id: 'return', order_id: 'order', method: 'EXPRESS', version: '2', received_at: '2026-10-06T00:00:00Z', receipt_source: 'OFFICIAL', receipt_actor_id: 'disabled-admin', receipt_actor_display_name: null, receipt_history: [], ...returnEvidenceFixture(), blockers: [], allowed_actions: ['CONFIRM_RECEIPT', 'CORRECT_RECEIPT'].map((code) => action(code)) } as unknown as RentalReturn };
  fixture.gateway.returns.mockImplementation(async () => returned);
  fixture.gateway.reviews.mockResolvedValue({ items: [], next_cursor: null });
  fixture.gateway.preview.mockImplementation(async (_id, body) => ({ basis_version: order.data.order.version, deposit_fen: '50000', overtime_fen: '6000', loss_fen: body.loss_items.length ? '20000' : '0', deducted_fen: body.loss_items.length ? '26000' : '6000', refund_due_fen: body.loss_items.length ? '24000' : '44000', supplement_due_fen: '0', blockers: [] }));
  fixture.gateway.review.mockResolvedValue({}); fixture.gateway.receipt.mockResolvedValue({}); fixture.gateway.correctReceipt.mockResolvedValue({});
  fixture.materials.uploadFile.mockResolvedValue(ready);
  fixture.materials.get.mockResolvedValue({ ...ready, material_class: 'EVIDENCE_IMAGE', owner_account_id: fixture.session.accountId });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((c) => c.clear()); vi.useRealTimers(); vi.restoreAllMocks(); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  function Harness() { const [value, setValue] = useState(order); return <RentalReviewPanel order={value} refresh={async () => setValue(order)} />; }
  const view = render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
  return { ...view, client, refreshSession: () => view.rerender(<QueryClientProvider client={client}><Harness /></QueryClientProvider>) };
}
const selectDecision = (value: string) => fireEvent.change(screen.getByLabelText('审核决定'), { target: { value } });
const change = (label: string, value: string) => { const input = screen.getByLabelText(label); fireEvent.change(input, { target: { value: label === '实际收回时间' ? value.replace('T', ' ') : value } }); if (label === '实际收回时间') fireEvent.keyDown(input, { key: 'Enter' }); };
async function finalReady() { await screen.findByLabelText('审核决定'); await waitFor(() => expect(screen.getByLabelText('核定超期费（元）')).toHaveValue('60.00')); selectDecision('APPROVE_FINAL'); }
async function previewAndConfirm() { await waitFor(() => expect(screen.getByRole('button', { name: '预览最终费用' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: '预览最终费用' })); const check = screen.getByRole('checkbox', { name: /确认本版归还材料/ }); await waitFor(() => expect(check).toBeEnabled()); fireEvent.click(check); }

it('keeps process and final editing in one draft and creates one final intent before FINAL removes editing', async () => {
  fixture.gateway.review.mockImplementation(async () => { order = { ...order, etag: '"ORDER:b3JkZXI:4"', data: { ...order.data, order: { ...order.data.order, version: '4', review_status: 'FINAL', allowed_actions: [] }, bill: { ...order.data.bill, finalized: true } } }; return {}; });
  mount(); await screen.findByLabelText('审核决定'); change('原因（必填）', '待核查草稿'); change('核定超期费（元）', '60.00');
  selectDecision('MATERIAL_REQUIRED'); fireEvent.click(screen.getByRole('checkbox', { name: '设备外观 · 第 1 份' }));
  change('此项补拍要求', '请拍清外观');
  expect(fixture.gateway.review).not.toHaveBeenCalled();
  selectDecision('APPROVE_FINAL'); expect(screen.getByLabelText('核定超期费（元）')).toHaveValue('60.00');
  expect(fixture.gateway.review).not.toHaveBeenCalled(); await previewAndConfirm();
  const submit = screen.getByRole('button', { name: '确认最终核定' }); fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(fixture.gateway.review).toHaveBeenCalledOnce());
  expect(fixture.gateway.review.mock.calls[0]![1]).toMatchObject({ decision: 'APPROVE_FINAL', overtime_assessed_fen: '6000', missing_items: [], rejection_reason: null });
  await waitFor(() => expect(screen.queryByLabelText('审核决定')).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: '确认最终核定' })).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: /改价|下一版/ })).not.toBeInTheDocument();
});

it('saves unknown process values and requires a reason plus legal missing items without finalizing', async () => {
  fixture.gateway.preview.mockResolvedValue({ basis_version: '3', overtime_fen: null, blockers: [] }); mount();
  await screen.findByLabelText('原因（必填）');
  expect(screen.getByRole('button', { name: '保存待核实' })).toBeDisabled();
  change('原因（必填）', '实物待核实'); fireEvent.click(screen.getByRole('button', { name: '保存待核实' }));
  await waitFor(() => expect(fixture.gateway.review).toHaveBeenCalledOnce());
  expect(fixture.gateway.review.mock.calls[0]![1]).toMatchObject({ decision: 'REVIEW_PENDING', overtime_assessed_fen: null, rejection_reason: '实物待核实', loss_items: [], missing_items: [] });
  await screen.findByText(/服务器已保存/); selectDecision('MATERIAL_REQUIRED');
  expect(screen.getByRole('button', { name: '保存补材料要求' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: '设备外观 · 第 1 份' }));
  change('此项补拍要求', '请拍清外观');
  fireEvent.click(screen.getByRole('button', { name: '保存补材料要求' }));
  await waitFor(() => expect(fixture.gateway.review).toHaveBeenCalledTimes(2));
  expect(fixture.gateway.review.mock.calls[1]![1]).toMatchObject({ decision: 'MATERIAL_REQUIRED', missing_items: [{ slot_key: 'front', item_no: 1, evidence_id: null, reason: '请拍清外观' }], overtime_assessed_fen: null });
});

it('requires a new preview after any edit and preserves the exact draft on a 412 before re-previewing the fresh version', async () => {
  mount(); await finalReady(); await previewAndConfirm();
  change('核定超期费（元）', '60.01'); change('核定超期费（元）', '60.00');
  expect(screen.getByRole('button', { name: '确认最终核定' })).toBeDisabled();
  await previewAndConfirm();
  fixture.gateway.review.mockImplementationOnce(async () => { order = { ...order, etag: '"ORDER:b3JkZXI:4"', data: { ...order.data, order: { ...order.data.order, version: '4' } } }; returned = { ...returned, etag: '"RETURN:cmV0dXJu:3"', data: { ...returned.data, version: '3' } }; throw new ApiProblem(412, { code: 'PRECONDITION_FAILED', message: '版本冲突', request_id: 'conflict' }); });
  fireEvent.click(screen.getByRole('button', { name: '确认最终核定' }));
  await waitFor(() => expect(fixture.gateway.returns).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('核定超期费（元）')).toHaveValue('60.00');
  expect(screen.getByRole('button', { name: '确认最终核定' })).toBeDisabled();
  expect(fixture.gateway.review).toHaveBeenCalledOnce();
  await previewAndConfirm(); fireEvent.click(screen.getByRole('button', { name: '确认最终核定' }));
  await waitFor(() => expect(fixture.gateway.review).toHaveBeenCalledTimes(2));
  const second = fixture.gateway.review.mock.calls[1]!;
  expect(second[2]).toBe('"ORDER:b3JkZXI:4"'); expect(second[1]).toMatchObject({ receipt_version: '3', overtime_assessed_fen: '6000', loss_items: [] });
  expect(fixture.gateway.preview).toHaveBeenCalledWith('order', second[1], second[2]);
  expect(screen.queryByText(/灭失结算|维修后复检|逐项实物检查|回收依据/)).not.toBeInTheDocument();
  expect(fixture.materials.uploadFile).not.toHaveBeenCalled();
});

it('blocks final preview for a 200 yuan loss until its original 202 material becomes READY', async () => {
  mount(); await finalReady(); fireEvent.click(screen.getByRole('button', { name: '添加损失项' }));
  change('损失说明', '外壳损坏'); change('核定金额（元）', '200.00');
  expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled();
  vi.useFakeTimers(); fixture.materials.uploadFile.mockResolvedValue({ ...ready, status: 'SCANNING', public_url: null, metadata: null });
  await act(async () => fireEvent.change(screen.getByLabelText('上传本项损失凭证文件选择'), { target: { files: [new File(['png'], 'loss.png', { type: 'image/png' })] } }));
  expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '确认最终核定' })).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); }); vi.useRealTimers();
  await waitFor(() => expect(screen.getByRole('button', { name: '预览最终费用' })).toBeEnabled());
  await previewAndConfirm(); fireEvent.click(screen.getByRole('button', { name: '确认最终核定' }));
  await waitFor(() => expect(fixture.gateway.review).toHaveBeenCalledOnce());
  expect(fixture.gateway.review.mock.calls[0]![1].loss_items).toEqual([{ description: '外壳损坏', confirmed_fen: '20000', evidence_ids: ['loss-original'] }]);
  expect(fixture.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.materials.get).toHaveBeenCalledWith('loss-original', expect.any(Object));
});

it.each(['account', 'unmount', 'deleted-loss'] as const)('discards a late loss material at the actual review consumer after %s changes', async (boundary) => {
  let resolve!: (value: unknown) => void; fixture.materials.uploadFile.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const view = mount(); await finalReady(); fireEvent.click(screen.getByRole('button', { name: '添加损失项' }));
  change('损失说明', '原损失'); change('核定金额（元）', '200');
  fireEvent.change(screen.getByLabelText('上传本项损失凭证文件选择'), { target: { files: [new File(['png'], 'loss.png', { type: 'image/png' })] } });
  await screen.findByRole('button', { name: '取消上传或查询' });
  if (boundary === 'unmount') view.unmount();
  else if (boundary === 'account') { fixture.session = { ...fixture.session, accountId: 'other-admin' }; view.refreshSession(); await waitFor(() => expect(screen.queryByDisplayValue('原损失')).not.toBeInTheDocument()); }
  else { fireEvent.click(screen.getByRole('button', { name: '添加损失项' })); fireEvent.click(screen.getAllByRole('button', { name: '删除损失项' })[0]!); }
  await act(async () => resolve(ready));
  expect(fixture.materials.uploadFile.mock.calls[0]![3].signal.aborted).toBe(true);
  expect(screen.queryByAltText('上传本项损失凭证 1')).not.toBeInTheDocument();
  expect(fixture.gateway.review).not.toHaveBeenCalled();
});

it.each([403, 422])('preserves all loss inputs after a %i rejection and does not automatically resubmit', async (status) => {
  mount(); await finalReady(); change('核定超期费（元）', '0'); change('超期调整原因（与系统金额不同时必填）', '核实无超期');
  fireEvent.click(screen.getByRole('button', { name: '添加损失项' })); change('损失说明', '本单损坏待核对'); change('核定金额（元）', '200.00');
  fireEvent.change(screen.getByLabelText('上传本项损失凭证文件选择'), { target: { files: [new File(['png'], 'loss.png', { type: 'image/png' })] } });
  await screen.findByAltText('上传本项损失凭证 1');
  await previewAndConfirm(); fixture.gateway.review.mockRejectedValue(new ApiProblem(status, { code: status === 403 ? 'PERMISSION_DENIED' : 'VALIDATION_FAILED', message: '材料或权限不满足', request_id: 'rejected' }));
  fireEvent.click(screen.getByRole('button', { name: '确认最终核定' }));
  await waitFor(() => expect(fixture.gateway.returns).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText('核定超期费（元）')).toHaveValue('0'); expect(screen.getByLabelText('超期调整原因（与系统金额不同时必填）')).toHaveValue('核实无超期');
  expect(screen.getByLabelText('损失说明')).toHaveValue('本单损坏待核对'); expect(screen.getByLabelText('核定金额（元）')).toHaveValue('200.00'); expect(screen.getByAltText('上传本项损失凭证 1')).toHaveAttribute('src', ready.public_url);
  expect(fixture.gateway.review).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: '确认最终核定' })).toBeDisabled();
});

it('hides writes for a read-only actor even when cached server actions allowed them', async () => {
  fixture.session.permissions = ['ops.orders.read']; mount(); await screen.findByText('disabled-admin', { exact: false });
  expect(screen.queryByLabelText('审核决定')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: '确认实际收回' })).not.toBeInTheDocument();
  expect(fixture.gateway.preview).not.toHaveBeenCalled(); expect(fixture.gateway.review).not.toHaveBeenCalled();
});

it.each(['CABINET', 'EXPRESS'] as const)('keeps the fixed %s return context after draft success and receipt failure', async (method) => {
  order.data.return_id = null; order.data.delivery.method = method;
  returned.data.method = method; returned.data.received_at = null;
  fixture.gateway.returnDraft.mockImplementation(async () => { order = { ...order, data: { ...order.data, return_id: 'return' } }; return returned; });
  mount(); fireEvent.click(await screen.findByRole('button', { name: `建立归还记录（${method === 'CABINET' ? '柜机' : '快递'}）` }));
  const time = await screen.findByLabelText('实际收回时间');
  expect(fixture.gateway.returnDraft).toHaveBeenCalledWith('order', method, '"ORDER:b3JkZXI:3"', expect.any(String));
  expect(screen.queryByRole('combobox', { name: /方式/ })).not.toBeInTheDocument();
  fireEvent.change(time, { target: { value: '2026-10-07 08:00' } }); fireEvent.keyDown(time, { key: 'Enter' }); expect(time).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(time, { target: { value: '2026-10-06 08:00' } }); fireEvent.keyDown(time, { key: 'Enter' });
  fixture.gateway.receipt.mockRejectedValueOnce(new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: '结果未知', request_id: 'timeout' }));
  fireEvent.click(screen.getByRole('button', { name: '确认实际收回' })); fireEvent.click(await screen.findByRole('button', { name: '恢复原提交' }));
  await waitFor(() => expect(fixture.gateway.receipt).toHaveBeenCalledTimes(2));
  expect(fixture.gateway.receipt.mock.calls[0]).toEqual(fixture.gateway.receipt.mock.calls[1]); expect(fixture.gateway.receipt.mock.calls[0]![2]).toBe(returned.etag);
  expect(fixture.gateway.returnDraft).toHaveBeenCalledOnce(); expect(time).toHaveValue('2026-10-06 08:00');
  expect(screen.getByText(/收回停止计费并下架/)).toBeInTheDocument();
});

it('requires a correction reason and renders cabinet receipt without inventing an operator', async () => {
  returned.data.receipt_source = 'CABINET'; returned.data.receipt_actor_id = null; mount();
  const source = await screen.findByText('收回来源 / 操作人'); expect(source.nextElementSibling).toHaveTextContent('租赁柜 / —');
  fireEvent.click(screen.getByRole('checkbox', { name: '更正实际收回时间' })); change('实际收回时间', '2026-10-06T08:00');
  expect(screen.getByRole('button', { name: '保存时间更正' })).toBeDisabled(); change('更正原因（必填）', '登记时间有误');
  fireEvent.click(screen.getByRole('button', { name: '保存时间更正' })); await waitFor(() => expect(fixture.gateway.correctReceipt).toHaveBeenCalledOnce());
  expect(fixture.gateway.correctReceipt).toHaveBeenCalledWith('order', { received_at: '2026-10-06T00:00:00.000Z', reason: '登记时间有误' }, returned.etag, expect.any(String));
  expect(within(screen.getByRole('group', { name: '费用审核' })).queryByLabelText('实际收回时间')).not.toBeInTheDocument();
});

it('renders both receipt corrections in server order with original values and stable actor IDs', async () => {
  returned.data.receipt_history = [
    { old_received_at: '2026-10-06T00:00:00Z', new_received_at: '2026-10-06T00:10:00Z', reason: '第一次更正', actor_account_id: 'disabled-admin-a', recorded_at: '2026-10-06T01:00:00Z' },
    { old_received_at: '2026-10-06T00:10:00Z', new_received_at: '2026-10-06T00:15:00Z', reason: '第二次更正', actor_account_id: 'disabled-admin-b', recorded_at: '2026-10-06T02:00:00Z' },
  ];
  mount(); fireEvent.click(await screen.findByText('收回时间变更历史'));
  const trigger = screen.getByRole('button', { name: '收回时间变更历史' });
  const history = document.getElementById(trigger.getAttribute('aria-controls')!)!;
  const items = within(history).getAllByRole('listitem'); expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('第一次更正'); expect(items[0]).toHaveTextContent('disabled-admin-a'); expect(items[0]).toHaveTextContent('2026年10月6日 08:00:00'); expect(items[0]).toHaveTextContent('2026年10月6日 08:10:00');
  expect(items[1]).toHaveTextContent('第二次更正'); expect(items[1]).toHaveTextContent('disabled-admin-b'); expect(items[1]).toHaveTextContent('2026年10月6日 08:10:00'); expect(items[1]).toHaveTextContent('2026年10月6日 08:15:00');
});

it('keeps monetary empty, zero and invalid decimal drafts distinct in the final review consumer', async () => {
  mount(); await finalReady();
  for (const value of ['', '0.001', '-1', '1e2']) { change('核定超期费（元）', value); expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled(); }
  change('核定超期费（元）', '0'); change('超期调整原因（与系统金额不同时必填）', '核实免收超期'); await previewAndConfirm();
  fireEvent.click(screen.getByRole('button', { name: '确认最终核定' })); await waitFor(() => expect(fixture.gateway.review).toHaveBeenCalledOnce()); expect(fixture.gateway.review.mock.calls[0]![1].overtime_assessed_fen).toBe('0');
  expect(screen.getByText(/提交后金额冻结/)).toBeInTheDocument();
});


it.each(['核定超期费（元）', '核定金额（元）'])('identifies invalid %s on the native field, preserves its draft and removes its error when corrected', async (label) => {
  mount(); await finalReady();
  if (label === '核定金额（元）') { fireEvent.click(screen.getByRole('button', { name: '添加损失项' })); change('损失说明', '保留损失草稿'); }
  const field = screen.getByLabelText(label);
  for (const value of ['1.001', '-1', '1e2', '92233720368547758.08']) {
    change(label, value); fireEvent.blur(field);
    expect(field).toHaveValue(value); expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('请输入合法的非负金额，最多两位小数，且不超出系统金额范围。');
    const error = document.getElementById(field.getAttribute('aria-describedby')!);
    expect(error).toHaveAttribute('role', 'alert'); expect(error).toBeVisible();
    // TDesign's absolute tips can escape the scrolled drawer: reserve normal
    // flow below this field, independently from the library's tips wrapper.
    expect(error?.parentElement).toBe(field.closest('label'));
    expect(error).toHaveStyle({ display: 'block' });
    expect(error?.closest('.t-input__tips')).toBeNull();
    field.focus(); expect(field).toHaveFocus(); expect(screen.getByRole('button', { name: '预览最终费用' })).toBeDisabled();
  }
  change(label, ''); expect(field).toHaveAccessibleDescription('最终核定必须填写金额，可填 0。');
  change(label, '0'); expect(field).toHaveAttribute('aria-invalid', 'false'); expect(field).not.toHaveAttribute('aria-describedby');
  expect(fixture.gateway.review).not.toHaveBeenCalled();
  if (label === '核定金额（元）') expect(screen.getByLabelText('损失说明')).toHaveValue('保留损失草稿');
});

it('keeps unknown process amounts optional and gives each loss error its own stable association', async () => {
  fixture.gateway.preview.mockResolvedValue({ basis_version: '3', overtime_fen: null, blockers: [] });
  mount(); await screen.findByLabelText('原因（必填）'); change('原因（必填）', '保留待核实原因');
  expect(screen.getByLabelText('核定超期费（元）')).toHaveAttribute('aria-invalid', 'false');
  expect(screen.getByLabelText('核定超期费（元）')).toHaveAttribute('aria-required', 'false');
  expect(screen.getByRole('button', { name: '保存待核实' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '添加损失项' })); fireEvent.click(screen.getByRole('button', { name: '添加损失项' }));
  const fields = screen.getAllByLabelText('核定金额（元）');
  fields.forEach((field) => { fireEvent.change(field, { target: { value: '1.001' } }); fireEvent.blur(field); });
  const first = fields[0]!.getAttribute('aria-describedby'); const second = fields[1]!.getAttribute('aria-describedby');
  expect(first).toBeTruthy(); expect(second).toBeTruthy(); expect(first).not.toBe(second);
  fireEvent.click(screen.getAllByRole('button', { name: '删除损失项' })[0]!);
  expect(screen.getByLabelText('核定金额（元）')).toHaveAttribute('aria-describedby', second);
  expect(screen.getByLabelText('原因（必填）')).toHaveValue('保留待核实原因');
});
