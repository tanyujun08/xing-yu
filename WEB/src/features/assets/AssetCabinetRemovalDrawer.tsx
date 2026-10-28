import { randomId } from '../../shared/randomId';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Form, Input, Textarea } from 'tdesign-react';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type Asset } from '../../shared/services';
import { cabinetManagementFailure, type CabinetPlacementReceipt } from '../../shared/services/cabinetManagement';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { FormGrid } from '../../shared/ui/FormGrid';
import { FormSection } from '../../shared/ui/FormSection';

const initialReason = '后台资产出柜';
export function AssetCabinetRemovalDrawer({ asset, locationLabel, onCancel, onRemoved }: {
  asset: Asset | null; locationLabel: string; onCancel: () => void;
  onRemoved: (receipt: CabinetPlacementReceipt) => void | Promise<void>;
}) {
  const gateway = useAdminServices().cabinetManagement;
  const keys = useAdminQueryKeys();
  const queryClient = useQueryClient();
  const form = Form.useForm()[0]!;
  const [reason, setReason] = useState(initialReason);
  const [uncertain, setUncertain] = useState(false);
  const original = useRef<(() => Promise<CabinetPlacementReceipt>) | null>(null);
  const submit = async () => {
    if (original.current === null) {
      const placement = asset?.placement;
      if (!asset || !gateway || placement?.location_kind !== 'CABINET' || !placement.placement_id || !placement.version) throw new Error('当前在柜记录不可核实，请刷新资产后重试');
      if (asset.publishStatus !== 'OFFLINE' || asset.availabilityStatus !== 'AVAILABLE') throw new Error('请先下架资产，并确认资产可用后再出柜');
      const trimmed = reason.trim();
      if (trimmed.length < 3 || trimmed.length > 256) throw new Error('请输入 3～256 字操作原因');
      const key = randomId();
      original.current = () => gateway.endAssetPlacement(placement.placement_id, placement.version, { reason: trimmed }, key);
    }
    let receipt: CabinetPlacementReceipt;
    try { receipt = await original.current(); }
    catch (error) {
      const failure = cabinetManagementFailure(error, true);
      setUncertain(failure.uncertain);
      if (!failure.uncertain) original.current = null;
      if (failure.refreshRequired) await queryClient.invalidateQueries({ queryKey: keys.domain('assets') });
      throw new Error(failure.message, { cause: error });
    }
    original.current = null; setUncertain(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.domain('assets') }),
      queryClient.invalidateQueries({ queryKey: keys.domain('cabinets') }),
      queryClient.invalidateQueries({ queryKey: ['cabinet-management'] }),
    ]);
    await onRemoved(receipt); setReason(initialReason);
  };
  const close = () => { if (uncertain) return; original.current = null; setReason(initialReason); onCancel(); };
  return <AdminFormDrawer visible={asset !== null} title="资产出柜" description="请确认资产已实际取出。提交后解除在柜关系，资产继续保持未上架。"
    form={form} values={{ reason }} theme="warning" confirmText={uncertain ? '用原请求核对' : '确认出柜'}
    dirty={reason !== initialReason} onCancel={close} onSubmit={submit}>
    {uncertain && <Alert theme="warning" message="出柜结果尚未确认，原请求与幂等键已保留。请用原请求核对，避免重复操作。" />}
    <FormSection title="核对资产与格口"><FormGrid columns={1}>
      <Form.FormItem label="资产"><Input readonly value={asset ? `${asset.displayName} · ${asset.assetNo}` : ''} /></Form.FormItem>
      <Form.FormItem label="当前格口"><Input readonly value={locationLabel} /></Form.FormItem>
      <Form.FormItem name="reason" label="操作原因" rules={[{ required: true, whitespace: true, message: '请输入操作原因' }]}>
        <Textarea disabled={uncertain} placeholder="请输入出柜原因" maxlength={256} autosize={{ minRows: 3, maxRows: 5 }} value={reason} onChange={setReason} />
      </Form.FormItem>
    </FormGrid></FormSection>
    <Alert theme="warning" message="确认出柜将撤销对应取件码并释放格口。此操作不发送开门指令，设备操作由管理员按现场情况执行。" />
  </AdminFormDrawer>;
}
