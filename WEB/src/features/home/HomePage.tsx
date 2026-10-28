import { Card, Space, Tag } from 'tdesign-react';

export function HomePage() {
  return (
    <Card title="基础运行壳已就绪" bordered>
      <Space breakLine>
        <Tag theme="primary">API 权威</Tag>
        <Tag theme="success">多轴状态</Tag>
        <Tag theme="warning">外部 UNKNOWN 可恢复</Tag>
        <Tag>C2C + B2C</Tag>
      </Space>
      <p className="home-description">
        当前只包含路由、请求、契约、错误和会话基础设施；商品、订单、资金与柜机页面将在对应业务切片中接入。
      </p>
    </Card>
  );
}
