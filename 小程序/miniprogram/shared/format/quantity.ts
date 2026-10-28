const maximum = '9223372036854775807';

export function isUnsignedQuantity(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value)
    && (value.length < maximum.length || value <= maximum);
}

/** PINK and quota display keep all digits; no floating-point conversion. */
export function displayQuantity(value: unknown): string {
  return isUnsignedQuantity(value) ? value : '—';
}

export function compareQuantities(left: string, right: string): -1 | 0 | 1 {
  if (!isUnsignedQuantity(left) || !isUnsignedQuantity(right)) throw new Error('数量必须是有效十进制整数字符串。');
  if (left === right) return 0;
  return left.length < right.length || (left.length === right.length && left < right) ? -1 : 1;
}

/** Confirmation preview only. Actual balance must always come from the API. */
export function quantityAfterCost(available: string, cost: string): string | null {
  if (compareQuantities(available, cost) < 0) return null;
  const digits: string[] = [];
  let borrow = 0;
  for (let index = 0; index < available.length; index += 1) {
    const left = available.charCodeAt(available.length - 1 - index) - 48;
    const rightIndex = cost.length - 1 - index;
    const right = rightIndex < 0 ? 0 : cost.charCodeAt(rightIndex) - 48;
    let digit = left - right - borrow;
    borrow = digit < 0 ? 1 : 0;
    if (digit < 0) digit += 10;
    digits.push(String(digit));
  }
  return digits.reverse().join('').replace(/^0+(?=\d)/, '');
}
