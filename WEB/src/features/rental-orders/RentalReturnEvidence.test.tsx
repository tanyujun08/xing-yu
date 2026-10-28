import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RentalMissingEvidence, RentalReturnEvidence } from './RentalReturnEvidence';
import { returnEvidenceFixture } from './returnEvidenceFixture';
import type { RentalReturn, Versioned } from '../../shared/services/rentalOrders';

const f = vi.hoisted(() => ({ permissions: ['ops.returns.receive'], save: vi.fn(), resolve: vi.fn() }));
vi.mock('../../shared/access/session', () => ({ useSession: () => ({ accountId: 'operator-a', permissions: f.permissions }) }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ rentalOrders: { saveReturnEvidence: f.save, resolveReturn: f.resolve } }) }));
vi.mock('tdesign-react', async importOriginal => ({ ...await importOriginal<typeof import('tdesign-react')>(), Select: ({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) => <select aria-label="凭证项目" value={value} onChange={e => onChange(e.target.value)}><option value="">请选择</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
vi.mock('../../shared/ui/MediaUploadField', () => ({ MediaUploadField: ({ ownerId, onChange, onStateChange }: { ownerId: string; onChange: (files: unknown[]) => void; onStateChange: (state: { blocked: boolean }) => void }) => <><span>上传主体 {ownerId}</span><button onClick={() => { onChange([{ materialId: 'own-ready-material' }]); onStateChange({ blocked: false }); }}>就绪素材</button><button onClick={() => onStateChange({ blocked: true })}>扫描中</button></> }));

function record(): Versioned<RentalReturn> {
  const value = returnEvidenceFixture();
  const slot = { ...value.evidence_template.slots[0]!, slot_key: 'in-cabinet', title: '入柜照片', stage: 'AFTER_OPEN' as const };
  return { etag: '"RETURN:r1:7"', serverClock: null, data: { ...value, order_id: 'order-a', return_id: 'r1', version: '7', received_at: '2026-10-08T10:00:00Z', evidence_template: { ...value.evidence_template, slots: [slot] }, evidence_slots: [{ slot, items: [], complete: false, editable: true, blocker: null }] } as unknown as RentalReturn };
}
const submit = async (run: () => Promise<unknown>) => { await run(); };
beforeEach(() => { f.permissions = ['ops.returns.receive']; f.save.mockResolvedValue({}); f.resolve.mockResolvedValue({}); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('binds own READY proof to the selected slot and exact RETURN version with a reason', async () => {
  render(<RentalReturnEvidence record={record()} disabled={false} submit={submit} />);
  fireEvent.change(screen.getByLabelText('凭证项目'), { target: { value: 'in-cabinet:1' } });
  expect(screen.getByText('上传主体 operator-a')).toBeInTheDocument();
  const save = screen.getByRole('button', { name: '保存入柜凭证' });
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByText('就绪素材'));
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('代补原因（必填）'), { target: { value: '客服现场补充入柜照片' } });
  expect(save).toBeEnabled();
  fireEvent.click(screen.getByText('扫描中'));
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByText('就绪素材'));
  fireEvent.click(save);
  await waitFor(() => expect(f.save).toHaveBeenCalledOnce());
  expect(f.save).toHaveBeenCalledWith('order-a', 'in-cabinet', 1, { material_id: 'own-ready-material', reason: '客服现场补充入柜照片' }, '"RETURN:r1:7"', expect.any(String));
});

it('hides supplement without receive permission or an editable AFTER_OPEN slot', () => {
  f.permissions = ['ops.returns.review'];
  const view = render(<RentalReturnEvidence record={record()} disabled={false} submit={submit} />);
  expect(screen.queryByText('代补入柜凭证')).not.toBeInTheDocument();
  f.permissions = ['ops.returns.receive'];
  const locked = record(); locked.data.evidence_slots[0]!.editable = false;
  view.rerender(<RentalReturnEvidence record={locked} disabled={false} submit={submit} />);
  expect(screen.queryByText('代补入柜凭证')).not.toBeInTheDocument();
});

it('resolves only the allowed original task and requires an explicit reason', async () => {
  const value = record();
  value.data.cabinet_task = { task_id: 'original-task', version: '9', status: 'ANOMALY', cabinet_name: '本地柜', compartment_no: '2', verification_requested_at: '2026-10-08T09:00:00Z', door_status: 'CLOSED', rfid_result: 'MISMATCH', allowed_actions: [{ action_code: 'RECHECK_RETURN', allowed: true, blocker: null }, { action_code: 'RELEASE_EMPTY_RETURN', allowed: false, blocker: null }] } as unknown as RentalReturn['cabinet_task'];
  render(<RentalReturnEvidence record={value} disabled={false} submit={submit} />);
  expect(screen.queryByRole('button', { name: '核实空格后释放' })).not.toBeInTheDocument();
  const recheck = screen.getByRole('button', { name: '重新核验原格口' });
  expect(recheck).toBeDisabled();
  fireEvent.change(screen.getByLabelText('处置原因（必填）'), { target: { value: '核对设备标签后复查' } });
  fireEvent.click(recheck);
  await waitFor(() => expect(f.resolve).toHaveBeenCalledOnce());
  expect(f.resolve).toHaveBeenCalledWith(value.data.cabinet_task, { action: 'RECHECK', reason: '核对设备标签后复查' }, expect.any(String));
});

it('ties missing-proof requirements to the exact slot, item and current evidence revision', () => {
  const value = record().data; const change = vi.fn();
  value.evidence_slots[0]!.items = [{ evidence_id: 'latest-proof', item_no: 1 }] as RentalReturn['evidence_slots'][number]['items'];
  const view = render(<RentalMissingEvidence returned={value} value={[]} onChange={change} />);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(change).toHaveBeenCalledWith([{ slot_key: 'in-cabinet', item_no: 1, evidence_id: 'latest-proof', reason: '' }]);
  view.rerender(<RentalMissingEvidence returned={value} value={[{ slot_key: 'in-cabinet', item_no: 1, evidence_id: 'old-proof', reason: '拍清全景' }]} onChange={change} />);
  expect(screen.getByText('该凭证已被更换，请取消勾选并核对最新凭证后重新选择。')).toBeInTheDocument();
});
