import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { demoAccountsByRole } from './demoAccounts';
import { apiIntegrationEnabled, publicEnv } from '../config/env';
import { createOpsAuthenticationClient, type OpsChallenge, type OpsWechatChallenge, type OpsWechatBinding } from '../services/opsAuthentication';
import { ApiSessionStore, canAccessApiPath, firstApiPath, hasApiPermission } from './apiSession';

export type DemoRole = 'SUPER_ADMIN' | 'OPERATIONS' | 'AFTER_SALES' | 'FINANCE';
export type DemoLoginMethod = 'PHONE' | 'MINIPROGRAM_QR';

export const permissions = Object.freeze({
  dashboardView: 'dashboard.view',
  merchantView: 'merchant.view',
  merchantManage: 'merchant.manage',
  cabinetView: 'cabinet.view',
  cabinetManage: 'cabinet.manage',
  catalogView: 'catalog.view',
  catalogManage: 'catalog.manage',
  catalogReview: 'catalog.review',
  assetView: 'asset.view',
  assetManage: 'asset.manage',
  assetReview: 'asset.review',
  assetDeploy: 'asset.deploy',
  orderView: 'order.view',
  memberView: 'member.view',
  memberSensitiveRead: 'member.sensitive.read',
  memberManage: 'member.manage',
  financeView: 'finance.view',
  financeManage: 'finance.manage',
  systemView: 'system.view',
  systemManage: 'system.manage',
  mockControl: 'mock.control',
} as const);

const allPermissions = Object.freeze(Object.values(permissions));

export const roleDefinitions: Readonly<Record<DemoRole, { label: string; permissions: readonly string[] }>> =
  Object.freeze({
    SUPER_ADMIN: { label: '超级管理员', permissions: allPermissions },
    OPERATIONS: {
      label: '运营人员',
      permissions: [
        permissions.dashboardView,
        permissions.merchantView,
        permissions.merchantManage,
        permissions.cabinetView,
        permissions.cabinetManage,
        permissions.catalogView,
        permissions.catalogManage,
        permissions.catalogReview,
        permissions.assetView,
        permissions.assetManage,
        permissions.assetReview,
        permissions.assetDeploy,
        permissions.orderView,
        permissions.memberView,
        permissions.mockControl,
      ],
    },
    AFTER_SALES: {
      label: '售后人员',
      permissions: [
        permissions.dashboardView,
        permissions.cabinetView,
        permissions.assetView,
        permissions.orderView,
        permissions.memberView,
      ],
    },
    FINANCE: {
      label: '财务人员',
      permissions: [
        permissions.dashboardView,
        permissions.merchantView,
        permissions.orderView,
        permissions.memberView,
        permissions.financeView,
        permissions.financeManage,
      ],
    },
  });

export interface SessionProjection {
  wechatBinding?: OpsWechatBinding;
  status: 'anonymous' | 'authenticated';
  accessToken: string | null;
  accountId: string | null;
  displayName: string | null;
  role: DemoRole | null;
  roleLabel: string | null;
  loginMethod: DemoLoginMethod | null;
  permissions: readonly string[];
  expiresAt: string | null;
  roles?: readonly string[];
  scopes?: readonly { type: string; id: string }[];
}

interface SessionContextValue extends SessionProjection {
  replaceSession: (next: SessionProjection) => void;
  startSession: (role: DemoRole, loginMethod: DemoLoginMethod) => void;
  clearSession: () => void;
  hasPermission: (permission: string) => boolean;
  canAccessPath: (path: string) => boolean;
  apiMode: boolean;
  restoring: boolean;
  sessionError: string | null;
  canRetryRefresh: boolean;
  landingPath: string;
  createPhoneChallenge: (phone: string, key: string) => Promise<OpsChallenge>;
  loginPhone: (challenge: string, proof: string, key: string) => Promise<void>;
  createWechatChallenge: (purpose: 'LOGIN' | 'BIND', key: string) => Promise<OpsWechatChallenge>;
  readWechatChallenge: (purpose: 'LOGIN' | 'BIND', id: string, poll: string) => Promise<OpsWechatChallenge>;
  loginWechat: (id: string, poll: string, key: string) => Promise<void>;
  retryRefresh: () => Promise<void>;
  invalidateAccessToken: (token: string | null) => void;
  revalidateAccessToken: (token: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

const SESSION_STORAGE_KEY = 'xingyu-admin.mock-session.v1';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const anonymousSession: SessionProjection = {
  status: 'anonymous',
  accessToken: null,
  accountId: null,
  displayName: null,
  role: null,
  roleLabel: null,
  loginMethod: null,
  permissions: [],
  expiresAt: null,
};

const SessionContext = createContext<SessionContextValue | null>(null);

function isDemoRole(value: unknown): value is DemoRole {
  return value === 'SUPER_ADMIN' || value === 'OPERATIONS' || value === 'AFTER_SALES' || value === 'FINANCE';
}

function readStoredSession(): SessionProjection {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return anonymousSession;
    const parsed = JSON.parse(raw) as Partial<SessionProjection>;
    if (
      parsed.status !== 'authenticated' ||
      !isDemoRole(parsed.role) ||
      typeof parsed.expiresAt !== 'string' ||
      Date.parse(parsed.expiresAt) <= Date.now()
    ) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return anonymousSession;
    }
    const definition = roleDefinitions[parsed.role];
    return {
      status: 'authenticated',
      accessToken: typeof parsed.accessToken === 'string' && parsed.accessToken !== '' ? parsed.accessToken : null,
      accountId: typeof parsed.accountId === 'string' ? parsed.accountId : demoAccountsByRole[parsed.role].accountId,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : definition.label,
      role: parsed.role,
      roleLabel: definition.label,
      loginMethod: parsed.loginMethod === 'MINIPROGRAM_QR' ? 'MINIPROGRAM_QR' : 'PHONE',
      permissions: definition.permissions,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return anonymousSession;
  }
}

export function readCurrentSessionProjection(): SessionProjection {
  return apiIntegrationEnabled || typeof window === 'undefined' ? anonymousSession : readStoredSession();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return apiIntegrationEnabled ? <ApiSessionProvider>{children}</ApiSessionProvider> : <MockSessionProvider>{children}</MockSessionProvider>;
}

const unavailableAuthentication = async (): Promise<never> => { throw new Error('演示模式不调用认证 API'); };
const rejectDemoSession = (): never => { throw new Error('API 模式不接受演示身份或本地权限投影'); };

function ApiSessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new ApiSessionStore(createOpsAuthenticationClient(publicEnv.apiBaseURL), window.sessionStorage));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    void store.restore();
    const focus = () => { void store.revalidate(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [store]);
  useEffect(() => {
    if (state.projection.expiresAt === null) return;
    const remaining = Math.max(0, Date.parse(state.projection.expiresAt) - Date.now());
    const delay = remaining - Math.min(30_000, remaining / 10);
    const timer = window.setTimeout(() => { void store.refresh(); }, delay);
    return () => window.clearTimeout(timer);
  }, [state.projection.expiresAt, store]);
  const value = useMemo<SessionContextValue>(() => ({
    ...state.projection, apiMode: true, restoring: state.restoring, sessionError: state.error, canRetryRefresh: state.recoverable,
    replaceSession: rejectDemoSession, startSession: rejectDemoSession, clearSession: store.clear,
    hasPermission: (permission) => hasApiPermission(state.projection.permissions, permission),
    canAccessPath: (path) => canAccessApiPath(state.projection.permissions, path, state.projection), landingPath: firstApiPath(state.projection.permissions, state.projection),
    createPhoneChallenge: store.createPhoneChallenge, loginPhone: store.loginPhone, retryRefresh: store.refresh,
    createWechatChallenge: store.createWechatChallenge, readWechatChallenge: store.readWechatChallenge, loginWechat: store.loginWechat,
    invalidateAccessToken: store.invalidate, revalidateAccessToken: store.revalidate, logout: store.logout,
  }), [state, store]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function MockSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionProjection>(readStoredSession);

  const replaceSession = useCallback((next: SessionProjection) => {
    setSession(next);
    if (next.status === 'authenticated') {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const clearSession = useCallback(() => replaceSession(anonymousSession), [replaceSession]);

  const startSession = useCallback(
    (role: DemoRole, loginMethod: DemoLoginMethod) => {
      const definition = roleDefinitions[role];
      replaceSession({
        status: 'authenticated',
        accessToken: null,
        accountId: demoAccountsByRole[role].accountId,
        displayName: demoAccountsByRole[role].displayName,
        role,
        roleLabel: definition.label,
        loginMethod,
        permissions: definition.permissions,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      });
    },
    [replaceSession],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      ...session,
      replaceSession,
      startSession,
      clearSession,
      hasPermission: (permission: string) => session.permissions.includes(permission),
      canAccessPath: () => true, apiMode: false, restoring: false, sessionError: null, canRetryRefresh: false, landingPath: '/',
      createPhoneChallenge: unavailableAuthentication, loginPhone: unavailableAuthentication, retryRefresh: unavailableAuthentication,
      createWechatChallenge: unavailableAuthentication, readWechatChallenge: unavailableAuthentication, loginWechat: unavailableAuthentication,
      invalidateAccessToken: clearSession, revalidateAccessToken: async () => undefined, logout: async () => clearSession(),
    }),
    [clearSession, replaceSession, session, startSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return value;
}
