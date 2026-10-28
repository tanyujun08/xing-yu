const integerPattern = /^-?[0-9]+$/;

export function formatCNYMinorUnits(amount: string): string {
  if (!integerPattern.test(amount)) {
    throw new Error('Money amount must be an integer string in minor units');
  }
  const negative = amount.startsWith('-');
  const unsigned = negative ? amount.slice(1) : amount;
  const normalized = unsigned.replace(/^0+(?=\d)/, '').padStart(3, '0');
  const yuan = normalized.slice(0, -2);
  const cents = normalized.slice(-2);
  const sign = negative && normalized !== '000' ? '-' : '';
  return `${sign}¥${yuan}.${cents}`;
}
