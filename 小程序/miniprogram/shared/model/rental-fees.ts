import type { components } from '../../../types/api/schema';

export type RentalFeeOrder = components['schemas']['OrderDetail'];
export type RentalFeeAssessment = NonNullable<RentalFeeOrder['bill']['assessment']>;
