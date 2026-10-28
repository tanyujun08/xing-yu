import { Divider } from 'tdesign-react';
import { ServerIcon } from '../../../shared/design/icons';

export function MockEnvironmentNotice() {
  return (
    <div className="login-environment-notice">
      <Divider />
      <div className="login-environment-row">
        <ServerIcon aria-hidden="true" />
        <span>当前环境：</span>
        <strong>Mock Demo</strong>
      </div>
    </div>
  );
}
