import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, Link } from 'tdesign-react';
import { randomId } from '../../shared/randomId';
import { formatUTC } from '../../shared/format/time';
import { cabinetManagementFailure, type CabinetManagementGateway, type ManagedCabinet } from '../../shared/services/cabinetManagement';

const running = new Set(['QUEUED', 'PREPARING', 'WAITING_ONLINE', 'SENDING']);
const labels: Record<string, string> = { QUEUED: '等待准备', PREPARING: '正在生成封面', WAITING_ONLINE: '等待柜机在线', SENDING: '正在下发', ACCEPTED: '千鸣已受理', FAILED: '同步失败', UNKNOWN: '下发结果待核实', CANCELED: '已取消' };
export function CabinetCoverSync({ cabinet, gateway, accountId, visible, disabled }: {
  cabinet: ManagedCabinet; gateway: CabinetManagementGateway; accountId: string | null; visible: boolean; disabled: boolean;
}) {
  return <CabinetCoverSyncScope key={`${accountId}:${cabinet.cabinet_id}`} cabinet={cabinet} gateway={gateway} accountId={accountId} visible={visible} disabled={disabled} />;
}
function CabinetCoverSyncScope({ cabinet, gateway, accountId, visible, disabled }: {
  cabinet: ManagedCabinet; gateway: CabinetManagementGateway; accountId: string | null; visible: boolean; disabled: boolean;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submittedSync, setSubmittedSync] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [deadline, setDeadline] = useState(() => Date.now() + 120_000);
  const request = useRef<{ key: string; body: Parameters<NonNullable<CabinetManagementGateway['syncCover']>>[1] } | null>(null);
  const active = useRef({ cabinet: cabinet.cabinet_id, accountId, visible });
  const epoch = useRef(0);
  useLayoutEffect(() => {
    epoch.current++;
    active.current = { cabinet: cabinet.cabinet_id, accountId, visible };
    const generation = epoch.current;
    const interrupted = request.current;
    // A visibility transition retires display ownership, but retains this scope's
    // idempotency intent. A rapid hide/show must not skip the display reset.
    void Promise.resolve().then(() => {
      if (epoch.current !== generation) return;
      if (!visible || interrupted !== null && request.current === interrupted) {
        setConfirm(false); setPending(false);
        if (interrupted !== null && request.current === interrupted) {
          setUncertain(true);
          setError('提交结果待核实，请用原请求核对；不会自动重新提交。');
        }
      }
    });
  }, [accountId, cabinet.cabinet_id, visible]);
  const flight = useRef(false);
  useEffect(() => () => { active.current.visible = false; epoch.current++; }, []);
  const detail = useQuery({
    queryKey: ['cabinet-management', accountId, 'cover-detail', cabinet.cabinet_id],
    queryFn: async ({ signal }) => {
      const result = await gateway.get(cabinet.cabinet_id, { signal });
      if (!result || result.cabinet_id !== cabinet.cabinet_id) throw new Error('柜机封面回读不匹配，请刷新当前柜机。');
      return result;
    },
    enabled: visible && gateway.syncCover !== undefined,
    retry: false, refetchOnWindowFocus: 'always', refetchIntervalInBackground: false,
    refetchInterval: query => visible && Date.now() < deadline && (submittedSync !== '' && query.state.data?.cover?.sync_id !== submittedSync || running.has(query.state.data?.cover?.status ?? cabinet.cover?.status ?? '')) ? 3000 : false,
  });
  const value = detail.data ?? cabinet;
  const cover = value.cover;
  // Older/partial projections cannot grant this new action. A failed read also
  // must not revive a previously granted action from the parent projection.
  const canSync = cabinet.allowed_actions?.sync_cover === true && value.allowed_actions?.sync_cover === true && !detail.isError && gateway.syncCover !== undefined && (!submittedSync || cover?.sync_id === submittedSync);
  const refetch = detail.refetch;
  useEffect(() => { if (visible && gateway.syncCover) void refetch(); }, [visible, gateway, refetch]);
  useEffect(() => {
    if (!visible) {
      void client.cancelQueries({ queryKey: ['cabinet-management', accountId, 'cover-detail', cabinet.cabinet_id] });
    }
  }, [visible, client, accountId, cabinet.cabinet_id]);
  const submit = async (recover = false, retryOriginal = false) => {
    if (!visible || disabled || flight.current || !gateway.syncCover || (!retryOriginal && !canSync)) return;
    if (!retryOriginal && request.current !== null) return;
    const owner = active.current;
    const generation = epoch.current;
    const isCurrent = () => epoch.current === generation && active.current.visible && active.current.accountId === owner.accountId && active.current.cabinet === owner.cabinet;
    if (!retryOriginal) request.current = { key: randomId(), body: recover ? { original_sync_id: cover!.sync_id!, confirm_resend: true } : {} };
    const original = request.current;
    if (!original) return;
    flight.current = true; setPending(true); setError(''); setConfirm(false);
    try {
      const receipt = await gateway.syncCover(cabinet.cabinet_id, original.body, original.key);
      if (!isCurrent()) return;
      request.current = null;
      setUncertain(false);
      setSubmittedSync(receipt.sync_id);
      setNotice('同步任务已提交；柜屏实际显示请在现场核对。');
      setDeadline(Date.now() + 120_000);
      await Promise.all([refetch(), client.invalidateQueries({ queryKey: ['cabinet-management', accountId, 'detail', cabinet.cabinet_id] })]);
    } catch (failure) {
      if (!isCurrent()) return;
      const problem = cabinetManagementFailure(failure, true);
      const known = !problem.uncertain;
      if (known) request.current = null;
      setUncertain(!known);
      setError(known ? problem.message : '提交结果待核实，请用原请求核对；不会自动重新提交。');
    } finally { flight.current = false; if (isCurrent()) setPending(false); }
  };
  return <section className="cabinet-api-commands__group" aria-label="封面同步">
    <h4>封面</h4>
    <p>小程序码{cover?.code_ready ? '已就绪' : '待生成'}</p>
    <div className="cabinet-api-commands__row"><span>{cover?.status ? labels[cover.status] : '未生成'}</span><Button tag="button" disabled={disabled || pending || !canSync || uncertain} loading={pending} onClick={() => { if (cover?.status === 'UNKNOWN') setConfirm(true); else void submit(); }}>同步封面</Button>
      {cover?.cover_url && <Link href={cover.cover_url} target="_blank">{cover.preview_is_previous ? '上次封面 · 预览/下载' : '预览/下载封面'}</Link>}
    </div>
    {cover?.cover_url && cover.preview_is_previous && <p role="status">当前预览为上次封面，本次同步尚未生成可用的新封面。</p>}
    {cover?.accepted_at && <p>最近受理：{formatUTC(cover.accepted_at)}。受理结果不代表柜屏已显示。</p>}
    {!canSync && <p>当前无法同步，请核对管理权限、柜机状态或正在进行的任务。</p>}
    {cover?.error_code && <p role="status">同步提示：{cover.error_code}</p>}
    {notice && <p role="status">{notice}</p>}
    {detail.isError && <Alert theme="error" message="封面状态读取失败，请刷新当前柜机。" />}
    {error && <Alert theme="warning" message={error} />}
    {uncertain && !pending && <Button tag="button" disabled={disabled || !visible} onClick={() => { void submit(false, true); }}>用原请求核对封面同步</Button>}
    <Dialog visible={confirm} header="确认再次下发封面" confirmBtn="确认再次下发" cancelBtn="取消" onClose={() => setConfirm(false)} onCancel={() => setConfirm(false)} onConfirm={() => { void submit(true); }}>
      <p>上次下发结果未知。请先核对柜屏与运行记录；确认后将创建新的同步任务，新封面会覆盖旧封面，供应商迟到请求仍可能影响显示。</p>
    </Dialog>
  </section>;
}
