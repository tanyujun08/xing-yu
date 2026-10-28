import { randomId } from '../../shared/randomId';
import { CabinetCoverSync } from './CabinetCoverSync';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkbox, Alert, Button, Dialog, Input, MessagePlugin, Select, Textarea } from 'tdesign-react';
import { formatUTC } from '../../shared/format/time';
import { cabinetManagementFailure, canPreflightCabinetOpenAll, confirmCabinetAllDoorsClosed, confirmCabinetDoorClosed, type CabinetManagementGateway, type CabinetOpenAllChallenge, type ManagedCabinet, type ManagedCabinetCommand, type ManagedCompartment } from '../../shared/services/cabinetManagement';
import { cabinetCommandDoorRefreshBudget, cabinetCommandResultLabel } from './cabinetCommandPresentation';

type Action = 'open_all';
type Submission = { kind: 'challenge'; value: CabinetOpenAllChallenge } | { kind: 'command'; value: ManagedCabinetCommand };
const labels: Record<Action, string> = { open_all: '管理员全开' };
const empty = { reason: '', responsible: '', device: '', proof: '', siteConfirmed: false };

export function CabinetApiCommands({ cabinet, slots, gateway, accountId, visible, disabled, onBusyChange, onShowHistory }: {
  cabinet: ManagedCabinet; slots: ManagedCompartment[]; gateway: CabinetManagementGateway; accountId: string | null; visible: boolean; disabled: boolean; onBusyChange: (busy: boolean) => void; onShowHistory?: () => void;
}) {
  const queryClient = useQueryClient();
  const [intent, setIntent] = useState<Action | null>(null);
  const [form, setForm] = useState(empty);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [selectedDoorSlot, setSelectedDoorSlot] = useState(0);
  const [queryId, setQueryId] = useState('');
  const [challenge, setChallenge] = useState<CabinetOpenAllChallenge | null>(null);
  const [commandId, setCommandId] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [uncertainSingleOpen, setUncertainSingleOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [doorRefreshDeadline, setDoorRefreshDeadline] = useState(0);
  const request = useRef<(() => Promise<Submission>) | null>(null);
  const singleOpenRequest = useRef<(() => Promise<ManagedCabinetCommand>) | null>(null);
  const singleOpenSlot = useRef(0);
  const refreshedQueryId = useRef('');
  const postOpenQueryCommand = useRef('');
  const currentCommandId = useRef('');
  const inFlight = useRef(false);
  const intentGeneration = useRef(0);
  const visibleRef = useRef(visible);
  const disabledRef = useRef(disabled);
  useLayoutEffect(() => { disabledRef.current = disabled; }, [disabled]);
  useEffect(() => { visibleRef.current = visible; }, [visible]);
  const busy = intent !== null || pending || uncertain;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => () => { visibleRef.current = false; }, []);
  const challengeStatus = useQuery({
    queryKey: ['cabinet-management', accountId, 'open-all-challenge', challenge?.challenge_id],
    queryFn: ({ signal }) => gateway.getOpenAllChallenge(cabinet.cabinet_id, challenge!.challenge_id, { signal }),
    enabled: visible && challenge !== null, retry: false, refetchInterval: visible && challenge !== null ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  const currentChallenge = challengeStatus.data ?? challenge;
  const providerActions = useQuery({
    queryKey: ['cabinet-management', accountId, 'provider-actions', cabinet.cabinet_id],
    queryFn: ({ signal }) => gateway.providerActions(cabinet.cabinet_id, { signal }),
    enabled: visible, retry: false, refetchInterval: visible ? 5000 : false, refetchIntervalInBackground: false,
  });
  const oneAction = providerActions.data?.items.find((item) => item.action === 'OPEN_ONE');
  const canAttemptSingleOpen = (oneAction?.enabled || oneAction?.reason_code === 'CABINET_NOT_READY') &&
    cabinet.lifecycle_status === 'ACTIVE' && cabinet.active_command_id === null;
  const allAction = providerActions.data?.items.find((item) => item.action === 'OPEN_ALL');
  const canAttemptOpenAll = canPreflightCabinetOpenAll(cabinet, slots, allAction);
  const onlineAction = providerActions.data?.items.find((item) => item.action === 'ONLINE');
  const doorAction = providerActions.data?.items.find((item) => item.action === 'DOOR_QUERY');
  const query = useQuery({
    queryKey: ['cabinet-management', accountId, 'provider-query', cabinet.cabinet_id, queryId],
    queryFn: ({ signal }) => gateway.providerQuery(cabinet.cabinet_id, queryId, { signal }),
    enabled: visible && queryId !== '', retry: false,
    refetchInterval: (current) => visible && queryId !== '' && (!current.state.data || current.state.data.status === 'QUEUED' || current.state.data.status === 'RUNNING') ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (!query.data || query.data.query_id !== queryId || refreshedQueryId.current === queryId ||
      query.data.status === 'QUEUED' || query.data.status === 'RUNNING') return;
    refreshedQueryId.current = queryId;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId, 'slots', cabinet.cabinet_id] }),
      queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId, 'detail', cabinet.cabinet_id] }),
      queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId, 'provider-actions', cabinet.cabinet_id] }),
    ]);
  }, [accountId, cabinet.cabinet_id, query.data, queryClient, queryId]);
  const command = useQuery({
    queryKey: ['cabinet-management', accountId, 'command', commandId || cabinet.active_command_id],
    queryFn: async ({ signal }) => {
      const result = await gateway.command(commandId || cabinet.active_command_id!, { signal });
      if (visibleRef.current && result.command_id === currentCommandId.current &&
        (result.command_type === 'OPEN_ONE' || result.command_type === 'OPEN_ALL') &&
        result.execution_status !== 'REQUESTED' && result.execution_status !== 'DISPATCHING') {
        if (postOpenQueryCommand.current !== result.command_id) {
          postOpenQueryCommand.current = result.command_id;
          setDoorRefreshDeadline(Date.now() + cabinetCommandDoorRefreshBudget(result.targets.length));
          setNotice(`开门指令${cabinetCommandResultLabel(result.execution_status)}；正在刷新格口实际门态，查询不改变调用结果。`);
        }
        const acceptedAt = Date.parse(result.accepted_at ?? '');
        if (Number.isFinite(acceptedAt) && result.targets.length > 0 && result.targets.every((target) => {
          const slot = slots.find((item) => item.compartment_id === target.compartment_id);
          return slot?.door_observed_at && Date.parse(slot.door_observed_at) >= acceptedAt;
        })) {
          setDoorRefreshDeadline(0);
          setNotice('格口状态已刷新，请查看最新实际门态。');
        }
      }
      return result;
    },
    enabled: visible && (commandId !== '' || cabinet.active_command_id !== null), retry: false,
    refetchInterval: (current) => visible && (!current.state.data || current.state.data.execution_status === 'REQUESTED' || current.state.data.execution_status === 'DISPATCHING') ? 5000 : visible && Date.now() < doorRefreshDeadline ? 2000 : false,
    refetchIntervalInBackground: false,
  });
  const slotOptions = useMemo(() => slots.filter((slot) => slot.topology_status === 'IN_TOPOLOGY').map((slot) => {
    const reason = slot.service_status !== 'ACTIVE' || slot.business_occupancy_status !== 'AVAILABLE'
      ? '不可用' : '点击后核查门态';
    return { label: `格口 ${slot.compartment_no} · ${reason}`, value: slot.compartment_no,
      disabled: slot.service_status !== 'ACTIVE' || slot.business_occupancy_status !== 'AVAILABLE' };
  }), [slots]);
  useEffect(() => {
    const result = command.data;
    if (!visible || !result || result.command_id !== commandId || !command.dataUpdatedAt) return;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId, 'slots', cabinet.cabinet_id] }),
      queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId, 'detail', cabinet.cabinet_id] }),
      queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId, 'provider-actions', cabinet.cabinet_id] }),
    ]);
  }, [accountId, cabinet.cabinet_id, command.data, command.dataUpdatedAt, commandId, queryClient, visible]);
  useEffect(() => {
    if (!doorRefreshDeadline) return;
    const timer = window.setTimeout(() => {
      setDoorRefreshDeadline(0);
      setNotice('自动刷新已结束，可按需查询箱门信息更新实际门态。');
    }, Math.max(0, doorRefreshDeadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [doorRefreshDeadline]);
  const doorOptions = useMemo(() => slots.filter((slot) => slot.topology_status === 'IN_TOPOLOGY').map((slot) => ({ label: '格口 ' + slot.compartment_no, value: slot.compartment_no })), [slots]);
  const begin = (action: Action) => {
    if (disabled || busy) return;
    intentGeneration.current++;
    request.current = null; setError(''); setNotice(''); setUncertain(false); setChallenge(null);
    setForm(empty); setIntent(action);
  };
  const cancelIntent = () => {
    if (uncertain || (pending && request.current !== null)) return;
    intentGeneration.current++;
    setIntent(null); setChallenge(null); setForm(empty); request.current = null;
  };
  const submit = async () => {
    if (disabledRef.current || inFlight.current || intent === null || uncertain) return;
    const generation = intentGeneration.current;
    const isActive = () => visibleRef.current && !disabledRef.current && intentGeneration.current === generation;
    inFlight.current = true; setPending(true); setError('');
    try {
      if (request.current === null) {
        const reason = form.reason.trim();
        if (reason.length < 3 || reason.length > 256) throw new Error('请填写 3～256 字操作原因');
        if (!form.siteConfirmed) throw new Error('请先确认现场环境、人员与柜内物品安全');
        const key = randomId();
        if (challenge === null) {
          const responsible = form.responsible.trim();
          if (responsible.length < 3 || responsible.length > 64 || /[0-9][0-9 ()+.-]{8,}[0-9]/.test(responsible)) throw new Error('请填写不含手机号的现场负责人');
          if (form.device !== cabinet.provider_device_id) throw new Error('请重新核对设备编号');
          setNotice('正在核查在线与全部配置格口门关；尚未申请短信验证码。');
          const fresh = await confirmCabinetAllDoorsClosed(gateway, cabinet, (id, stage) => {
            if (stage === 'online') setQueryId(id);
            setNotice(stage === 'online' ? '正在回读在线查询；尚未申请短信验证码。' : `正在回读全格观察 ${id}；尚未申请短信验证码。`);
          }, isActive);
          if (!isActive()) throw new Error('全开前检已取消，未提交后续操作。');
          request.current = async () => ({ kind: 'challenge', value: await gateway.openAllChallenge(fresh, { reason, on_site_responsible: responsible, confirmed_device_id: form.device }, key) });
        } else {
          if (currentChallenge?.delivery_status !== 'SENT' || currentChallenge.status !== 'PENDING' || Date.parse(currentChallenge.expires_at) <= Date.now()) throw new Error('验证码尚未送达或挑战已失效，请刷新状态');
          if (!/^[0-9]{6}$/.test(form.proof)) throw new Error('请输入六位验证码');
          setNotice('验证码提交前正在重新核查在线与全部配置格口门关；尚未提交开门命令。');
          const fresh = await confirmCabinetAllDoorsClosed(gateway, cabinet, (id, stage) => {
            if (stage === 'online') setQueryId(id);
            setNotice(stage === 'online' ? '正在回读在线查询；尚未提交开门命令。' : `正在回读全格观察 ${id}；尚未提交开门命令。`);
          }, isActive);
          if (!isActive()) throw new Error('全开前检已取消，未提交后续操作。');
          const latest = await gateway.getOpenAllChallenge(cabinet.cabinet_id, challenge.challenge_id);
          if (!isActive()) throw new Error('全开前检已取消，未提交后续操作。');
          if (latest.challenge_id !== challenge.challenge_id || latest.delivery_status !== 'SENT' || latest.status !== 'PENDING' ||
            !Number.isFinite(Date.parse(latest.expires_at)) || Date.parse(latest.expires_at) <= Date.now()) throw new Error('本次验证码已失效，未提交开门命令。请重新发起挑战。');
          request.current = async () => ({ kind: 'command', value: await gateway.openAll(fresh, { challenge_id: challenge.challenge_id, proof: form.proof }, key) });
        }
      }
      if (!isActive()) throw new Error('操作已暂停，未提交后续操作。');
      const result = await request.current();
      request.current = null; setUncertain(false);
      if (result.kind === 'challenge') {
        setChallenge(result.value); setNotice('验证码已进入短信队列，送达状态请以服务端回读为准。');
      } else {
        currentCommandId.current = result.value.command_id;
        setDoorRefreshDeadline(0); setCommandId(result.value.command_id); setNotice('开门命令已创建，正在读取接口调用结果。');
        setIntent(null); setChallenge(null); setForm(empty);
        await queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId] });
        await MessagePlugin.info('命令已创建，实际门态将独立更新');
      }
    } catch (failure) {
      if (!isActive() && request.current === null) return;
      const result = cabinetManagementFailure(failure, request.current !== null, 'open-all');
      setUncertain(result.uncertain);
      setError(failure instanceof Error && !(failure as { status?: number }).status ? failure.message : result.message);
      if (!result.uncertain) request.current = null;
      if (result.refreshRequired) void queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId] });
    } finally { inFlight.current = false; setPending(false); }
  };
  const requestQuery = async (kind: 'ONLINE' | 'DOOR_QUERY') => {
    if (disabled || busy || inFlight.current || (kind === 'ONLINE' ? !onlineAction?.enabled : !doorAction?.enabled || !doorOptions.some((item) => item.value === selectedDoorSlot))) return;
    inFlight.current = true; setPending(true); setError(''); setNotice('');
    try {
      const value = kind === 'ONLINE'
        ? await gateway.queryOnline(cabinet.cabinet_id, randomId())
        : await gateway.queryDoor(cabinet, selectedDoorSlot, randomId());
      setQueryId(value.query_id);
      setNotice('查询已进入队列；请按原查询 ID 回读千鸣结果。');
      await queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId] });
    } catch (failure) {
      const result = cabinetManagementFailure(failure, true);
      setUncertain(result.uncertain);
      setError(result.message);
      if (result.refreshRequired) void queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId] });
    } finally { inFlight.current = false; setPending(false); }
  };
  const openOneNow = async (retryOriginal = false) => {
    if (disabledRef.current || pending || inFlight.current) return;
    let targetSlot = singleOpenSlot.current;
    let key = '';
    if (retryOriginal) {
      if (!uncertain || singleOpenRequest.current === null) return;
    } else {
      if (disabled || busy || !canAttemptSingleOpen || !slotOptions.some((item) => item.value === selectedSlot && !item.disabled)) return;
      targetSlot = selectedSlot;
      key = randomId();
      singleOpenSlot.current = targetSlot;
      singleOpenRequest.current = null;
    }
    inFlight.current = true; setPending(true); setError(''); setNotice('');
    let commandAttempted = retryOriginal;
    try {
      if (!retryOriginal) {
        setNotice(`正在核查格口 ${targetSlot} 的门态；未提交开门命令。`);
        const freshCabinet = await confirmCabinetDoorClosed(gateway, cabinet.cabinet_id, targetSlot,
          (id, stage) => { setQueryId(id); if (stage === 'online') setNotice('正在核查设备在线状态；未提交开门命令。'); },
          () => visibleRef.current && !disabledRef.current);
        const [freshSlots, freshActions] = await Promise.all([
          gateway.compartments(cabinet.cabinet_id), gateway.providerActions(cabinet.cabinet_id),
        ]);
        const target = freshSlots.items.find((item) => item.compartment_no === targetSlot);
        const action = freshActions.items.find((item) => item.action === 'OPEN_ONE');
        if (!visibleRef.current || disabledRef.current || target?.service_status !== 'ACTIVE' || target.business_occupancy_status !== 'AVAILABLE' ||
          target.door_status !== 'CLOSED' || !action?.enabled) {
          throw new Error(action?.message && !action.enabled ? `${action.message}；未提交开门命令。` : '格口资格已变化，未提交开门命令。');
        }
        singleOpenRequest.current = () => gateway.openOne(freshCabinet, targetSlot, key);
      }
      setNotice(`格口 ${singleOpenSlot.current} 已核查门关，正在提交单格开门命令。`);
      commandAttempted = true;
      const result = await singleOpenRequest.current!();
      singleOpenRequest.current = null;
      setUncertain(false);
      setUncertainSingleOpen(false);
      currentCommandId.current = result.command_id;
      setDoorRefreshDeadline(0);
      setCommandId(result.command_id);
      setNotice('格口 ' + singleOpenSlot.current + ' 的单格开门命令已创建；正在读取接口调用结果。');
      await queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId] });
    } catch (failure) {
      const result = cabinetManagementFailure(failure, commandAttempted);
      setUncertain(result.uncertain);
      setUncertainSingleOpen(result.uncertain);
      setError(!commandAttempted && failure instanceof Error && !(failure as { status?: number }).status ? failure.message : result.message);
      if (!result.uncertain) singleOpenRequest.current = null;
      if (result.refreshRequired) void queryClient.invalidateQueries({ queryKey: ['cabinet-management', accountId] });
    } finally { inFlight.current = false; setPending(false); }
  };
  return <section className="cabinet-api-commands" aria-label="真实千鸣查询与物理操作">
    <div className="cabinet-section-heading"><div><h3>千鸣柜机操作</h3><p>接口返回开门成功即完成本次调用，实际门态由后续查询独立更新。</p></div>{onShowHistory && <Button tag="button" variant="text" disabled={disabled} onClick={() => { if (!disabled) onShowHistory(); }}>查看运行记录</Button>}</div>
    <div className="cabinet-api-commands__groups">
      <CabinetCoverSync key={`${accountId}:${cabinet.cabinet_id}`} cabinet={cabinet} gateway={gateway} accountId={accountId} visible={visible} disabled={disabled || busy} />
      <section className="cabinet-api-commands__group" aria-label="查询类操作"><h4>查询类</h4><p>读取设备和格口状态，不改变柜门。</p>
        <div className="cabinet-api-commands__row"><span>在线状态</span><Button tag="button" disabled={disabled || busy || !onlineAction?.enabled} onClick={() => { void requestQuery('ONLINE'); }}>查询在线状态</Button></div>
        <div className="cabinet-api-commands__row"><span>箱门信息</span><Select aria-label="箱门信息目标格口" value={selectedDoorSlot || ''} options={doorOptions} disabled={disabled || busy || !doorAction?.enabled} onChange={(value) => setSelectedDoorSlot(Number(value))} /><Button tag="button" disabled={disabled || busy || !doorAction?.enabled || !doorOptions.some((item) => item.value === selectedDoorSlot)} onClick={() => { void requestQuery('DOOR_QUERY'); }}>查询箱门信息</Button></div>
      </section>
      <section className="cabinet-api-commands__group cabinet-api-commands__group--physical" aria-label="物理操作类"><h4>物理操作类</h4><p>单格开门先核查在线与门关；管理员全开在获取验证码和提交验证码前均核查在线与全部配置格口门关。</p>
        <div className="cabinet-api-commands__row"><span>单格开门</span><Select aria-label="单格开门目标格口" value={selectedSlot || ''} options={slotOptions} disabled={disabled || busy} onChange={(value) => setSelectedSlot(Number(value))} /><Button tag="button" disabled={disabled || busy || !canAttemptSingleOpen || !slotOptions.some((item) => item.value === selectedSlot && !item.disabled)} loading={pending} onClick={() => { void openOneNow(); }}>单格开门</Button></div>
        <div className="cabinet-api-commands__row"><span>管理员全开</span><Button tag="button" theme="danger" disabled={disabled || busy || !canAttemptOpenAll} onClick={() => begin('open_all')}>管理员全开</Button></div>
      </section>
    </div>
    {providerActions.isError && <Alert theme="error" message="操作资格读取失败，请刷新柜机详情。" />}
    {onlineAction && !onlineAction.enabled && <p>在线查询：{onlineAction.message}</p>}
    {doorAction && !doorAction.enabled && <p>箱门查询：{doorAction.message}</p>}
    {oneAction && !oneAction.enabled && !canAttemptSingleOpen && <p>单格开门：{oneAction.message}</p>}
    {allAction && !allAction.enabled && !canAttemptOpenAll && <p>管理员全开：{allAction.message}</p>}
    <p>单格开门前核查在线与门态；单开与管理员全开之后，系统按命令目标逐格查询并刷新格口卡片。</p>
    {notice && <p role="status">{notice}</p>}
    {query.isError && <Alert theme="error" message="查询结果回读失败，请按原查询 ID 核对。" />}
    {query.data && <p>查询 {query.data.query_id} · {query.data.kind} · {query.data.status} · 在线 {query.data.connectivity_status ?? '—'} · 门态 {query.data.door_status ?? '—'} · {query.data.result_code ?? ''}</p>}
    {oneAction && !slotOptions.some((item) => !item.disabled) && <p role="status">当前没有空闲且已启用的格口；请核对格口服务状态、资产及订单占用。</p>}
    {canAttemptSingleOpen && <p>单格开门会先查询设备在线和目标格口门态；仅确认门关且仍空闲时提交真实开门命令。</p>}
    {canAttemptOpenAll && <p>请先关好全部柜门。管理员全开会在短信验证前后自动核查全部配置格口；门开、未知或有业务占用时不会提交开门命令。</p>}
    {uncertain && <Alert theme="warning" message="请求结果尚未确认。请按原请求核对，并查看操作记录；不要创建新开门命令。" />}
    {uncertain && uncertainSingleOpen && <Button tag="button" variant="outline" disabled={disabled} loading={pending} onClick={() => { void openOneNow(true); }}>用原请求核对单格开门</Button>}
    {error && intent === null && <Alert theme="error" message={error} />}
    {command.isError && <Alert theme="error" message="命令结果读取失败，请刷新原记录核对；不会重新发送开门指令。" />}
    {command.data && <p>命令 {command.data.command_id} · 调用结果 {cabinetCommandResultLabel(command.data.execution_status)} · 目标格口 {command.data.targets.map((target) => target.compartment_no).join('、')}。实际门态见格口状态。</p>}
    <Dialog
      visible={intent !== null}
      header={intent === null ? '' : `确认${labels[intent]}`}
      width="min(680px, 92vw)"
      theme={intent === 'open_all' ? 'danger' : 'default'}
      confirmBtn={{ tag: 'button', content: uncertain ? '结果待核对' : challenge === null ? '获取验证码' : '确认管理员全开', theme: 'danger', loading: pending, disabled: disabled || uncertain || !form.siteConfirmed }}
      cancelBtn="取消"
      closeOnOverlayClick={false}
      onClose={cancelIntent}
      onCancel={cancelIntent}
      onConfirm={() => { void submit(); }}
    >
      <div className="cabinet-action-dialog">
      {uncertain && <Alert theme="warning" message="请求结果尚未确认。已停止重复提交；请核对柜门与原命令记录。" />}
      {intent === 'open_all' && <Alert theme="error" message={`高风险操作：将尝试打开此柜全部 ${cabinet.compartment_count} 个格口。接口返回成功即完成本次调用，之后逐格查询实际门态。调用结果未知时禁止再次开门。`} />}
      {challenge === null && <label className="cabinet-action-field"><span>操作原因 <em>必填</em></span><Textarea maxlength={256} autosize={{ minRows: 2, maxRows: 4 }} value={form.reason} disabled={pending || uncertain} onChange={(reason) => setForm((current) => ({ ...current, reason }))} /></label>}
      {intent === 'open_all' && challenge === null && <label className="cabinet-action-field"><span>现场负责人 <em>必填</em></span><Input value={form.responsible} disabled={pending || uncertain} onChange={(responsible) => setForm((current) => ({ ...current, responsible }))} /></label>}
      {intent === 'open_all' && challenge === null && <><div className="cabinet-action-facts"><span>租赁柜 <strong>{cabinet.cabinet_name}</strong></span><span>设备编号 <strong>{cabinet.provider_device_id}</strong></span><span>影响范围 <strong>{cabinet.compartment_count} 个格口</strong></span></div><label className="cabinet-action-field"><span>重新输入设备编号 <em>必填</em></span><Input placeholder="请手动输入上方设备编号" value={form.device} disabled={pending || uncertain} onChange={(device) => setForm((current) => ({ ...current, device }))} /></label></>}
      {intent === 'open_all' && currentChallenge && <><Alert theme={currentChallenge.delivery_status === 'SENT' ? 'success' : 'warning'} message={`短信状态：${currentChallenge.delivery_status} · 剩余尝试：${currentChallenge.remaining_attempts} · 截止 ${formatUTC(currentChallenge.expires_at)} · ${currentChallenge.masked_destination}`} /><label className="cabinet-action-field"><span>六位验证码 <em>必填</em></span><Input type="password" autocomplete="off" maxlength={6} value={form.proof} disabled={pending || uncertain || currentChallenge.delivery_status !== 'SENT'} onChange={(proof) => setForm((current) => ({ ...current, proof }))} /></label></>}
      {intent === 'open_all' && <Checkbox className="cabinet-action-consent" checked={form.siteConfirmed} disabled={pending || uncertain} onChange={(nextValue) => setForm((current) => ({ ...current, siteConfirmed: nextValue }))}><span>我已确认现场环境安全、周边无人员靠近，并核对柜内物品状态。</span></Checkbox>}
      {error && <Alert theme="error" message={error} />}
      </div>
    </Dialog>
  </section>;
}
