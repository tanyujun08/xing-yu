import { randomId } from '../../shared/randomId';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, Input, Space } from 'tdesign-react';
import { cabinetManagementFailure, type CabinetManagementGateway, type CabinetPlacementReceipt, type ManagedCabinet } from '../../shared/services/cabinetManagement';

const reasonLabels: Record<string, string> = {
  CABINET_NOT_READY: '柜机暂不满足入柜条件，可能有查询或操作尚未结束，或启用、拓扑、地址未确认。请刷新候选；若仍不可用，请核对柜机状态。', NO_AVAILABLE_SLOT: '当前没有可用空闲格口',
  SLOT_NOT_COMMISSIONED: '格口尚未投用', SLOT_NOT_AVAILABLE: '格口已占用或预占', SLOT_BUSINESS_BUSY: '格口存在业务占用',
  ASSET_NOT_AVAILABLE: '资产未下架或不可用', ASSET_NOT_APPROVED: '资产资料未完整保存，请打开资产核对', ASSET_BUSY: '资产已在柜或存在订单、预约占用',
};
const stockingDialogA11y = { role: 'dialog', 'aria-modal': true, 'aria-label': '资产入柜' } as const;
const discardDialogA11y = { role: 'dialog', 'aria-modal': true, 'aria-label': '放弃本次入柜选择' } as const;

export function CabinetStockingCreateDialog({ cabinet, gateway, accountId, onClose, onPlaced }: {
  cabinet: ManagedCabinet | null;
  gateway: CabinetManagementGateway;
  accountId: string | null;
  onClose: () => void;
  onPlaced: (receipt: CabinetPlacementReceipt) => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [queryInput, setQueryInput] = useState('');
  const [queryText, setQueryText] = useState('');
  const [cursor, setCursor] = useState('');
  const [assetId, setAssetId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [reason, setReason] = useState('后台资产入柜');
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [pending, setPending] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const request = useRef<(() => Promise<CabinetPlacementReceipt>) | null>(null);
  const applySearch = () => { setQueryText(queryInput.trim()); setCursor(''); setAssetId(''); };
  const options = useQuery({
    queryKey: ['cabinet-management', accountId, 'stocking-options', cabinet?.cabinet_id, queryText, cursor],
    queryFn: ({ signal }) => gateway.stockingOptions(cabinet!.cabinet_id, { query: queryText, cursor }, { signal }),
    enabled: cabinet !== null,
    retry: false,
    refetchOnWindowFocus: 'always',
  });
  const asset = options.data?.assets.items.find((item) => item.asset_id === assetId);
  const slot = options.data?.slots.find((item) => item.compartment_id === slotId);
  const close = (discard = false) => {
    if (pending || uncertain) return;
    if (!discard && (assetId !== '' || slotId !== '' || reason !== '后台资产入柜')) { setDiscardConfirmOpen(true); return; }
    setDiscardConfirmOpen(false);
    setQueryInput(''); setQueryText(''); setCursor(''); setAssetId(''); setSlotId(''); setReason('后台资产入柜'); setError(''); request.current = null;
    onClose();
  };
  const submit = async () => {
    if (pending || cabinet === null) return;
    setPending(true); setError('');
    try {
      if (request.current === null) {
        if (!options.data?.cabinet_readiness.eligible || !asset?.eligible || !slot?.eligible) throw new Error('请刷新并选择当前合格的资产和格口');
        if (reason.trim().length < 3 || reason.trim().length > 256) throw new Error('请填写 3～256 字操作原因');
        const key = randomId();
        request.current = () => gateway.placeAsset(asset.asset_id, asset.version, cabinet.cabinet_id, slot.compartment_id, reason.trim(), key);
      }
      const receipt = await request.current();
      request.current = null; setUncertain(false);
      await queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId] });
      await onPlaced(receipt);
      setQueryInput(''); setQueryText(''); setCursor(''); setAssetId(''); setSlotId(''); setReason('后台资产入柜'); setError('');
      onClose();
    } catch (failure) {
      const result = cabinetManagementFailure(failure, request.current !== null);
      setUncertain(result.uncertain);
      setError(failure instanceof Error && !(failure as { status?: number }).status ? failure.message : result.message);
      if (!result.uncertain) request.current = null;
      if (result.refreshRequired) void options.refetch();
    } finally { setPending(false); }
  };
  return <>
    <Dialog {...stockingDialogA11y} visible={cabinet !== null} header="资产入柜" width="min(980px, 96vw)" top="6vh" className="cabinet-stocking-dialog" closeOnOverlayClick={false}
      footer={<div className="cabinet-stocking-dialog__footer"><div className="cabinet-stocking-dialog__summary"><strong>已选 {asset ? '1' : '0'} 台资产 · {slot ? `BOX ${String(slot.compartment_no).padStart(2, '0')}` : '未选格口'}</strong><small>提交即确认实际入柜并生成休眠取件码；资产仍未上架，需另行点击上架。</small></div><Space><Button variant="outline" disabled={pending || uncertain} onClick={() => close()}>取消</Button><Button theme="primary" loading={pending} disabled={pending || (!uncertain && (options.isFetching || options.isError || !options.data?.cabinet_readiness.eligible || !asset?.eligible || !slot?.eligible))} onClick={() => { void submit(); }}>{uncertain ? '用原请求核对' : '确认入柜'}</Button></Space></div>}
      onClose={() => close()}>
      {cabinet && <div className="cabinet-stocking-dialog__body">
        <div className="cabinet-stocking-dialog__cabinet"><div><strong>{cabinet.cabinet_name}</strong><small>设备编号 {cabinet.provider_device_id}</small></div><span>{cabinet.lifecycle_status === 'ACTIVE' ? '已启用' : '未启用'}</span><span>业务空闲格口 {cabinet.occupancy_summary.available}</span></div>
        {uncertain && <Alert theme="warning" message="请求结果待核对。已保留原请求及幂等键；请勿重复登记入柜。" />}
        {options.isError && <Alert theme="error" message="入柜候选读取失败，请刷新；不展示本地推测的可用资产。" />}
        {options.data && !options.data.cabinet_readiness.eligible && <Alert theme="warning" message={reasonLabels[options.data.cabinet_readiness.reason_code] ?? options.data.cabinet_readiness.reason_code} />}
        {error && <Alert theme="error" message={error} />}
        <div><Button tag="button" type="button" variant="outline" disabled={uncertain || pending || options.isFetching} onClick={() => { void options.refetch(); }}>刷新候选</Button></div>
        <div className="cabinet-stocking-dialog__columns">
          <section aria-label="选择可入柜资产"><h3>选择可入柜资产</h3><p>本柜商家所属官方资产；资格由服务端实时返回。</p>
            <div className="cabinet-stocking-dialog__search"><Input value={queryInput} clearable disabled={uncertain || pending} placeholder="搜索资产名称或编号" onChange={setQueryInput} onEnter={applySearch} /><Button variant="outline" disabled={uncertain || pending || options.isFetching} onClick={applySearch}>搜索</Button></div>
            <div className="cabinet-stocking-dialog__asset-list" role="group" aria-label="资产候选">
              {options.isFetching && <p role="status">正在读取资产候选…</p>}
              {!options.isFetching && options.data?.assets.items.length === 0 && <p>当前条件下暂无资产候选</p>}
              {options.data?.assets.items.map((item) => <Button variant="text" tag="button" key={item.asset_id} type="button" className="cabinet-stocking-dialog__asset" aria-pressed={assetId === item.asset_id} disabled={!item.eligible || uncertain || pending} onClick={() => setAssetId(item.asset_id)}>
                <span className="cabinet-stocking-dialog__radio" aria-hidden="true" /><span><strong>{item.display_name}</strong><small>资产编号 {item.asset_no}</small></span><em>{item.eligible ? '可入柜' : reasonLabels[item.reason_code] ?? item.reason_code}</em>
              </Button>)}
            </div>
            <Space><Button variant="text" disabled={uncertain || pending || cursor === '' || options.isFetching} onClick={() => { setCursor(''); setAssetId(''); }}>最新一页</Button><Button variant="text" disabled={uncertain || pending || !options.data?.assets.page.has_more || !options.data.assets.page.next_cursor || options.isFetching} onClick={() => { setCursor(options.data?.assets.page.next_cursor ?? ''); setAssetId(''); }}>下一页资产</Button></Space>
          </section>
          <section aria-label="选择空闲格口"><h3>选择空闲格口</h3><p>选择实际投放的空闲格口；提交时检查资产与格口占用，不依赖柜门开关。</p>
            <div className="cabinet-stocking-dialog__slots" role="group" aria-label="格口候选">
              {options.data?.slots.map((item) => <div key={item.compartment_id} className="cabinet-stocking-dialog__slot-item"><Button variant="text" tag="button" type="button" className="cabinet-stocking-dialog__slot" aria-pressed={slotId === item.compartment_id} disabled={!item.eligible || uncertain || pending} onClick={() => setSlotId(item.compartment_id)}><span className="cabinet-stocking-dialog__radio" aria-hidden="true" /><span><strong>BOX {String(item.compartment_no).padStart(2, '0')}</strong><small>{item.eligible ? '可用' : reasonLabels[item.reason_code] ?? item.reason_code}</small></span></Button></div>)}
            </div>
            <label className="cabinet-stocking-dialog__reason"><strong>操作原因</strong><Input maxlength={256} value={reason} disabled={uncertain || pending} onChange={setReason} /><small>{reason.trim().length}/256，至少 3 字</small></label>
          </section>
        </div>
      </div>}
    </Dialog>
    <Dialog {...discardDialogA11y} visible={discardConfirmOpen} header="放弃本次入柜选择？" confirmBtn={{ content: '放弃选择', theme: 'danger' }} cancelBtn="继续填写" onClose={() => setDiscardConfirmOpen(false)} onCancel={() => setDiscardConfirmOpen(false)} onConfirm={() => close(true)}>已选资产、格口和操作原因将清空。</Dialog>
  </>;
}
