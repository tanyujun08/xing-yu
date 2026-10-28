import { randomId } from '../../shared/randomId';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Checkbox, Form, Input, MessagePlugin } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { configurationFailureMessage, isDefinitiveSettingsRejection } from '../../shared/services/createIntegratedAdminServices';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type IAMRoleProjection } from '../../shared/services';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { PERMISSION_LABELS } from './settingsProjections';

interface Intent { role: IAMRoleProjection; permissions: string[]; reason: string; key: string }

export function RolePermissionsEditor({ role, onClose }: { role: IAMRoleProjection; onClose: () => void }) {
  const services = useAdminServices();
  const session = useSession();
  const queryClient = useQueryClient();
  const queryKeys = useAdminQueryKeys();
  const form = Form.useForm()[0]!;
  const [selected, setSelected] = useState([...role.permissions]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const intent = useRef<Intent | null>(null);
  const [frozen, setFrozen] = useState(false);
  const options = [...new Set([...session.permissions, ...role.permissions])].sort().map((value) => ({ value, label: PERMISSION_LABELS[value] ?? value, disabled: !session.permissions.includes(value) }));
  const save = useMutation({
    mutationFn: async () => {
      if (services.iam?.replaceRolePermissions === undefined) throw new Error('角色权限服务不可用');
      const request = intent.current ?? { role, permissions: [...selected].sort(), reason: reason.trim(), key: randomId() };
      intent.current = request;
      setFrozen(true);
      return services.iam.replaceRolePermissions(request.role, request.permissions, request.reason, request.key);
    },
    onSuccess: async () => {
      intent.current = null;
      await queryClient.invalidateQueries({ queryKey: queryKeys.domain('iam') });
      await session.revalidateAccessToken(session.accessToken);
      await MessagePlugin.success('角色权限已保存');
      onClose();
    },
    onError: (failure) => {
      if (isDefinitiveSettingsRejection(failure)) {
        intent.current = null;
        setFrozen(false);
        setError(configurationFailureMessage(failure));
      } else {
        setError('尚未确认保存结果。内容已保留，请重试原请求。');
      }
    },
  });
  return <AdminFormDrawer visible title="配置角色权限" description="权限保存后生效。服务端会校验授权范围，并保护最后一个有效管理身份。" confirmText={frozen ? '重试原请求' : '保存权限'} form={form!} values={{ reason }} pending={save.isPending} dirty errorSummary={error} onSubmit={() => save.mutate()} onCancel={() => { if (!frozen) onClose(); }}>
      <Form.FormItem label="权限范围">
        <Checkbox.Group options={options} value={selected} disabled={frozen} onChange={(values) => setSelected(values.map(String))} />
      </Form.FormItem>
      <Form.FormItem label="修改原因" name="reason" rules={[{ required: true, message: '请填写修改原因' }, { min: 3, message: '原因至少 3 个字' }]}>
        <Input ref={(control) => { control?.inputElement.setAttribute('aria-label', '修改原因'); }} value={reason} maxlength={256} disabled={frozen} onChange={setReason} />
      </Form.FormItem>
  </AdminFormDrawer>;
}
