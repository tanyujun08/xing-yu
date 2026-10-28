import { randomId } from '../../shared/randomId';
import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox, Alert, Button, Card, Form, Input, Space, Tag } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';
import { configurationFailureMessage, isDefinitiveSettingsRejection, isConfigurationEpochConflict } from '../../shared/services/createIntegratedAdminServices';
import type { BusinessEffective, BusinessInput, BusinessKey, BusinessPolicies } from '../../shared/services/businessConfiguration';
import { formatUTC } from '../../shared/format/time';
import { businessConfigurationFieldErrors } from '../../shared/services/businessConfiguration';

// Keep an unresolved write across route changes. Account and configuration
// keys prevent a different operator or editor from consuming this intent.
const unresolved = new Map<string, { body: BusinessInput; key: string }>();

interface Props<K extends BusinessKey> {
  configKey: K; title: string; description: string;
  initial: (current: BusinessEffective | undefined) => BusinessPolicies[K];
  reviewNotes?: (current: BusinessEffective | undefined) => string[];
  valid: (value: BusinessPolicies[K]) => boolean;
  children: (value: BusinessPolicies[K], change: (value: BusinessPolicies[K]) => void, errors: Record<string, string>) => ReactNode;
}
export function BusinessConfigEditor<K extends BusinessKey>(props: Props<K>) {
  const session = useSession();
  const gateway = useAdminServices().businessConfig;
  const allowed = session.permissions.includes('ops.system_config.read');
  const query = useQuery({ queryKey: ['business-config', session.accountId, 'effective'], enabled: allowed && gateway !== undefined, queryFn: ({ signal }) => { if (!gateway) throw new Error('业务配置 API 未接入'); return gateway.effective(signal); }, retry: false });
  if (!allowed) return <Alert theme="warning" message="当前账号没有配置读取权限" />;
  if (!gateway) return <Alert theme="warning" message="请切换至 API 环境后配置业务规则" />;
  if (query.isPending) return <p role="status">正在读取配置…</p>;
  if (query.isError) return <Alert theme="error" message="配置读取失败" operation={<Button onClick={() => void query.refetch()}>重新加载</Button>} />;
  const current = query.data.find((row) => row.config_key === props.configKey);
  return <BusinessConfigForm key={`${session.accountId}:${props.configKey}`} {...props} current={current} />;
}
function BusinessConfigForm<K extends BusinessKey>({ current, ...props }: Props<K> & { current: BusinessEffective | undefined }) {
  const session = useSession();
  const gateway = useAdminServices().businessConfig;
  const queryClient = useQueryClient();
  const intentScope = `${session.accountId}:${props.configKey}`;
  const [value, setValue] = useState(() => structuredClone(unresolved.get(intentScope)?.body.value ?? props.initial(current)) as BusinessPolicies[K]);
  const [reason, setReason] = useState(() => unresolved.get(intentScope)?.body.reason ?? '');
  const [expectedEpoch, setExpectedEpoch] = useState(() => unresolved.get(intentScope)?.body.expected_epoch ?? current?.effective_epoch ?? 0);
  const epochChanged = expectedEpoch !== (current?.effective_epoch ?? 0);
  const [uncertain, setUncertain] = useState(() => unresolved.has(intentScope));
  const [reviewed, setReviewed] = useState(() => unresolved.has(intentScope));
  const notes = props.reviewNotes?.(current) ?? [];
  const valid = props.valid(value) && (notes.length === 0 || reviewed);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cursor, setCursor] = useState('');
  const intent = useRef<{ body: BusinessInput; key: string } | null>(unresolved.get(intentScope) ?? null);
  const history = useQuery({ queryKey: ['business-config', session.accountId, 'versions', props.configKey, cursor], enabled: historyOpen, queryFn: ({ signal }) => { if (!gateway) throw new Error('业务配置 API 未接入'); return gateway.versions(props.configKey, cursor, signal); }, retry: false });
  const save = useMutation({
    mutationFn: () => {
      if (!gateway) throw new Error('业务配置 API 未接入');
      intent.current ??= { key: randomId(), body: { config_key: props.configKey, schema_version: value.schema_version, expected_epoch: expectedEpoch, value: structuredClone(value), reason: reason.trim() } };
      unresolved.set(intentScope, intent.current);
      return gateway.publish(intent.current.body, intent.current.key);
    },
    onSuccess: async () => { unresolved.delete(intentScope); intent.current = null; setUncertain(false); await queryClient.invalidateQueries({ queryKey: ['business-config', session.accountId] }); const rows = queryClient.getQueryData<BusinessEffective[]>(['business-config', session.accountId, 'effective']); const fresh = rows?.find((row) => row.config_key === props.configKey); if (fresh) { setExpectedEpoch(fresh.effective_epoch ?? 0); setValue(structuredClone(fresh.value) as BusinessPolicies[K]); } },
    onError: (error) => { const unknown = !isDefinitiveSettingsRejection(error); setUncertain(unknown); if (!unknown) { unresolved.delete(intentScope); intent.current = null; } if (isConfigurationEpochConflict(error)) void queryClient.invalidateQueries({ queryKey: ['business-config', session.accountId] }); },
  });
  const editable = session.permissions.includes('ops.business_config.publish');
  const fieldErrors = businessConfigurationFieldErrors(save.error);
  const locked = !editable || save.isPending || uncertain;
  return <Card title={props.title}>
    <p>{props.description}</p>
    <Space><Tag>{current?.config_version ? `生效版本 v${current.config_version.version_no}` : '尚未配置'}</Tag>{current?.published_at ? <span>保存于 {formatUTC(current.published_at)}</span> : null}</Space>
    {epochChanged && !uncertain ? <Alert theme="warning" message="生效配置已变化，当前草稿已保留。请核对最新版本后再确认保存。" operation={<Button onClick={() => setExpectedEpoch(current?.effective_epoch ?? 0)}>已核对最新版本，继续编辑草稿</Button>} /> : null}
    <Form labelAlign="top" onSubmit={() => { if (editable && !save.isPending && (uncertain || !epochChanged && reason.trim().length >= 3 && valid)) save.mutate(); }}>
      <fieldset disabled={locked} style={{ border: 0, padding: '16px 0' }}>{props.children(value, setValue, fieldErrors)}
        {notes.length > 0 ? <section aria-label="旧规则调整确认"><Alert theme="warning" message="保存新版本会停止以下旧规则，历史版本及已发奖励仍保留。" /><ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul><Checkbox  checked={reviewed} onChange={(nextValue) => setReviewed(nextValue)}>我已核对并确认停止这些旧规则</Checkbox></section> : null}
        <Form.FormItem requiredMark><label>变更原因<Input value={reason} onChange={setReason} maxlength={256} disabled={locked} placeholder="至少填写 3 个字符" /></label></Form.FormItem>
      </fieldset>
      <Space>
        <Button tag="button" type="submit" theme="primary" loading={save.isPending} disabled={!editable || save.isPending || !uncertain && (epochChanged || reason.trim().length < 3 || !valid)}>{uncertain ? '重试原保存请求' : '保存并立即生效'}</Button>
        <Button disabled={save.isPending || uncertain} onClick={() => void queryClient.invalidateQueries({ queryKey: ['business-config', session.accountId] })}>刷新生效配置</Button>
        <Button onClick={() => setHistoryOpen(!historyOpen)}>版本记录</Button>
      </Space>
    </Form>
    {save.isError ? <Alert theme="error" message={configurationFailureMessage(save.error)} /> : null}
    {uncertain ? <p role="status">保存结果尚未确认，已保留原内容和请求编号；请重试原请求。</p> : null}
    {save.isSuccess ? <p role="status">配置已保存并生效</p> : null}
    {historyOpen ? <section aria-label="配置版本记录">
      {history.isError ? <Alert theme="error" message="版本记录读取失败" operation={<Button onClick={() => void history.refetch()}>重试</Button>} /> : null}
      {history.isPending ? <p>正在加载版本…</p> : null}
      <ul>{history.data?.items.map((row) => <li key={row.config_version_id}>v{row.version_no} · {row.status} · {row.reason} · {formatUTC(row.created_at)}</li>)}</ul>
      <Button disabled={history.isFetching || cursor === ''} onClick={() => setCursor('')}>最新一页</Button>
      <Button disabled={history.isFetching || !history.data?.page.has_more} onClick={() => setCursor(history.data?.page.next_cursor ?? '')}>下一页</Button>
    </section> : null}
  </Card>;
}
