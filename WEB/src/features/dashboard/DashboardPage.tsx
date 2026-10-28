import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Progress, Skeleton, Space, Tag } from 'tdesign-react';
import { DeviceIcon, ErrorCircleIcon } from 'tdesign-icons-react';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices } from '../../shared/services';
import { DetailSurface } from '../../shared/ui/DetailSurface';
import { MetricCard } from '../../shared/ui/MetricCard';
import { PageHeader } from '../../shared/ui/PageHeader';

import './dashboard.css';

export function DashboardPage() {
  const services = useAdminServices();
  
  const queryKeys = useAdminQueryKeys();
  const navigate = useNavigate();

const summaryQuery = useQuery({ queryKey: queryKeys.resource('dashboard', 'summary'), queryFn: ({ signal }) => services.dashboard.getSummary({ signal }) });

if (summaryQuery.isLoading) return <Skeleton animation="gradient" rowCol={[1, 1, 1, 1, 1]} />;
  if (summaryQuery.error !== null || summaryQuery.data === undefined) {
    return <Card className="data-card"><div role="alert"><Space direction="vertical"><ErrorCircleIcon size="32px" /><strong>经营数据加载失败</strong><span>请重新加载经营摘要。</span><Button variant="outline" onClick={() => void summaryQuery.refetch()}>重新加载</Button></Space></div></Card>;
  }

  const summary = summaryQuery.data;
  
  const onlineRate = summary.cabinetTotal === 0 ? 0 : Math.round((summary.cabinetOnline / summary.cabinetTotal) * 100);
  const boxUseRate = summary.boxTotal === 0 ? 0 : Math.round((summary.boxOccupied / summary.boxTotal) * 100);

return (
    <div className="dashboard-page">
      <PageHeader title="经营工作台" description="查看柜机连接、格口占用与资产经营摘要。" actions={<Tag theme="primary">数据场景：标准经营日</Tag>} />
      <section aria-labelledby="dashboard-focus-title">
        <div className="dashboard-section-heading"><div><h2 id="dashboard-focus-title">今日运营</h2><p>当前时点指标不随趋势周期切换。</p></div></div>
        <div className="dashboard-metric-grid">

<MetricCard label="柜机在线率" value={`${onlineRate}%`} hint={`${summary.cabinetOnline}/${summary.cabinetTotal} 在线 · ${summary.cabinetUnknown} 未知`} icon={<DeviceIcon />} tone="mint" />
          <MetricCard label="可用格口" value={String(summary.boxAvailable)} hint={`${summary.boxOccupied} 占用 / ${summary.boxTotal} 总数`} icon={<DeviceIcon />} />
        </div>
      </section>

      <div className="dashboard-primary-grid">
        
        <DetailSurface title="待处理事项" description="按异常影响优先处理，全部跳转到既有业务入口。">
          <div className="todo-list">

<Button variant="text" tag="button" type="button" onClick={() => navigate('/cabinets')}><span className="todo-priority todo-priority--warning">P1</span><span><strong>离线 / 未知柜机</strong><small>确认连接状态与现场设备</small></span><b>{summary.cabinetOffline + summary.cabinetUnknown}</b></Button>
            <Button variant="text" tag="button" type="button" onClick={() => navigate('/cabinets')}><span className="todo-priority">P2</span><span><strong>开放告警</strong><small>查看资产与柜格状态</small></span><b>{summary.openAlertCount}</b></Button>
          </div>
        </DetailSurface>
      </div>

<div className="dashboard-bottom-grid">
        <DetailSurface title="设备健康" description="进度与数量同时呈现，状态不只依赖颜色。">
          <div className="progress-item"><div><span>柜机在线率</span><strong>{onlineRate}%</strong></div><Progress percentage={onlineRate} color="var(--xy-action-primary)" label={false} /></div>
          <div className="progress-item"><div><span>格口使用率</span><strong>{boxUseRate}%</strong></div><Progress percentage={boxUseRate} color="var(--xy-status-success)" label={false} /></div>
          <div className="dashboard-health-grid"><span>在线 / 离线 / 未知<strong>{summary.cabinetOnline} / {summary.cabinetOffline} / {summary.cabinetUnknown}</strong></span><span>在柜 / 资产总数<strong>{summary.assetInCabinet} / {summary.assetTotal}</strong></span><span>合作商家 / 地址<strong>{summary.merchantCount} / {summary.operatingAddressCount}</strong></span></div>
        </DetailSurface>
        
      </div>
    </div>
  );
}
