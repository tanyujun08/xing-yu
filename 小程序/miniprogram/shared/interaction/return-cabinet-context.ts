import { createRentalPageState } from './rental-page-state';
import { createNavigateOnce } from './navigate-once';

type RecordView<T> = { value: T; etag: string };
type Action = { action_code: string; allowed: boolean };
type ReturnOrder = { delivery: { method: string }; latest_cabinet_tasks: { task_id: string; purpose: string }[]; order: { allowed_actions: Action[] } };
type ReturnTask = { task_id: string; order_id: string; purpose: string; status: string; allowed_actions: Action[]; blockers: { message: string }[] };
function allowed(actions: Action[], code: string) { return actions.some(action => action.action_code === code && action.allowed); }

export function createReturnCabinetState<TOrder, TTask>(navigation = createNavigateOnce()) {
  return { ...createRentalPageState<RecordView<TOrder>>(undefined, navigation), task: null as RecordView<TTask> | null, readSequence: 0 };
}

/** Only the order's authorized RETURN task may control navigation or commands. */
export async function readReturnCabinetContext<TOrder extends ReturnOrder, TTask extends ReturnTask>(reader: { get(id: string): { promise: Promise<RecordView<TOrder>> }; task(id: string): { promise: Promise<RecordView<TTask>> } }, orderId: string, active: () => boolean) {
  const order = await reader.get(orderId).promise;
  if (!active()) return null;
  if (order.value.delivery.method !== 'CABINET') throw new Error('个人设备仅支持快递寄回');
  const summary = order.value.latest_cabinet_tasks.find(item => item.purpose === 'RETURN');
  const task = summary ? await reader.task(summary.task_id).promise : null;
  if (!active()) return null;
  if (task && (task.value.task_id !== summary?.task_id || task.value.order_id !== orderId || task.value.purpose !== 'RETURN')) throw new Error('归还任务与当前订单不一致，请刷新原订单');
  const terminal = !task || ['CANCELLED', 'FAILED_CONFIRMED'].includes(task.value.status);
  return { order, task, canSelect: terminal && allowed(order.value.order.allowed_actions, 'SELECT_COMPARTMENT') };
}

export async function readReturnCabinetOption<TCabinet extends { cabinet_id: string }>(readOptions: (id: string, cursor?: string) => { promise: Promise<{ value: { items: TCabinet[]; next_cursor: string | null } }> }, orderId: string, cabinetId: string, active: () => boolean) {
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const response = await readOptions(orderId, cursor).promise;
    if (!active()) return null;
    const cabinet = response.value.items.find(item => item.cabinet_id === cabinetId);
    if (cabinet) return cabinet;
    cursor = response.value.next_cursor ?? undefined;
    if (cursor && seen.has(cursor)) throw new Error('柜机列表读取未完成，请重新查询');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return null;
}

export function returnTaskView(task: RecordView<ReturnTask> | null) {
  const value = task?.value;
  return {
    taskId: value?.task_id ?? '', taskStatus: value?.status ?? '', taskCopy: value ? value.blockers.map(item => item.message).join('；') : '',
    canOpen: !!value && value.status === 'RESERVED' && allowed(value.allowed_actions, 'OPEN_CABINET'),
    canCancel: !!value && value.status === 'RESERVED' && allowed(value.allowed_actions, 'CANCEL_CABINET'),
    canQuery: !!value && allowed(value.allowed_actions, 'QUERY_CABINET'),
    canConfirm: !!value && allowed(value.allowed_actions, 'CONFIRM_RETURN'),
  };
}

export function returnCabinetFact(code: string | undefined) {
  const labels: Record<string, string> = { OPEN: '未关闭', CLOSED: '已关闭', UNKNOWN: '待核实', MATCH: '标签一致', MISMATCH: '标签不一致', NOT_OBSERVED: '待核验' };
  return labels[code ?? 'UNKNOWN'] ?? '待核实';
}
