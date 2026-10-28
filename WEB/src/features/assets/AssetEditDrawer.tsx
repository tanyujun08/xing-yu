import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Form, Input, Select, Textarea } from 'tdesign-react';
import { useCommandSingleFlight } from '../../shared/commands/useCommandSingleFlight';
import { useAdminServices, type Asset, type UpdateAssetInput } from '../../shared/services';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { AdminNumberInput } from '../../shared/ui/AdminNumberInput';

export function AssetEditDrawer({ asset, onCancel, onSaved }: { asset: Asset; onCancel: () => void; onSaved: () => Promise<void> }) {
  const services = useAdminServices();
  const commands = useCommandSingleFlight();
  const form = Form.useForm()[0]!;
  const [value, setValue] = useState<UpdateAssetInput>({ assetId: asset.id, expectedVersion: asset.version ?? '', displayName: asset.displayName, condition: asset.condition, defectDescription: asset.defectDescription, accessoryDescription: asset.accessoryDescription, rentalType: asset.rentalType, unitPriceFen: asset.unitPriceFen, minimumUnits: asset.minimumUnits, depositFen: asset.depositFen, referenceValueFen: asset.referenceValueFen, changeReason: '' });
  const mutation = useMutation({ mutationFn: () => commands.run(asset.id, 'edit-official-asset', command => services.assets.update({ ...value, command })), onSuccess: onSaved });
  const change = <K extends keyof UpdateAssetInput>(field: K, next: UpdateAssetInput[K]) => setValue(current => ({ ...current, [field]: next }));
  const valid = value.displayName.trim() && value.condition.trim() && value.changeReason.trim() && [value.unitPriceFen, value.minimumUnits, value.referenceValueFen].every(n => Number.isSafeInteger(n) && n > 0) && Number.isSafeInteger(value.depositFen) && value.depositFen >= 0;
  return <AdminFormDrawer visible title="编辑官方资产" description={`资产 ${asset.assetNo} · ${asset.identifierValue}`} confirmText="保存资产新版本" form={form} values={{ ...value, unitPriceFen: value.unitPriceFen / 100, depositFen: value.depositFen / 100, referenceValueFen: value.referenceValueFen / 100 }} pending={mutation.isPending} submitBlocked={!valid} dirty onCancel={onCancel} onSubmit={() => mutation.mutateAsync().then(() => undefined)}>
    <Alert theme="info" message="保存后生成新的租赁条件版本并下架资产，请核对后重新上架。已有订单继续使用原快照，在柜关系与设备素材保留。" />
    <Form.FormItem name="displayName" label="资产名称" rules={[{ required: true }]}><Input aria-label="资产名称" maxlength={120} value={value.displayName} onChange={next => change('displayName', next)} /></Form.FormItem>
    <Form.FormItem name="condition" label="成色" rules={[{ required: true }]}><Input aria-label="成色" maxlength={80} value={value.condition} onChange={next => change('condition', next)} /></Form.FormItem>
    <Form.FormItem name="defectDescription" label="瑕疵说明"><Textarea aria-label="瑕疵说明" maxlength={2000} value={value.defectDescription} onChange={next => change('defectDescription', next)} /></Form.FormItem>
    <Form.FormItem name="accessoryDescription" label="配件说明"><Textarea aria-label="配件说明" maxlength={2000} value={value.accessoryDescription} onChange={next => change('accessoryDescription', next)} /></Form.FormItem>
    <Form.FormItem name="rentalType" label="租赁模式"><Select aria-label="租赁模式" value={value.rentalType} options={[{ value: 'HOUR', label: '按小时' }, { value: 'DAY', label: '按天' }]} onChange={next => change('rentalType', next === 'HOUR' ? 'HOUR' : 'DAY')} /></Form.FormItem>
    {([['unitPriceFen', '租金（元）'], ['depositFen', '押金（元）'], ['referenceValueFen', '参考价值（元）']] as const).map(([field, label]) => <Form.FormItem key={field} name={field} label={label} rules={[{ required: true }]}><AdminNumberInput aria-label={label} min={field === 'depositFen' ? 0 : 0.01} decimalPlaces={2} step={0.01} value={Number.isFinite(value[field]) ? value[field] / 100 : ''} onChange={next => change(field, next === '' || next === undefined ? Number.NaN : Math.round(Number(next) * 100))} /></Form.FormItem>)}
    <Form.FormItem name="minimumUnits" label={`最低租期（${value.rentalType === 'HOUR' ? '小时' : '天'}）`} rules={[{ required: true }]}><AdminNumberInput aria-label="最低租期" min={1} step={1} value={Number.isFinite(value.minimumUnits) ? value.minimumUnits : ''} onChange={next => change('minimumUnits', next === '' || next === undefined ? Number.NaN : Number(next))} /></Form.FormItem>
    <Form.FormItem name="changeReason" label="修改原因" rules={[{ required: true }]}><Textarea aria-label="修改原因" maxlength={500} value={value.changeReason} onChange={next => change('changeReason', next)} /></Form.FormItem>
  </AdminFormDrawer>;
}
