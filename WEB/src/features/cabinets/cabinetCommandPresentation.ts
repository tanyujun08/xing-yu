import type { ManagedCabinetCommand } from '../../shared/services/cabinetManagement';

const resultLabels: Record<ManagedCabinetCommand['execution_status'], string> = {
  REQUESTED: '排队中', DISPATCHING: '调用中', ACCEPTED: '调用成功', FAILED_NOT_SENT: '调用失败', UNKNOWN: '调用结果待核对',
};

export const cabinetCommandResultLabel = (status: ManagedCabinetCommand['execution_status']) => resultLabels[status];

// A bounded UI refresh budget; expiry never changes the command or its server result.
export const cabinetCommandDoorRefreshBudget = (targetCount: number) => Math.min(120_000, 15_000 + targetCount * 7_000);
