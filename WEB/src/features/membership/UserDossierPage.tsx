import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Row, Space, Table, Tag, type PrimaryTableCol } from 'tdesign-react';
import { ArrowLeftIcon, HistoryIcon } from 'tdesign-icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatUTC } from '../../shared/format/time';
import { formatStarTenths } from '../../shared/format/stars';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type SignInRecord, type StarLedgerEntry } from '../../shared/services';
import { AdminTabPanel, AdminTabs } from '../../shared/ui/AdminTabs';
import { DetailDefinitionList, DetailSurface } from '../../shared/ui/DetailSurface';
import { MetricCard } from '../../shared/ui/MetricCard';
import { PageHeader } from '../../shared/ui/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag';
import './membership.css';

export function UserDossierPage() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const services = useAdminServices();
  const queryKeys = useAdminQueryKeys();
  const [activeTab, setActiveTab] = useState('signin');
  
  const dossierQuery = useQuery({ queryKey: queryKeys.resource('members', 'dossier', userId), queryFn: ({ signal }) => services.members.getDossier(userId, { signal }), enabled: userId !== '', refetchInterval: 5000, refetchIntervalInBackground: false });
  const dossier = dossierQuery.data;
  
  const ledgerColumns: PrimaryTableCol<StarLedgerEntry>[] = [
    { colKey: 'occurredAt', title: '时间', width: 200, cell: ({ row }) => formatUTC(row.occurredAt) },
    { colKey: 'type', title: '类型', width: 110, cell: ({ row }) => <StatusTag value={row.type} /> },
    { colKey: 'amount', title: dossier?.demoPinkBalance === undefined ? '星钻' : '星光', width: 120, align: 'right', cell: ({ row }) => formatStarTenths(row.grossStarTenths) },
    { colKey: 'note', title: '说明', minWidth: 280 },
  ];
  const signInColumns: PrimaryTableCol<SignInRecord>[] = [
    { colKey: 'businessDate', title: '上海业务日', width: 150 },
    { colKey: 'signedAt', title: '签到时间', width: 200, cell: ({ row }) => formatUTC(row.signedAt) },
    { colKey: 'streakDays', title: '连续签到', width: 120, cell: ({ row }) => `${row.streakDays} 天` },
    { colKey: 'reward', title: '奖励', width: 150, cell: ({ row }) => row.rewardDisplay ?? `+${formatStarTenths(row.dailyRewardStarTenths + row.milestoneBonusStarTenths)} 星钻` },
    { colKey: 'loyaltyVersionId', title: '规则版本', minWidth: 180, cell: ({ row }) => <span className="mono-value">{row.loyaltyVersionId}</span> },
  ];

if (dossierQuery.isError) return <Alert theme="error" closeBtn={false} message={<Space>用户档案加载失败<Button variant="outline" onClick={() => navigate('/membership')}>返回会员列表</Button></Space>} />;
  return <div>
    <PageHeader
      title={dossier === undefined ? '用户档案' : `${dossier.nickname} · 用户档案`}
      description="按用户聚合小程序身份、实名与支付分、签到及星钻记录。"
      actions={<Button variant="outline" icon={<ArrowLeftIcon />} onClick={() => navigate('/membership')}>返回列表</Button>}
    />
    {dossier === undefined ? <Card className="data-card">加载档案…</Card> : <>
      <DetailSurface className="dossier-profile" title="身份与风险概览">
        <div className="member-identity member-identity--large"><img src={dossier.avatarUrl} alt="" /><div><strong>{dossier.nickname}</strong><small className="mono-value">{dossier.userId} · {dossier.miniProgramOpenIdMasked}</small></div></div>
        <DetailDefinitionList className="dossier-facts">
          <div><dt>手机号</dt><dd>{dossier.mobileMasked}</dd></div><div><dt>实名</dt><dd>{dossier.realNameMasked ?? '未实名'} · {dossier.identityNoMasked ?? '—'}</dd></div>
          <div><dt>微信支付分原始分</dt><dd>{dossier.wechatPayScoreRaw ?? '—'}<small>{dossier.wechatPayScoreUpdatedAt === null ? '未更新' : formatUTC(dossier.wechatPayScoreUpdatedAt)}</small></dd></div>
          <div><dt>小程序 OpenID</dt><dd className="mono-value">{dossier.miniProgramOpenIdMasked}</dd></div>
          <div><dt>注册时间</dt><dd>{formatUTC(dossier.miniProgramRegisteredAt)}</dd></div>
          
          <div><dt>标签</dt><dd><Space>{dossier.riskTags.map((tag) => <Tag key={tag} variant="light">{tag}</Tag>)}</Space></dd></div>
        </DetailDefinitionList>
      </DetailSurface>
      <Row gutter={[20, 20]} className="membership-metrics">

<Col span={3}><MetricCard label={dossier.demoPinkBalance === undefined ? '可用星钻' : '累计星光'} value={formatStarTenths(dossier.starAccount.availableTenths)} hint="本地 Mock 账户" icon={<HistoryIcon />} tone="violet" /></Col>
        <Col span={3}><MetricCard label={dossier.demoPinkBalance === undefined ? '冻结星钻' : '粉钻余额'} value={dossier.demoPinkBalance === undefined ? formatStarTenths(dossier.starAccount.frozenTenths) : dossier.demoPinkBalance.toLocaleString('zh-CN')} hint={dossier.demoPinkBalance === undefined ? '账户冻结余额' : '小程序共享演示'} icon={<HistoryIcon />} tone="amber" /></Col>
      </Row>
      <DetailSurface className="dossier-records" title="用户记录">
        <AdminTabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>

<AdminTabPanel value="signin" label="签到记录">
            <dl className="dossier-signin-grid">
              <div><dt>今日签到</dt><dd><StatusTag value={dossier.signIn.signedInToday ? 'ACTIVE' : 'PENDING'} /></dd></div>
              <div><dt>当前连续签到</dt><dd>{dossier.signIn.currentStreakDays} 天</dd></div>
              <div><dt>最近签到时间</dt><dd>{dossier.signIn.lastSignInAt === null ? '暂无签到记录' : formatUTC(dossier.signIn.lastSignInAt)}</dd></div>
              <div><dt>下一里程碑</dt><dd>{dossier.signIn.nextMilestoneDays === null ? '当前无后续里程碑' : `连续 ${dossier.signIn.nextMilestoneDays} 天 · ${dossier.signIn.nextMilestoneLoyaltyVersionId}`}</dd></div>
            </dl>
            <Table rowKey="signInId" data={[...dossier.signInRecords]} columns={signInColumns} stripe hover empty="暂无签到记录" />
          </AdminTabPanel>
          <AdminTabPanel value="stars" label={dossier.demoPinkBalance === undefined ? '星钻流水' : '星光流水'}>
            <Table rowKey="id" data={[...dossier.starLedger]} columns={ledgerColumns} stripe hover empty="暂无流水" />
          </AdminTabPanel>
          
        </AdminTabs>
      </DetailSurface>
      <Alert theme="info" closeBtn={false} message={dossier.notes.join(' ')} />
      
    </>}
  </div>;
}
