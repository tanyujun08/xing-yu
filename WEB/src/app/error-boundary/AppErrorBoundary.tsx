import { Component, type ReactNode } from 'react';
import { Alert, Button, Space } from 'tdesign-react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Mock Demo intentionally has no telemetry or external error-reporting channel.
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <Space direction="vertical">
            <Alert theme="error" title="Mock 页面加载失败" message="请刷新页面，或清除本浏览器演示数据后重试；本版本不会上报任何外部系统。" />
            <Button onClick={() => window.location.reload()}>刷新页面</Button>
          </Space>
        </main>
      );
    }
    return this.props.children;
  }
}
