import type { KeyboardEvent } from 'react';
import { Button } from 'tdesign-react';
import { MobileIcon, QrcodeIcon } from '../../../shared/design/icons';
import type { LoginMethod } from '../types';

export function LoginMethodTabs(props: {
  value: LoginMethod;
  onChange: (method: LoginMethod) => void;
}) {
  const changeByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = props.value === 'phone' ? 'qr' : 'phone';
    props.onChange(next);
    window.requestAnimationFrame(() => document.getElementById(`${next}-login-tab`)?.focus());
  };

  return (
    <div className="login-method-tabs" role="tablist" aria-label="登录方式" onKeyDown={changeByKeyboard}>
      <Button
        className="login-method-tab"
        data-active={props.value === 'phone'}
        icon={<MobileIcon />}
        role="tab"
        aria-selected={props.value === 'phone'}
        aria-controls="phone-login-panel"
        id="phone-login-tab"
        tabIndex={props.value === 'phone' ? 0 : -1}
        theme="default"
        variant="base"
        onClick={() => props.onChange('phone')}
      >
        手机号登录
      </Button>
      <Button
        className="login-method-tab"
        data-active={props.value === 'qr'}
        icon={<QrcodeIcon />}
        role="tab"
        aria-selected={props.value === 'qr'}
        aria-controls="qr-login-panel"
        id="qr-login-tab"
        tabIndex={props.value === 'qr' ? 0 : -1}
        theme="default"
        variant="base"
        onClick={() => props.onChange('qr')}
      >
        微信扫码登录
      </Button>
    </div>
  );
}
