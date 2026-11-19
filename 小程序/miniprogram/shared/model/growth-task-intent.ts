import type { components } from '../../../types/api/schema';
import { loyaltyIdentifier, validLoyaltyBody } from './loyalty-intent';

type ServerGrowthTask = components['schemas']['OwnGrowthTask'];
// The guide mission is an extension of the offline demo response only.
export type GrowthTask = ServerGrowthTask | (Omit<ServerGrowthTask, 'task_code'> & { task_code: 'READ_RENTAL_GUIDES'; target_count: number });
export type GrowthTaskList = Omit<components['schemas']['OwnGrowthTaskList'], 'items'> & { items: GrowthTask[] };
export type GrowthTaskClaim = Omit<components['schemas']['OwnGrowthTaskClaim'], 'task'> & { task: GrowthTask };
export type GrowthTaskGrant = components['schemas']['BenefitGrantReceipt'];
export type GrowthTaskGrantTrace = components['schemas']['BenefitGrantTrace'];

/** Only the original command is local; rewards and progress remain server facts. */
export interface GrowthTaskIntent {
  owner: string;
  benefitCode: string;
  key: string;
  body: Record<string, never>;
}

export function validGrowthTaskIntent(value: unknown, owner: string): value is GrowthTaskIntent {
  if (!validLoyaltyBody(value) || Object.keys(value).sort().join(',') !== 'benefitCode,body,key,owner') return false;
  return value['owner'] === owner && loyaltyIdentifier(owner) && loyaltyIdentifier(value['benefitCode'])
    && typeof value['key'] === 'string' && /^[A-Za-z0-9._:-]{8,128}$/.test(value['key'])
    && validLoyaltyBody(value['body']) && Object.keys(value['body']).length === 0;
}

export function sameGrowthTaskIntent(left: GrowthTaskIntent, right: GrowthTaskIntent): boolean {
  return left.owner === right.owner && left.benefitCode === right.benefitCode && left.key === right.key
    && validGrowthTaskIntent(left, left.owner) && validGrowthTaskIntent(right, right.owner);
}
