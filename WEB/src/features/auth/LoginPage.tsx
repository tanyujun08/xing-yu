import { useState } from 'react';
import { Button, MessagePlugin, Select } from 'tdesign-react';
import { Navigate } from 'react-router-dom';
import { roleDefinitions, useSession, type DemoRole } from '../../shared/access/session';
import { demoAccountsByRole } from '../../shared/access/demoAccounts';
import { useAdminServices } from '../../shared/services';
import { LoginHero } from './components/LoginHero';
import { LoginMethodTabs } from './components/LoginMethodTabs';
import { ApiPhoneLoginForm, PhoneLoginForm } from './components/PhoneLoginForm';
import { QrLoginPanel } from './components/QrLoginPanel';
import { ApiWechatPanel } from './components/ApiWechatPanel';
import type { LoginMethod } from './types';
import './LoginPage.css';

export function LoginPage() {
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [role, setRole] = useState<DemoRole>('SUPER_ADMIN');
  const [submitting, setSubmitting] = useState(false);
  const session = useSession();
  const services = useAdminServices();

  const completeLogin = async (loginMethod: 'PHONE' | 'MINIPROGRAM_QR') => {
    if (session.apiMode) return;
    const accountProjection = demoAccountsByRole[role];
    setSubmitting(true);
    try {
      const account = (await services.admins.list()).find((candidate) => candidate.id === accountProjection.accountId);
      if (account === undefined || account.status !== 'ACTIVE' || account.archivedAt !== null) throw new Error('所选演示管理员当前不可登录');
      if (loginMethod === 'MINIPROGRAM_QR' && !account.loginCapabilities.wechat) throw new Error('所选管理员尚未绑定微信登录');
      await services.sessionAudit.recordLoginAttempt({
        accountId: account.id,
        displayName: account.displayName,
        role,
        loginMethod,
        source: loginMethod === 'PHONE' ? '192.0.2.12 · Mock Web' : '192.0.2.34 · Mock QR',
        status: 'SUCCESS',
      });
      session.startSession(role, loginMethod);
      await MessagePlugin.success(`已以${roleDefinitions[role].label}身份进入后台`);
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Mock 登录失败';
      await services.sessionAudit.recordLoginAttempt({
        accountId: accountProjection.accountId,
        displayName: accountProjection.displayName,
        role,
        loginMethod,
        source: loginMethod === 'PHONE' ? '192.0.2.12 · Mock Web' : '192.0.2.34 · Mock QR',
        status: 'FAILED',
        failureReason,
      });
      await MessagePlugin.error(failureReason);
    } finally {
      setSubmitting(false);
    }
  };

  if (session.status === 'authenticated') {
    return <Navigate to={session.landingPath} replace />;
  }

  return (
    <main className="login-page">
      <LoginHero />
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-panel-content">
          <header className="login-panel-header">
            <h2 id="login-heading">欢迎回来</h2>
            <p>手机号和已绑定微信都可登录</p>
          </header>

          {session.apiMode ? <>
            {session.sessionError === null ? null : <p role="alert">{session.sessionError}</p>}
            {session.restoring ? <p role="status">正在验证登录状态…</p> : <>
              <LoginMethodTabs value={method} onChange={setMethod} />
              {method === 'phone' ? <ApiPhoneLoginForm /> : <ApiWechatPanel purpose="LOGIN" />}
            </>}
            {session.canRetryRefresh ? <Button tag="button" disabled={session.restoring} onClick={() => { void session.retryRefresh(); }}>重试会话恢复</Button> : null}
          </> : <>
          <label className="login-role-field">
            <span>演示身份</span>
            <Select
              value={role}
              options={(Object.keys(roleDefinitions) as DemoRole[]).map((value) => ({
                value,
                label: `${roleDefinitions[value].label} · ${demoAccountsByRole[value].displayName}`,
              }))}
              onChange={(value) => setRole(String(value) as DemoRole)}
            />
          </label>

          <LoginMethodTabs value={method} onChange={setMethod} />
          {method === 'phone' ? (
            <PhoneLoginForm onAuthenticated={() => { if (!submitting) void completeLogin('PHONE'); }} />
          ) : (
            <QrLoginPanel onAuthenticated={() => { if (!submitting) void completeLogin('MINIPROGRAM_QR'); }} onSwitchToPhone={() => setMethod('phone')} />
          )}
          </>}
        </div>
      </section>
    </main>
  );
}
