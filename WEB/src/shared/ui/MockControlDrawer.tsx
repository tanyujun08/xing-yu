import { useQueryClient } from '@tanstack/react-query';
import { Button, Drawer, MessagePlugin, Select, Space, Tag } from 'tdesign-react';
import {
  permissions,
  roleDefinitions,
  useSession,
  type DemoRole,
} from '../access/session';
import { demoAccountsByRole } from '../access/demoAccounts';
import type { MockFaultKind, MockFaultMode, MockLatencyMs } from '../mock/scenario';
import { useAdminServices, useMockScenario, type DemoScenarioName } from '../services';
import './MockControlDrawer.css';

interface MockControlDrawerProps {
  visible: boolean;
  onClose(): void;
}

const scenarioOptions = [
  { value: 'normal', label: '正常经营场景' },
  { value: 'cabinet-offline', label: '柜机离线场景' },
  { value: 'exceptions', label: '集中异常场景' },
];

const latencyOptions = [
  { value: 0, label: '即时响应' },
  { value: 300, label: '普通延迟 · 300ms' },
  { value: 1200, label: '高延迟 · 1200ms' },
];

const faultOptions: Array<{ value: MockFaultKind; label: string }> = [
  { value: 'NONE', label: '不注入故障' },
  { value: 'FORBIDDEN', label: '403 无权限' },
  { value: 'SERVER_ERROR', label: '503 服务错误' },
  { value: 'TIMEOUT', label: '请求超时' },
  { value: 'CONFLICT', label: '版本冲突' },
  { value: 'UNKNOWN', label: '结果未知' },
];

export function MockControlDrawer({ visible, onClose }: MockControlDrawerProps) {
  const scenario = useMockScenario();
  const session = useSession();
  const services = useAdminServices();
  const queryClient = useQueryClient();
  const role = session.role ?? 'SUPER_ADMIN';
  const canControlMock = session.hasPermission(permissions.mockControl);

  const clearAdminQueries = async () => {
    await queryClient.cancelQueries({ queryKey: ['admin'] });
    queryClient.removeQueries({ queryKey: ['admin'] });
  };

  const switchRole = async (nextRole: DemoRole) => {
    if (!canControlMock) return;
    if (session.role === null || nextRole === session.role) return;
    const previousRole = session.role;
    await services.sessionAudit.recordRoleSwitch({
      actorId: session.accountId ?? 'mock-anonymous',
      fromRole: previousRole,
      toRole: nextRole,
    });
    await clearAdminQueries();
    session.startSession(nextRole, session.loginMethod ?? 'PHONE');
    if (!roleDefinitions[nextRole].permissions.includes(permissions.mockControl)) onClose();
    await MessagePlugin.success(`已切换为${roleDefinitions[nextRole].label}`);
  };

  const resetScenario = async (scenarioName: DemoScenarioName) => {
    if (!canControlMock) return;
    scenario.resetScenario(scenarioName);
    await clearAdminQueries();
    const activeAccount = (await services.admins.list()).find((account) => account.id === demoAccountsByRole[role].accountId);
    if (activeAccount === undefined || activeAccount.status !== 'ACTIVE' || activeAccount.archivedAt !== null) {
      session.clearSession();
      onClose();
      await MessagePlugin.warning('场景重置后当前管理员不可用，请重新登录');
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    await MessagePlugin.success('Mock 场景已确定性重置');
  };

  const configure = (patch: Partial<{ latencyMs: MockLatencyMs; fault: MockFaultKind; faultMode: MockFaultMode }>) => {
    if (!canControlMock) return;
    scenario.configureBehavior({
      latencyMs: patch.latencyMs ?? scenario.behavior.latencyMs,
      fault: patch.fault ?? scenario.behavior.fault,
      faultMode: patch.faultMode ?? scenario.behavior.faultMode,
    });
  };

  if (!canControlMock) return null;

  return (
    <Drawer
      visible={visible}
      header="Mock 场景控制"
      size="440px"
      footer={false}
      onClose={onClose}
    >
      <div className="mock-control-drawer">
        <div className="mock-control-summary">
          <div>
            <span>当前场景</span>
            <strong>{scenarioOptions.find((option) => option.value === scenario.runtimeInfo.scenarioName)?.label}</strong>
          </div>
          <Tag theme={scenario.behavior.fault === 'NONE' ? 'success' : 'warning'} variant="light">
            {scenario.behavior.fault === 'NONE' ? '运行正常' : `故障：${scenario.behavior.fault}`}
          </Tag>
        </div>

        <section className="mock-control-section">
          <h3>数据与身份</h3>
          <label>
            <span>确定性数据场景</span>
            <Select
              value={scenario.runtimeInfo.scenarioName}
              options={scenarioOptions}
              onChange={(value) => void resetScenario(String(value) as DemoScenarioName)}
            />
          </label>
          <label>
            <span>当前管理员身份</span>
            <Select
              value={role}
              options={(Object.keys(roleDefinitions) as DemoRole[]).map((value) => ({
                value,
                label: `${roleDefinitions[value].label} · ${demoAccountsByRole[value].displayName}`,
              }))}
              onChange={(value) => void switchRole(String(value) as DemoRole)}
            />
          </label>
        </section>

        <section className="mock-control-section">
          <h3>请求行为</h3>
          <label>
            <span>响应延迟</span>
            <Select
              value={scenario.behavior.latencyMs}
              options={latencyOptions}
              onChange={(value) => configure({ latencyMs: Number(value) as MockLatencyMs })}
            />
          </label>
          <label>
            <span>故障类型</span>
            <Select
              value={scenario.behavior.fault}
              options={faultOptions}
              onChange={(value) => configure({ fault: String(value) as MockFaultKind })}
            />
          </label>
          <label>
            <span>注入次数</span>
            <Select
              value={scenario.behavior.faultMode}
              options={[{ value: 'ONCE', label: '仅下一次请求' }, { value: 'PERSISTENT', label: '持续到手动清除' }]}
              onChange={(value) => configure({ faultMode: String(value) as MockFaultMode })}
            />
          </label>
          <Button variant="outline" onClick={scenario.resetBehavior}>恢复正常请求行为</Button>
        </section>

        <section className="mock-control-section">
          <h3>演示时钟</h3>
          <p className="mock-control-clock">{scenario.runtimeInfo.now}</p>
          <Space>
            <Button variant="outline" onClick={() => scenario.advanceClock(60 * 60 * 1000)}>推进 1 小时</Button>
            <Button variant="outline" onClick={() => scenario.advanceClock(24 * 60 * 60 * 1000)}>推进 1 天</Button>
          </Space>
        </section>

        <p className="mock-control-notice">
          控制项只作用于当前 Mock 会话；写操作与结果未知不会自动重试。
        </p>
      </div>
    </Drawer>
  );
}
