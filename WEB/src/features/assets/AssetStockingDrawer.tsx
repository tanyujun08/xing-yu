import { randomId } from '../../shared/randomId';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Form, Input, Select, Textarea } from 'tdesign-react';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type Asset } from '../../shared/services';
import { cabinetManagementFailure, type CabinetPlacementReceipt, type ManagedCabinet } from '../../shared/services/cabinetManagement';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { FormGrid } from '../../shared/ui/FormGrid';
import { FormSection } from '../../shared/ui/FormSection';

interface StockingFormState { [key: string]: unknown; cabinetId: string; compartmentId: string; reason: string }
const emptyForm: StockingFormState = { cabinetId: '', compartmentId: '', reason: '后台资产入柜' };

export function AssetStockingDrawer({ asset, onCancel, onPlaced }: {
  asset: Asset | null; onCancel: () => void; onPlaced: (receipt: CabinetPlacementReceipt) => void | Promise<void>;
}) {
  const services = useAdminServices();
  const queryKeys = useAdminQueryKeys();
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<StockingFormState>(emptyForm);
  const [uncertain, setUncertain] = useState(false);
  const request = useRef<(() => Promise<CabinetPlacementReceipt>) | null>(null);
  const form = Form.useForm()[0]!;
  const gateway = services.cabinetManagement;
  const cabinetsQuery = useQuery({
    queryKey: queryKeys.resource('cabinets', 'placement-eligible', asset?.lessorId),
    enabled: asset !== null && gateway !== undefined, retry: false,
    queryFn: async ({ signal }) => {
      const cabinets: ManagedCabinet[] = [];
      let cursor = '';
      do {
        const page = await gateway!.list({ cursor, lifecycle: 'ACTIVE', occupancy: 'AVAILABLE' }, { signal });
        cabinets.push(...page.items.filter((cabinet) => cabinet.responsible_lessor_id === asset?.lessorId));
        cursor = page.page.has_more ? page.page.next_cursor ?? '' : '';
        if (page.page.has_more && cursor === '') throw new Error('柜机分页游标缺失');
      } while (cursor !== '');
      return cabinets;
    },
  });
  const cabinet = cabinetsQuery.data?.find((item) => item.cabinet_id === formState.cabinetId);
  const options = useQuery({
    queryKey: queryKeys.resource('cabinets', 'placement-options', formState.cabinetId),
    enabled: asset !== null && gateway !== undefined && formState.cabinetId !== '', retry: false,
    queryFn: ({ signal }) => gateway!.stockingOptions(formState.cabinetId, {}, { signal }),
  });
  const compartments = (options.data?.slots ?? []).filter((slot) => slot.eligible);
  const submit = async () => {
    if (request.current === null) {
      if (!asset?.version || !gateway) throw new Error('资产版本或入柜能力不可用，请刷新后重试');
      const slot = compartments.find((item) => item.compartment_id === formState.compartmentId);
      if (!cabinet || !slot || !options.data?.cabinet_readiness.eligible) throw new Error('请选择当前可用的柜机格口');
      const reason = formState.reason.trim();
      if (reason.length < 3 || reason.length > 256) throw new Error('请输入 3～256 字操作原因');
      const key = randomId();
      request.current = () => gateway.placeAsset(asset.id, asset.version!, cabinet.cabinet_id, slot.compartment_id, reason, key);
    }
    let receipt: CabinetPlacementReceipt;
    try { receipt = await request.current(); }
    catch (error) {
      const result = cabinetManagementFailure(error, true);
      setUncertain(result.uncertain);
      if (!result.uncertain) request.current = null;
      if (result.refreshRequired) await options.refetch();
      throw new Error(result.message, { cause: error });
    }
    request.current = null; setUncertain(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('assets') }),
      queryClient.invalidateQueries({ queryKey: queryKeys.domain('cabinets') }),
      queryClient.invalidateQueries({ queryKey: ['cabinet-management'] }),
    ]);
    await onPlaced(receipt); setFormState(emptyForm);
  };
  const close = () => { if (uncertain) return; request.current = null; setFormState(emptyForm); onCancel(); };
  const address = cabinet?.address;
  return <AdminFormDrawer visible={asset !== null} title="资产入柜" description="选择实际放入的柜机与格口。入柜后仍保持未上架。"
    confirmText={uncertain ? '用原请求核对' : '确认入柜'} form={form} values={formState} size="complex"
    dirty={JSON.stringify(formState) !== JSON.stringify(emptyForm)} pending={cabinetsQuery.isLoading || options.isLoading}
    errorSummary={cabinetsQuery.isError ? '可用柜机加载失败，请刷新后重试。' : options.isError ? '格口加载失败，请重新选择柜机。' : undefined} onCancel={close} onSubmit={submit}>
    {uncertain && <Alert theme="warning" message="结果待核对，原请求与幂等键已保留。请用原请求核对，避免重复入柜。" />}
    <FormSection title="资产与柜机" description="仅限本商家所属、已下架且空闲的官方资产。"><FormGrid>
      <Form.FormItem label="资产"><Input readonly value={asset ? `${asset.displayName} · ${asset.assetNo}` : ''} /></Form.FormItem>
      <Form.FormItem name="cabinetId" label="目标柜机" rules={[{ required: true, message: '请选择目标柜机' }]}>
        <Select filterable disabled={uncertain} placeholder="选择有空闲格口的柜机" value={formState.cabinetId}
          options={(cabinetsQuery.data ?? []).map((item) => ({ label: `${item.cabinet_name} · 设备号 ${item.provider_device_id}`, value: item.cabinet_id }))}
          onChange={(value) => setFormState((current) => ({ ...current, cabinetId: String(value), compartmentId: '' }))} />
      </Form.FormItem>
      <Form.FormItem className="admin-form-grid__full" label="柜机地址（继承商家）"><Input readonly value={address ? `${address.province_name}${address.city_name}${address.district_name}${address.detail_address}` : '选择柜机后显示商家地址'} /></Form.FormItem>
      <Form.FormItem name="compartmentId" label="目标格口" rules={[{ required: true, message: '请选择空闲格口' }]}>
        <Select disabled={uncertain || formState.cabinetId === ''} placeholder={formState.cabinetId === '' ? '请先选择柜机' : '选择格口'} value={formState.compartmentId}
          options={compartments.map((slot) => ({ label: `BOX ${String(slot.compartment_no).padStart(2, '0')}`, value: slot.compartment_id }))}
          onChange={(value) => setFormState((current) => ({ ...current, compartmentId: String(value) }))} />
      </Form.FormItem>
    </FormGrid></FormSection>
    <FormSection title="投放说明" description="提交即确认资产已实际放入所选格口，设备物理操作由管理员按现场情况执行。"><FormGrid columns={1}>
      <Form.FormItem name="reason" label="操作原因" rules={[{ required: true, whitespace: true, message: '请输入操作原因' }]}>
        <Textarea maxlength={256} disabled={uncertain} autosize={{ minRows: 3, maxRows: 5 }} value={formState.reason} onChange={(reason) => setFormState((current) => ({ ...current, reason }))} />
      </Form.FormItem>
    </FormGrid></FormSection>
    <Alert theme="info" message="确认入柜后登记在柜关系并生成休眠取件码。资产仍未上架，需管理员点击上架后才对外开放。" />
  </AdminFormDrawer>;
}
