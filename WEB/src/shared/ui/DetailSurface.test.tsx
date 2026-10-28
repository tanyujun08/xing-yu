import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailDefinitionList, DetailEmptyState, DetailPageSummary, DetailSurface, DetailTraceRail } from './DetailSurface';

describe('detail surface primitives', () => {
  it('provides a stable heading and definition-list structure', () => {
    render(
      <DetailSurface title="资产身份" description="只读投影">
        <DetailDefinitionList>
          <div><dt>资产编号</dt><dd>XY-A-000001</dd></div>
          <div><dt>状态</dt><dd>在柜</dd></div>
        </DetailDefinitionList>
      </DetailSurface>,
    );

    expect(screen.getByRole('heading', { name: '资产身份' })).toBeInTheDocument();
    expect(screen.getByText('只读投影')).toBeInTheDocument();
    expect(screen.getByText('XY-A-000001')).toBeInTheDocument();
  });

  it('renders a compact empty state', () => {
    render(<DetailEmptyState>当前没有有效订单</DetailEmptyState>);
    expect(screen.getByText('当前没有有效订单')).toHaveClass('detail-empty-state');
  });

  it('supports a summary hierarchy and three-column traceable detail sections', () => {
    const { container } = render(
      <>
        <DetailPageSummary
          eyebrow="官方资产"
          title="DJI Action 4"
          description="DJI AC004 · 运动相机"
          trace={<DetailTraceRail items={[
            { label: '资产编号', value: 'XY-A-000001', mono: true },
            { label: '当前位置', value: '南山科技园柜机' },
          ]} />}
          metric={<><span>当前租金</span><strong>¥35.00 / 天</strong></>}
        />
        <DetailSurface title="设备身份与归属" variant="section">
          <DetailDefinitionList columns={3}>
            <div><dt>标识类型</dt><dd>SN</dd></div>
          </DetailDefinitionList>
        </DetailSurface>
      </>,
    );

    expect(screen.getByRole('heading', { name: 'DJI Action 4', level: 1 })).toBeInTheDocument();
    expect(container.querySelector('.mono-value')).toHaveTextContent('XY-A-000001');
    expect(container.querySelector('.detail-definition-list--3')).toBeInTheDocument();
    expect(container.querySelector('.detail-surface--section')).toBeInTheDocument();
  });
});
