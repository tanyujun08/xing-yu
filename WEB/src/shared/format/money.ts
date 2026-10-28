import type { components } from '../api/generated/schema';

type Money = components['schemas']['Money'];

export function formatMoney(money: Money): string {
  const amount = BigInt(money.amount_minor);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  const prefix = money.currency === 'CNY' ? '¥' : `${money.currency} `;
  return `${negative ? '-' : ''}${prefix}${whole.toString()}.${fraction}`;
}

export function formatFen(amountFen: number, currency: 'CNY' = 'CNY'): string {
  if (!Number.isSafeInteger(amountFen)) {
    throw new Error('amountFen must be a safe integer');
  }
  const negative = amountFen < 0;
  const absolute = Math.abs(amountFen);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  const prefix = currency === 'CNY' ? '¥' : `${currency} `;
  return `${negative ? '-' : ''}${prefix}${whole}.${fraction}`;
}

export function formatFenExact(amountFen: string | number): string {
  if (typeof amountFen === 'number') return formatFen(amountFen);
  if (!/^(0|[1-9]\d*)$/.test(amountFen) || BigInt(amountFen) > 9223372036854775807n) throw new Error('amountFen is not a valid integer string');
  return formatMoney({ amount_minor: amountFen, currency: 'CNY' });
}
