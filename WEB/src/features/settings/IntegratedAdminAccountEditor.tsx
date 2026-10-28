import { randomId } from '../../shared/randomId';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, Input, Select, MessagePlugin } from 'tdesign-react';
import { useAdminServices, type IAMAccountProjection, type IAMRoleProjection } from '../../shared/services';
import { configurationFailureMessage, isDefinitiveSettingsRejection } from '../../shared/services/createIntegratedAdminServices';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';

import { opsRoleLabels } from './opsRoles';
type Intent = { account: IAMAccountProjection | null; name: string; phone: string; roleID: string; status: 'ACTIVE' | 'DISABLED'; reason: string; key: string };

export function IntegratedAdminAccountEditor({ account, roles, onClose }: { account: IAMAccountProjection | null; roles: readonly IAMRoleProjection[]; onClose: () => void }) {
  const services = useAdminServices();
  const client = useQueryClient();
  const keys = useAdminQueryKeys();
  const form = Form.useForm()[0]!;
  const [name, setName] = useState(account?.display_name ?? '');
  const [phone, setPhone] = useState('');
  const [roleID, setRoleID] = useState(roles.find((role) => account?.roles.includes(role.role_code))?.role_id ?? '');
  const [status, setStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');
  const [reason, setReason] = useState('');
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intent = useRef<Intent | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      if (!services.iam?.accounts) throw new Error('管理员服务不可用');
      if (intent.current === null) {
        const normalized = phone.trim();
        if (name.trim() === '' || roleID === '' || reason.trim().length < 3 || (account === null || normalized !== '') && !/^(?:\+86)?1\d{10}$/.test(normalized)) throw new Error('请填写姓名、角色、有效手机号和至少 3 个字的原因');
        intent.current = { account, name: name.trim(), phone: normalized, roleID, status, reason: reason.trim(), key: randomId() };
      }
      const request = intent.current;
      setFrozen(true);
      const common = { display_name: request.name, role_ids: [request.roleID], reason: request.reason };
      return request.account === null
        ? services.iam.accounts.create({ ...common, phone: request.phone, status: request.status, scopes: [{ type: 'PLATFORM', id: 'platform' }] }, request.key)
        : services.iam.accounts.update(request.account, { ...common, ...(request.phone === '' ? {} : { phone: request.phone }) }, request.key);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.domain('iam') });
      await MessagePlugin.success('管理员已保存');
      onClose();
    },
    onError: (failure) => {
      if (intent.current === null || isDefinitiveSettingsRejection(failure)) {
        intent.current = null; setFrozen(false);
        setError(failure instanceof Error && !isDefinitiveSettingsRejection(failure) ? failure.message : configurationFailureMessage(failure));
      } else setError('保存结果尚未确认，内容已保留，请重试原请求。');
    },
  });
  return <AdminFormDrawer visible title={account === null ? '新增管理员' : '编辑管理员'} description="后台手机号无需验证且必须唯一；首次手机号登录后绑定微信。" confirmText={frozen ? '重试原请求' : '保存管理员'} form={form} values={{ name, phone, roleID, status, reason }} pending={save.isPending} dirty errorSummary={error} onSubmit={() => save.mutate()} onCancel={() => { if (!frozen) onClose(); }}>
    <Form.FormItem name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input value={name} maxlength={64} disabled={frozen} onChange={setName} /></Form.FormItem>
    <Form.FormItem name="phone" label="手机号" help={account === null ? '同一手机号只能关联一个后台身份。' : `当前 ${account.phone_masked ?? '未配置'}，留空保留原号码。`} rules={account === null ? [{ required: true, message: '请输入手机号' }] : []}><Input value={phone} disabled={frozen} onChange={setPhone} /></Form.FormItem>
    <Form.FormItem name="roleID" label="角色" rules={[{ required: true, message: '请选择角色' }]}><Select value={roleID} disabled={frozen} options={roles.filter((role) => role.status === 'ACTIVE').map((role) => ({ value: role.role_id, label: opsRoleLabels[role.role_code] ?? role.role_code }))} onChange={(value) => setRoleID(String(value))} /></Form.FormItem>
    {account === null && <Form.FormItem name="status" label="状态"><Select value={status} disabled={frozen} options={[{ value: 'ACTIVE', label: '正常' }, { value: 'DISABLED', label: '已禁用' }]} onChange={(value) => setStatus(value === 'DISABLED' ? 'DISABLED' : 'ACTIVE')} /></Form.FormItem>}
    <Form.FormItem name="reason" label="修改原因" rules={[{ required: true, min: 3, message: '原因至少 3 个字' }]}><Input value={reason} maxlength={256} disabled={frozen} onChange={setReason} /></Form.FormItem>
  </AdminFormDrawer>;
}
