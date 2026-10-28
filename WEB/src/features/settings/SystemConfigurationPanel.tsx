import { randomId } from '../../shared/randomId';
import { AdminDisclosure } from '../../shared/ui/AdminDisclosure';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Input, MessagePlugin, Select, Space, Tag } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { apiIntegrationEnabled } from '../../shared/config/env';
import { useAdminServices, type ConfigKey, type ConfigVersion } from '../../shared/services';
import type { ConfigValues } from '../../shared/services/contracts';
import { defaultConfigValues, configurationInput, configurationFailureMessage } from '../../shared/services/createIntegratedAdminServices';
import { TypedConfigurationFields } from './TypedConfigurationFields';
import { validConfigurationDraft, validMaterialUploadPolicy } from './configurationDraft';

const labels: Record<ConfigKey, string> = {
  'material.upload_policy': '素材上传策略',
  'identity.profile_policy': '用户资料策略',
  'sms.challenge_policy': '短信验证码策略',
};

function nextAction(version: ConfigVersion): 'validate' | 'approve' | 'publish' | null {
  if (version.status === 'DRAFT') return 'validate';
  if (version.status === 'VALIDATED') return 'approve';
  if (version.status === 'APPROVED') return 'publish';
  return null;
}

export function SystemConfigurationPanel() {
  const services = useAdminServices();
  const session = useSession();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKey = searchParams.get('config_key');
  const selectedKey: ConfigKey = requestedKey !== null && Object.hasOwn(labels, requestedKey) ? requestedKey as ConfigKey : 'material.upload_policy';
  const cursor = searchParams.get('config_cursor') ?? '';
  const setPage = (key: ConfigKey, nextCursor = '') => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('config_key', key);
      if (nextCursor === '') next.delete('config_cursor');
      else next.set('config_cursor', nextCursor);
      return next;
    });
    setSelectedID('');
  };
  const [reason, setReason] = useState('');
  const [values, setValues] = useState<ConfigValues>(() => structuredClone(defaultConfigValues));
  const [selectedID, setSelectedID] = useState('');
  const intents = useRef(new Map<string, string>());
  const intentKey = (body: unknown) => {
    const fingerprint = JSON.stringify([session.accountId, body]);
    let key = intents.current.get(fingerprint);
    if (key === undefined) { key = randomId(); intents.current.set(fingerprint, key); }
    return key;
  };
  const canRead = session.permissions.includes('ops.system_config.read');
  const canWrite = session.permissions.includes('ops.system_config.write');
  const enabled = apiIntegrationEnabled && session.accessToken !== null && canRead;
  const definitions = useQuery({ queryKey: ['system-config', session.accountId, 'definitions'], queryFn: ({ signal }) => services.systemConfig.listDefinitions({ signal }), enabled });
  const versions = useQuery({ queryKey: ['system-config', session.accountId, 'versions', selectedKey, cursor], queryFn: ({ signal }) => services.systemConfig.listVersions(selectedKey, cursor, { signal }), enabled });
  const effective = useQuery({ queryKey: ['system-config', session.accountId, 'effective'], queryFn: ({ signal }) => services.systemConfig.listEffective({ signal }), enabled });
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ['system-config'] });
  const create = useMutation({ mutationFn: () => { const input = configurationInput(selectedKey, values); return services.systemConfig.createVersion(input, reason.trim(), intentKey(['create', input, reason.trim()])); }, onSuccess: async () => { intents.current.clear(); await refresh(); await MessagePlugin.success('已创建强类型配置草案'); } });
  const transition = useMutation({ mutationFn: ({ version, action }: { version: ConfigVersion; action: 'validate' | 'approve' | 'publish' }) => services.systemConfig.transition(version, action, reason.trim(), intentKey([version.config_version_id, version.version, action, reason.trim()])), onSuccess: async () => { intents.current.clear(); await refresh(); await MessagePlugin.success('配置状态已更新'); } });
  if (!apiIntegrationEnabled) return null;
  if (session.accessToken === null) return <Alert theme="warning" message="API 联调模式已启用；完成后台手机号登录后才能读取和发布系统配置。" closeBtn={false} />;
  if (!canRead) return <Alert theme="warning" message="当前账户没有系统配置读取权限；不会使用演示角色推导 API 权限。" closeBtn={false} />;
  const latest = versions.data?.items.find((item) => item.config_version_id === selectedID) ?? versions.data?.items[0];
  const active = effective.data?.find((item) => item.config_key === selectedKey);
  const busy = create.isPending || transition.isPending;
  const failed = create.error ?? transition.error;
  const failureMessage = configurationFailureMessage(failed);
  const currentVersion = latest !== undefined && (selectedKey !== 'material.upload_policy' || latest.schema_version === 2 && validMaterialUploadPolicy(latest.value));
  const action = latest === undefined || !currentVersion ? null : nextAction(latest);
  return (
    <Card title="强类型系统配置（API 联调）" className="data-card">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space breakLine>
          {(definitions.data ?? Object.keys(labels).map((config_key) => ({ config_key }))).filter((definition) => Object.hasOwn(labels, definition.config_key)).map((definition) => {
            const key = definition.config_key as ConfigKey;
            return <Button tag="button" key={key} variant={selectedKey === key ? 'base' : 'outline'} disabled={busy} onClick={() => setPage(key)}>{labels[key]}</Button>;
          })}
        </Space>
        <Tag>{active === undefined ? '生效配置读取中' : active.source === 'DEFAULT_CODE' ? '当前生效：代码默认值（未发布）' : `当前生效：v${active.config_version?.version_no} / epoch ${active.effective_epoch}`}</Tag>
        {active === undefined ? null : <AdminDisclosure  title={<>查看当前生效值</>}><pre>{JSON.stringify(active.value, null, 2)}</pre></AdminDisclosure>}
        <TypedConfigurationFields selectedKey={selectedKey} values={values} onChange={setValues} disabled={!canWrite || busy} />
        <label>配置变更原因<Input value={reason} maxlength={256} disabled={busy} placeholder="填写本次变更原因（至少 3 个字符）" onChange={setReason} /></label>
        <label>配置版本（每页 20 条） <Select aria-label="配置版本" disabled={busy || versions.isFetching} value={latest?.config_version_id ?? ''} onChange={(value) => setSelectedID(String(value ?? ''))} options={(versions.data?.items ?? []).map((version) => ({ value: version.config_version_id, label: `v${version.version_no} · ${version.status}` }))} /></label>
        <Space>
          <Button tag="button" disabled={busy || versions.isFetching || cursor === ''} onClick={() => setPage(selectedKey)}>最新一页</Button>
          <Button tag="button" disabled={busy || versions.isFetching || !versions.data?.page.has_more || !versions.data.page.next_cursor} onClick={() => setPage(selectedKey, versions.data?.page.next_cursor)}>下一页版本</Button>
        </Space>
        <Space>
          <Button tag="button" theme="primary" disabled={!canWrite || [...reason.trim()].length < 3 || !validConfigurationDraft(selectedKey, values) || busy} loading={create.isPending} onClick={() => create.mutate()}>创建配置草案</Button>
          <Button tag="button" disabled={busy} onClick={() => { void refresh(); }}>刷新状态</Button>
          {latest !== undefined ? <Tag>v{latest.version_no} · {latest.status} · ETag v{latest.version}</Tag> : <Tag variant="outline">尚无版本</Tag>}
          {latest?.publication_mode === 'SUPER_ADMIN_SELF' ? <Tag theme="primary" variant="light">超管本人审批</Tag> : null}
          {latest !== undefined && action !== null ? <Button tag="button" disabled={busy || [...reason.trim()].length < 3 || !session.permissions.includes(`ops.system_config.${action === 'validate' ? 'write' : action}`) || action === 'approve' && latest.created_by === session.accountId && !session.roles?.includes('ops.super_admin')} loading={transition.isPending} onClick={() => transition.mutate({ version: latest, action })}>{action === 'validate' ? '校验' : action === 'approve' ? '审批' : '发布'}</Button> : null}
          {latest === undefined ? null : <Button tag="button" disabled={!canWrite || busy || !currentVersion} onClick={() => { if (currentVersion) setValues({ ...values, [selectedKey]: structuredClone(latest.value) } as ConfigValues); }}>复制所选内容到草案表单</Button>}
        </Space>
        <p>复制历史内容仍须新建版本、校验、审批并发布。普通管理员须由另一位管理员审批；有审批权限的超级管理员可以审批本人创建的版本，系统会记录审批依据。</p>
        {definitions.isError || versions.isError || effective.isError ? <Alert theme="error" message="系统配置 API 读取失败，未回退成发布值。请检查登录权限与 API 候选状态。" closeBtn={false} /> : null}
        {failed === null ? null : <Alert theme="error" message={failureMessage} closeBtn={false} />}
        <pre className="settings-api-preview">{latest === undefined ? '暂无版本数据' : JSON.stringify(latest.value, null, 2)}</pre>
      </Space>
    </Card>
  );
}
