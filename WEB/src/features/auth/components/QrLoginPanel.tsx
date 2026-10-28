import { useState } from 'react';
import { Button, MessagePlugin, QRCode, Space, Tag } from 'tdesign-react';
import { ErrorCircleIcon, QrcodeIcon, RefreshIcon, ScanIcon } from '../../../shared/design/icons';
import type { MockQrState } from '../types';

const qrStateCopy: Record<MockQrState, string> = {
  waiting: '等待扫码',
  scanned: '已扫码，等待小程序确认',
  authorized: '已授权',
  unbound: '微信未绑定',
  expired: '二维码已过期',
  cancelled: '本次扫码已取消',
};

export function QrLoginPanel(props: { onAuthenticated: () => void; onSwitchToPhone: () => void }) {
  const [state, setState] = useState<MockQrState>('waiting');

  const reset = () => setState('waiting');
  const confirm = () => {
    setState('authorized');
    void MessagePlugin.success('Mock 小程序已确认登录');
    window.setTimeout(props.onAuthenticated, 320);
  };

  const qrStatus = state === 'expired' || state === 'cancelled' || state === 'unbound' ? 'expired' : state === 'scanned' ? 'scanned' : 'active';
  const cancelledStatus = state === 'cancelled' || state === 'unbound'
    ? {
        statusRender: () => (
          <div className="login-qr-custom-status">
            <ErrorCircleIcon />
            <span>{state === 'unbound' ? '未绑定' : '已取消'}</span>
          </div>
        ),
      }
    : {};

  return (
    <section
      className="login-qr-panel"
      id="qr-login-panel"
      role="tabpanel"
      aria-labelledby="qr-login-tab"
    >
      <div className="login-qr-code-wrap">
        <QRCode
          borderless
          color="var(--xy-text-primary)"
          level="M"
          size={250}
          status={qrStatus}
          type="svg"
          value="mock://xingyu-admin/login/QR-DEMO-001"
          onRefresh={reset}
          {...cancelledStatus}
        />
      </div>

      <div className="login-qr-state" aria-live="polite">
        <Tag theme={state === 'expired' || state === 'cancelled' || state === 'unbound' ? 'warning' : 'primary'} variant="light">
          {qrStateCopy[state]}
        </Tag>
        <p>{state === 'unbound' ? '此微信未绑定管理员账号，请改用手机号登录。' : '二维码仅用于演示登录状态，不会连接真实微信。'}</p>
      </div>

      <Space className="login-qr-actions" size={12}>
        {state === 'waiting' ? (
          <>
            <Button className="login-qr-primary" icon={<ScanIcon />} theme="default" onClick={() => setState('scanned')}>
              模拟扫码
            </Button>
            <Button variant="outline" onClick={() => setState('expired')}>
              模拟过期
            </Button>
            <Button variant="text" onClick={() => setState('unbound')}>
              模拟未绑定
            </Button>
          </>
        ) : null}
        {state === 'scanned' ? (
          <>
            <Button className="login-qr-primary" icon={<QrcodeIcon />} theme="default" onClick={confirm}>
              模拟确认登录
            </Button>
            <Button variant="outline" onClick={() => setState('cancelled')}>
              取消
            </Button>
          </>
        ) : null}
        {state === 'expired' || state === 'cancelled' ? (
          <Button className="login-qr-primary" icon={<RefreshIcon />} theme="default" onClick={reset}>
            刷新二维码
          </Button>
        ) : null}
        {state === 'unbound' ? (
          <Button className="login-qr-primary" theme="default" onClick={props.onSwitchToPhone}>
            切换到手机号登录
          </Button>
        ) : null}
      </Space>
    </section>
  );
}
