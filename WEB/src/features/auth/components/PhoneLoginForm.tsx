import { randomId } from '../../../shared/randomId';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Form, Input, MessagePlugin } from 'tdesign-react';
import { MobileIcon, SecuredIcon } from '../../../shared/design/icons';
import { useSession } from '../../../shared/access/session';

interface PendingIntent { body: string; key: string }

export function ApiPhoneLoginForm() {
  const host = useRef<HTMLDivElement>(null);
  // TDesign Form 1.18.2 does not forward ARIA props to its native form.
  useLayoutEffect(() => { host.current?.querySelector('form')?.setAttribute('aria-label', 'API 手机号登录'); }, []);
  const session = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; phone: string; expiresAt: number } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const sendIntent = useRef<PendingIntent | null>(null);
  const loginIntent = useRef<PendingIntent | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  const keyFor = (reference: { current: PendingIntent | null }, body: string) => {
    if (reference.current?.body !== body) reference.current = { body, key: randomId() };
    return reference.current.key;
  };
  const requestCode = async () => {
    if (pending.current || countdown > 0) return;
    if (!PHONE_PATTERN.test(phone)) { setError('请输入有效的11位手机号'); return; }
    pending.current = true; setBusy(true); setError(null);
    try {
      const value = await session.createPhoneChallenge(phone, keyFor(sendIntent, phone));
      if (!mounted.current) return;
      setChallenge({ id: value.challenge_id, phone, expiresAt: Date.now() + value.expires_in * 1000 });
      setCode(''); setCountdown(value.retry_after_seconds ?? value.expires_in); loginIntent.current = null; sendIntent.current = null;
    } catch {
      if (mounted.current) setError('验证码请求未确认成功，请稍后重试；相同手机号将复用原请求。');
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  const submit = async () => {
    if (pending.current) return;
    if (challenge === null || challenge.phone !== phone || challenge.expiresAt <= Date.now()) { setError('请先获取当前手机号的有效验证码'); return; }
    if (!/^\d{6}$/.test(code)) { setError('请输入6位数字验证码'); return; }
    pending.current = true; setBusy(true); setError(null);
    try {
      await session.loginPhone(challenge.id, code, keyFor(loginIntent, JSON.stringify([challenge.id, code])));
    } catch {
      if (mounted.current) setError('登录未成功，请确认验证码及账号状态；网络失败时可重试原请求。');
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  };
  return <div ref={host} id="phone-login-panel" role="tabpanel" aria-labelledby="phone-login-tab"><Form labelAlign="top" className="login-phone-form" onSubmit={() => { void submit(); }}>
    <Form.FormItem><label className="login-field"><span className="login-field-label">手机号</span>
      <Input className="login-control" name="mobile" type="tel" autocomplete="tel" maxlength={11} placeholder="请输入手机号" prefixIcon={<MobileIcon />} disabled={busy} value={phone}
        onChange={(value) => { setPhone(String(value)); setChallenge(null); setCode(''); loginIntent.current = null; }} />
    </label></Form.FormItem>
    <Form.FormItem><label className="login-field login-code-field"><span id="ops-login-code-label" className="login-field-label">验证码</span>
      <Input className="login-control" ref={(control) => { control?.inputElement?.setAttribute('aria-labelledby', 'ops-login-code-label'); }} name="verificationCode" autocomplete="one-time-code" maxlength={6} placeholder="请输入验证码" prefixIcon={<SecuredIcon />} disabled={busy} value={code} onChange={(value) => setCode(String(value))}
        suffix={<Button className="login-code-button" theme="primary" variant="text" tag="button" type="button" disabled={busy || countdown > 0} onClick={() => { void requestCode(); }}>{countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}</Button>} />
    </label></Form.FormItem>
    {error === null ? null : <p role="alert" className="login-form-error">{error}</p>}
    <Button className="login-submit-button" size="large" theme="default" tag="button" type="submit" block loading={busy} disabled={busy || challenge === null}>登录</Button>
    <p className="login-helper-copy">仅已有且有效的后台账号可登录。</p>
  </Form></div>;
}

const MOCK_CODE = '246810';
const PHONE_PATTERN = /^1\d{10}$/;

export function PhoneLoginForm(props: { onAuthenticated: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const requestCode = () => {
    if (!PHONE_PATTERN.test(phone)) {
      setError('请输入有效的11位手机号');
      return;
    }
    setError(null);
    setCountdown(60);
    void MessagePlugin.info(`Mock 验证码：${MOCK_CODE}`);
  };

  const submit = () => {
    if (!PHONE_PATTERN.test(phone)) {
      setError('请输入有效的11位手机号');
      return;
    }
    if (code !== MOCK_CODE) {
      setError(`验证码不正确，演示验证码为 ${MOCK_CODE}`);
      return;
    }
    setError(null);
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      props.onAuthenticated();
    }, 320);
  };

  return (
    <div id="phone-login-panel" role="tabpanel" aria-labelledby="phone-login-tab"><Form labelAlign="top"
      className="login-phone-form"
      onSubmit={submit}
    >
      <Form.FormItem><label className="login-field">
        <span className="login-field-label">手机号</span>
        <Input
          className="login-control"
          name="mobile"
          type="tel"
          autocomplete="tel"
          maxlength={11}
          placeholder="请输入手机号"
          prefixIcon={<MobileIcon />}
          status={error !== null && !PHONE_PATTERN.test(phone) ? 'error' : 'default'}
          value={phone}
          onChange={(value) => setPhone(String(value))}
        />
      </label></Form.FormItem>

      <Form.FormItem><label className="login-field login-code-field">
        <span className="login-field-label">验证码</span>
        <Input
          className="login-control"
          name="verificationCode"
          type="text"
          autocomplete="one-time-code"
          maxlength={6}
          placeholder="请输入验证码"
          prefixIcon={<SecuredIcon />}
          status={error !== null && code !== MOCK_CODE ? 'error' : 'default'}
          suffix={
            <Button
              className="login-code-button"
              disabled={countdown > 0}
              theme="primary"
              variant="text"
              type="button"
              onClick={requestCode}
            >
              {countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}
            </Button>
          }
          value={code}
          onChange={(value) => setCode(String(value))}
        />
      </label></Form.FormItem>

      {error === null ? null : (
        <p className="login-form-error" role="alert">
          {error}
        </p>
      )}

      <Button
        block
        className="login-submit-button"
        loading={submitting}
        size="large"
        theme="default"
        type="submit"
      >
        登录
      </Button>
      <p className="login-helper-copy">仅供快速测试验证，不连接真实短信、微信或业务 API</p>
    </Form></div>
  );
}
