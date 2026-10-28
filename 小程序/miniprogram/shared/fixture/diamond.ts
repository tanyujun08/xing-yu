export const DIAMOND_POINTS_PER_YUAN = 100;
export const DIAMOND_FEN_PER_YUAN = 100;
export const DEFAULT_MOCK_DIAMOND_BALANCE = 1280;

export function requireNonNegativeSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label}必须是非负安全整数`);
  return value;
}

function floorMultiplyDivide(value: number, multiplier: number, divisor: number, label: string): number {
  const result = Number((BigInt(value) * BigInt(multiplier)) / BigInt(divisor));
  return requireNonNegativeSafeInteger(result, label);
}

function ceilMultiplyDivide(value: number, multiplier: number, divisor: number, label: string): number {
  const numerator = BigInt(value) * BigInt(multiplier);
  const denominator = BigInt(divisor);
  const result = Number((numerator + denominator - 1n) / denominator);
  return requireNonNegativeSafeInteger(result, label);
}

/** Converts whole Mock PINK units to integer currency fen; sub-fen remainder is discarded. */
export function diamondFenForPoints(points: number): number {
  return floorMultiplyDivide(requireNonNegativeSafeInteger(points, '粉钻数量'), DIAMOND_FEN_PER_YUAN, DIAMOND_POINTS_PER_YUAN, '粉钻抵扣金额');
}

/** Returns the exact whole-point amount consumed for an integer fen deduction. */
export function diamondPointsForFen(fen: number): number {
  return ceilMultiplyDivide(requireNonNegativeSafeInteger(fen, '抵扣金额'), DIAMOND_POINTS_PER_YUAN, DIAMOND_FEN_PER_YUAN, '粉钻数量');
}

export function maxDiamondDeductionFen(targetFen: number, availablePoints: number): number {
  return Math.min(requireNonNegativeSafeInteger(targetFen, '目标金额'), diamondFenForPoints(availablePoints));
}
