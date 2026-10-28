import { Alert, Button, Drawer } from 'tdesign-react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { formatUTC } from '../../shared/format/time';
import { cabinetObservationSource, type ManagedCabinetCredential, type ManagedCompartment } from '../../shared/services/cabinetManagement';
import { StatusTag } from '../../shared/ui/StatusTag';

function observedAt(value: string | null | undefined): string {
  return value ? formatUTC(value) : '尚无可靠观察';
}
const credentialLabels = { DORMANT: '休眠', ACTIVE: '可取件', CONSUMED: '已使用', REVOKED: '已撤销' } satisfies Record<ManagedCabinetCredential['status'], string>;

export function CabinetCompartmentDrawer({ compartment, onClose }: {
  compartment: ManagedCompartment | null;
  onClose: () => void;
}) {
  const occupant = compartment?.occupant ?? null;
  const session = useSession(); const gateway = useAdminServices().cabinetManagement;
  const canReadCredential = session.permissions.includes('ops.cabinets.credentials.read');
  const credentialID = occupant?.credential_id ?? null;
  const credential = useQuery({
    queryKey: ['cabinet-credential', session.accountId, compartment?.compartment_id, credentialID],
    enabled: canReadCredential && !!gateway && !!compartment && !!credentialID,
    queryFn: async ({ signal }) => {
      const value = await gateway!.credential(credentialID!, { signal });
      if (value.credential_id !== credentialID || value.cabinet_id !== compartment!.cabinet_id || value.compartment_id !== compartment!.compartment_id) throw new Error('凭证绑定与当前格口不一致，请刷新柜机后核对。');
      return value;
    }, retry: false, refetchOnWindowFocus: false,
  });
  const currentCredential = canReadCredential && credentialID && !credential.isError ? credential.data : undefined;
  const occupancy = compartment?.business_occupancy_status;
  const observedRFID = compartment?.rfid_status === 'PRESENT' ? compartment.observed_rfid_code : compartment?.rfid_status === 'ABSENT' ? '未检测到设备' : compartment?.rfid_checked_at ? '待核实' : '未读取';
  const occupantMismatch = occupancy === 'UNKNOWN'
    || (occupancy === 'OCCUPIED' && occupant === null)
    || (occupancy !== 'OCCUPIED' && occupant !== null);
  return <Drawer
    visible={compartment !== null}
    header={compartment === null ? '格口详情' : `格口详情 · BOX ${String(compartment.compartment_no).padStart(2, '0')}`}
    size="min(520px, 96vw)"
    footer={false}
    onClose={onClose}
  >
    {compartment === null ? null : <div className="cabinet-side-detail">
      <section className="cabinet-side-detail__summary">
        <strong>BOX {String(compartment.compartment_no).padStart(2, '0')}</strong>
        <StatusTag value={compartment.business_occupancy_status} />
      </section>
      {compartment.door_status === 'UNKNOWN' || compartment.door_error_code
        ? <Alert theme="warning" message="门态尚未可靠确认；不能依据此记录判断格口可开或可入柜。" />
        : null}
      {occupantMismatch
        ? <Alert theme="warning" message="占用待核查：业务状态与有效在柜资产记录不一致，请核对后再操作。" />
        : null}
      <section>
        <h3>当前格口状态</h3>
        <dl className="cabinet-side-detail__facts">
          <div><dt>业务占用</dt><dd><StatusTag value={compartment.business_occupancy_status} /></dd></div>
          <div><dt>在柜资产</dt><dd>{occupant?.display_name ?? (occupantMismatch ? '占用待核查' : '未登记在柜资产')}</dd></div>
          {occupant && <><div><dt>资产编号</dt><dd>{occupant.asset_no}</dd></div><div><dt>资产 ID</dt><dd>{occupant.asset_id}</dd></div></>}
          <div><dt>服务状态</dt><dd><StatusTag value={compartment.service_status} /></dd></div>
          <div><dt>柜门状态</dt><dd>{compartment.door_status === 'OPEN' ? '门开' : compartment.door_status === 'CLOSED' ? '门关' : '未知'}</dd></div>
          <div><dt>实测 RFID</dt><dd>{observedRFID}<br /><small>最近查询：{compartment.rfid_checked_at ? formatUTC(compartment.rfid_checked_at) : '尚未查询'}</small></dd></div>
          <div><dt>最后观察</dt><dd>{observedAt(compartment.door_observed_at)}</dd></div>
          <div><dt>观察来源</dt><dd>{cabinetObservationSource(compartment.door_observation_source)}</dd></div>
          <div><dt>查询诊断</dt><dd>{compartment.door_error_code ?? '无'}</dd></div>
          <div><dt>拓扑状态</dt><dd>{compartment.topology_status === 'IN_TOPOLOGY' ? '当前格口' : '已退出当前拓扑'}</dd></div>
          <div><dt>格口编号</dt><dd>{compartment.compartment_no}</dd></div>
        </dl>
      </section>
      <section aria-label="取件凭证状态">
        <h3>取件凭证状态</h3>
        {!canReadCredential ? <p>当前角色没有取件凭证读取权限。</p> : !credentialID ? <p>当前格口没有可查询的取件凭证。</p> : !gateway ? <p>凭证读取服务未接入。</p> : <>
          {credential.isLoading ? <p role="status">正在读取原取件凭证…</p> : null}
          {credential.isError ? <Alert theme="error" message="取件凭证读取失败，请核对当前权限与格口绑定后重试。" operation={<Button onClick={() => void credential.refetch()}>重新读取凭证</Button>} /> : null}
          {currentCredential ? <dl className="cabinet-side-detail__facts">
            <div><dt>凭证状态</dt><dd>{credentialLabels[currentCredential.status] ?? `未知状态（${currentCredential.status}）`}</dd></div>
            <div><dt>凭证编号</dt><dd>{currentCredential.credential_id}</dd></div>
            <div><dt>入柜记录</dt><dd>{currentCredential.placement_id}</dd></div>
            <div><dt>生成时间</dt><dd>{observedAt(currentCredential.generated_at)}</dd></div>
            <div><dt>激活时间</dt><dd>{currentCredential.activated_at ? formatUTC(currentCredential.activated_at) : '尚未激活'}</dd></div>
            <div><dt>使用时间</dt><dd>{currentCredential.consumed_at ? formatUTC(currentCredential.consumed_at) : '尚未使用'}</dd></div>
            <div><dt>撤销时间</dt><dd>{currentCredential.revoked_at ? formatUTC(currentCredential.revoked_at) : '未撤销'}</dd></div>
          </dl> : null}
        </>}
        <p>这里只显示凭证绑定与状态，不显示六位取件码；柜体小程序码在柜机详情单独下载。</p>
      </section>
      <p className="cabinet-side-detail__note">登记资产与实测 RFID 分别展示：未登记不代表格口内没有设备。业务占用来自资产与任务记录，门关只代表最近观察到的门态。</p>
    </div>}
  </Drawer>;
}
