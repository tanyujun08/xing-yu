import { randomId } from '../../../shared/randomId';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Space } from 'tdesign-react';
import { useSession } from '../../../shared/access/session';
import type { OpsWechatChallenge } from '../../../shared/services/opsAuthentication';

export function ApiWechatPanel({ purpose }: { purpose: 'LOGIN' | 'BIND' }) {
  const session = useSession();
  const createWechatChallenge = session.createWechatChallenge;
  const [createKey, setCreateKey] = useState(() => randomId());
  const [attempt, setAttempt] = useState(0);
  const [challenge, setChallenge] = useState<OpsWechatChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [pollAttempt, setPollAttempt] = useState(0);
  const loginIntent = useRef<{ id: string; key: string } | null>(null);
  const complete = async (current: OpsWechatChallenge) => {
    if (!current.poll_token) return;
    setBusy(true); setError(null);
    try {
      if (purpose === 'BIND') await session.revalidateAccessToken(session.accessToken);
      else {
        if (loginIntent.current?.id !== current.challenge_id) loginIntent.current = { id: current.challenge_id, key: randomId() };
        await session.loginWechat(current.challenge_id, current.poll_token, loginIntent.current.key);
      }
    } catch { setError('结果尚未确认，请重试原请求。'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let active = true;
    void createWechatChallenge(purpose, createKey).then((value) => {
      if (!active) return;
      if (value.purpose !== purpose) throw new Error('二维码用途不匹配');
      setChallenge(value);
    }).catch(() => { if (active) setError('小程序码暂时无法生成，请重试。'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [createWechatChallenge, purpose, createKey, attempt]);
  useEffect(() => {
    if (!challenge?.poll_token) return;
    const created = challenge;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (Date.parse(created.expires_at) <= Date.now()) { if (active) setChallenge({ ...created, status: 'EXPIRED' }); return; }
      try {
        const result = await session.readWechatChallenge(purpose, created.challenge_id, created.poll_token!);
        if (!active) return;
        if (result.challenge_id !== created.challenge_id || result.purpose !== purpose) throw new Error('挑战状态不匹配');
        const updated = { ...created, ...result };
        setChallenge(updated); setError(null);
        if (result.status === 'APPROVED' && purpose === 'LOGIN' || result.status === 'CONSUMED' && purpose === 'BIND') {
          setBusy(true);
          try {
            if (purpose === 'BIND') await session.revalidateAccessToken(session.accessToken);
            else {
              if (loginIntent.current?.id !== created.challenge_id) loginIntent.current = { id: created.challenge_id, key: randomId() };
              await session.loginWechat(created.challenge_id, created.poll_token!, loginIntent.current.key);
            }
          } catch { if (active) setError('结果尚未确认，请重试原请求。'); }
          finally { if (active) setBusy(false); }
          return;
        }
        if (result.status === 'PENDING') timer = setTimeout(() => { void poll(); }, 2000);
      } catch { if (active) setError('暂时无法读取确认结果，请重试查询。'); }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
    // A challenge is immutable; changing its displayed status must not start a second poll loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.challenge_id, challenge?.poll_token, purpose, session.readWechatChallenge, session.loginWechat, session.revalidateAccessToken, session.accessToken, pollAttempt]);
  const expired = challenge?.status === 'EXPIRED' || challenge?.status === 'REJECTED';
  const completed = purpose === 'LOGIN' ? challenge?.status === 'APPROVED' : challenge?.status === 'CONSUMED';
  return <div className="login-qr-panel">
    <p>{purpose === 'BIND' ? '请使用本人微信扫描，并在小程序中确认绑定。' : '请使用已绑定的微信扫描，并在小程序中确认登录。'}</p>
    {challenge?.code_image && !expired && <img src={challenge.code_image} width={230} height={230} alt={purpose === 'BIND' ? '后台账号微信绑定码' : '后台扫码登录码'} />}
    {busy && <p role="status">正在处理…</p>}
    {error !== null && <p role="alert">{error}</p>}
    {challenge?.status === 'PENDING' && <p>等待小程序确认</p>}
    {expired && <p>{challenge.status === 'EXPIRED' ? '二维码已过期' : '已取消确认'}</p>}
    <Space>
      {error && !challenge && <Button disabled={busy} onClick={() => { setError(null); setBusy(true); setAttempt((value) => value + 1); }}>重试生成</Button>}
      {error && challenge && !completed && !expired && <Button disabled={busy} onClick={() => setPollAttempt((value) => value + 1)}>重试查询</Button>}
      {error && challenge && completed && <Button disabled={busy} onClick={() => { void complete(challenge); }}>重试原请求</Button>}
      {expired && <Button disabled={busy} onClick={() => { loginIntent.current = null; setChallenge(null); setError(null); setBusy(true); setCreateKey(randomId()); }}>刷新二维码</Button>}
    </Space>
  </div>;
}

export function FirstLoginWechatBinding() {
  const session = useSession();
  if (!session.apiMode || session.status !== 'authenticated' || session.wechatBinding?.status !== 'UNBOUND') return null;
  return <WechatBindingReminder key={session.accountId} />;
}

function WechatBindingReminder() {
  const session = useSession();
  const [deferred, setDeferred] = useState(false);
  if (deferred) return null;
  return <Dialog visible header="绑定微信账号" closeBtn={false} closeOnEscKeydown={false} closeOnOverlayClick={false} footer={<Space><Button variant="text" onClick={() => { void session.logout(); }}>退出登录</Button><Button onClick={() => setDeferred(true)}>稍后绑定</Button></Space>}>
    <p>绑定后可以使用微信扫码登录，也可以稍后绑定，继续使用手机号登录。</p>
    <ApiWechatPanel key={session.accountId} purpose="BIND" />
  </Dialog>;
}
