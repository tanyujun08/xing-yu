import { Button } from 'tdesign-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  DemoError,
  assertDemoEnvironment,
  readDemoBootEnvironment,
  type DemoBootEnvironment,
} from '../demo';
import { createDemoRuntime, type DemoRuntime } from '../mock';
import { MockBehaviorController } from '../mock/scenario';
import { DEFAULT_DEMO_STORAGE_KEY } from '../mock';
import { createMockAdminServices } from './createDemoServices';
import { AdminServicesProvider } from './AdminServicesProvider';
import { MockScenarioProvider } from './MockScenarioContext';
import { AdminActionConfirm } from '../ui/AdminActionConfirm';
import {
  preserveDemoBytesBeforeReset,
  resolveRecoverableDemoBackupVersion,
} from './migrationRecovery';
import './DemoServicesProvider.css';
import { apiIntegrationEnabled, publicEnv } from '../config/env';
import { useSession } from '../access/session';
import { createApiClient } from '../api/client';
import { createIntegratedAdminServices } from './createIntegratedAdminServices';
import { previewMembers, previewDossier, previewDashboard } from '../../preview/engine';

export interface MockAdminServicesProviderProps {
  children: ReactNode;
  runtime?: DemoRuntime;
  environment?: DemoBootEnvironment;
}

interface MigrationBlockedStateProps {
  error: DemoError;
  expectedRawBytes?: string | null;
}

interface MigrationBlockedCopy {
  title: string;
  summary: string;
  recordLabel: string;
  recordValue: string;
  nextStep: string;
}

type RuntimeBootState =
  | { status: 'ready'; runtime: DemoRuntime }
  | { status: 'migration-blocked'; error: DemoError; expectedRawBytes: string | null };

function isMigrationBlockedError(error: unknown): error is DemoError {
  return (
    error instanceof DemoError &&
    error.code === 'PERSISTENCE_INVALID' &&
    error.details.migrationBlocked === true
  );
}

function initializeRuntime(runtime: DemoRuntime | undefined): RuntimeBootState {
  const expectedRawBytes = runtime === undefined && typeof window !== 'undefined'
    ? window.localStorage.getItem(DEFAULT_DEMO_STORAGE_KEY)
    : null;
  try {
    return { status: 'ready', runtime: runtime ?? createDemoRuntime() };
  } catch (error) {
    if (isMigrationBlockedError(error)) {
      return { status: 'migration-blocked', error, expectedRawBytes };
    }
    throw error;
  }
}

function detailString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function migrationBlockedCopy(error: DemoError): MigrationBlockedCopy {
  return {
    title: '旧版本地数据需要人工确认',
    summary: '检测到无法安全自动归一的旧版数据关系，系统已暂停升级。',
    recordLabel: '阻断原因',
    recordValue: error.message,
    nextStep: '由项目维护人员根据阻断原因修复旧版数据关系后，再重新进入管理后台',
  };
}

export function MigrationBlockedState({ error, expectedRawBytes = null }: MigrationBlockedStateProps) {
  const copy = migrationBlockedCopy(error);
  const [resetError, setResetError] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const migrationKind = detailString(error.details.migrationKind);
  const backupVersion = resolveRecoverableDemoBackupVersion(migrationKind);
  const canResetDemo = backupVersion !== null && expectedRawBytes !== null;

  const resetToCurrentDemo = () => {
    try {
      if (backupVersion === null || expectedRawBytes === null) throw new Error('当前迁移阻断不允许重置演示数据');
      preserveDemoBytesBeforeReset(
        window.localStorage,
        DEFAULT_DEMO_STORAGE_KEY,
        backupVersion,
        expectedRawBytes,
      );
      window.localStorage.removeItem(DEFAULT_DEMO_STORAGE_KEY);
      window.location.reload();
    } catch (resetFailure) {
      setResetConfirmOpen(false);
      setResetError(resetFailure instanceof Error ? resetFailure.message : '演示数据重置失败');
    }
  };

  return (
    <main className="demo-migration-blocked" aria-labelledby="demo-migration-blocked-title">
      <section className="demo-migration-blocked__card">
        <p className="demo-migration-blocked__eyebrow">本地数据迁移已暂停</p>
        <h1 id="demo-migration-blocked-title">{copy.title}</h1>
        <p>{copy.summary}</p>
        <dl className="demo-migration-blocked__facts">
          <div>
            <dt>{copy.recordLabel}</dt>
            <dd>{copy.recordValue}</dd>
          </div>
          <div>
            <dt>系统判断</dt>
            <dd>{error.message}</dd>
          </div>
          <div>
            <dt>原始数据</dt>
            <dd>已完整保留，系统未迁移、未覆盖</dd>
          </div>
          <div>
            <dt>下一步</dt>
            <dd>{copy.nextStep}</dd>
          </div>
        </dl>
        <p className="demo-migration-blocked__notice">
          {canResetDemo ? '只有确认不再沿用这份旧版本地数据后，才可重置演示数据。' : '请勿清除浏览器站点数据，以免丢失待确认的旧版记录。'}
        </p>
        {canResetDemo ? (
          <div className="demo-migration-blocked__actions">
            <Button variant="text" tag="button" type="button" onClick={() => setResetConfirmOpen(true)}>重置为 v1.0.0.10 演示数据</Button>
            {resetError === '' ? null : <span role="alert">{resetError}</span>}
          </div>
        ) : null}
      </section>
      <AdminActionConfirm
        visible={resetConfirmOpen}
        title="确认重置本地演示数据"
        objectLabel="当前浏览器的旧版 Mock 数据"
        actionLabel="保留原始备份后重建 v1.0.0.10 数据"
        impact="只有确认不再沿用这份旧版本地数据后才可继续。系统会先按原 Schema 版本校验并保留原始字节备份，再移除当前 Mock 数据。"
        recoverable
        currentState="迁移已阻断"
        targetState="v1.0.0.10 确定性演示数据"
        confirmText="确认备份并重置"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={resetToCurrentDemo}
      />
    </main>
  );
}

export function MockAdminServicesProvider({ children, runtime, environment }: MockAdminServicesProviderProps) {
  return apiIntegrationEnabled ? <ApiAdminServicesProvider>{children}</ApiAdminServicesProvider> : <DemoOnlyAdminServicesProvider {...(runtime === undefined ? {} : { runtime })} {...(environment === undefined ? {} : { environment })}>{children}</DemoOnlyAdminServicesProvider>;
}

function ApiAdminServicesProvider({ children }: { children: ReactNode }) {
  const { accessToken, invalidateAccessToken, revalidateAccessToken } = useSession();
  const services = useMemo(() => {
    const token = accessToken;
    const integrated = createIntegratedAdminServices(createApiClient({
      baseURL: publicEnv.apiBaseURL, getAccessToken: () => token,
      onUnauthorized: () => invalidateAccessToken(token),
      onForbidden: () => { void revalidateAccessToken(token); },
    }));
    const legacy = createMockAdminServices(createDemoRuntime());
    return { ...legacy, ...integrated, runtime: legacy.runtime, dashboard: {getSummary: async () => previewDashboard()},
      stars: legacy.stars, audit: legacy.audit, sessionAudit: legacy.sessionAudit,
      rules: legacy.rules, loyalty: legacy.loyalty, members: {
        list: async () => { const rows = await legacy.members.list(); return previewMembers(rows[0]!); },
        getDossier: async (id: string) => { const rows = await legacy.members.list(); return previewDossier(await legacy.members.getDossier(rows[0]!.userId), id); },
      } };
  }, [accessToken, invalidateAccessToken, revalidateAccessToken]);
  return <AdminServicesProvider services={services}>{children}</AdminServicesProvider>;
}

function DemoOnlyAdminServicesProvider({ children, runtime, environment }: MockAdminServicesProviderProps) {
  assertDemoEnvironment(environment ?? readDemoBootEnvironment());
  const [bootState] = useState<RuntimeBootState>(() => initializeRuntime(runtime));
  const [behaviorController] = useState(() => new MockBehaviorController());
  const services = useMemo(
    () => bootState.status === 'ready' ? createMockAdminServices(bootState.runtime, behaviorController) : null,
    [behaviorController, bootState],
  );
  if (bootState.status === 'migration-blocked') {
    return <MigrationBlockedState error={bootState.error} expectedRawBytes={bootState.expectedRawBytes} />;
  }
  if (services === null) {
    throw new Error('MockAdminServicesProvider failed to initialize services');
  }
  return (
    <MockScenarioProvider runtime={bootState.runtime} behaviorController={behaviorController}>
      <AdminServicesProvider services={services}>{children}</AdminServicesProvider>
    </MockScenarioProvider>
  );
}
