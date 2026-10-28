/** Parse a positive CNY UI price without rounding or binary floating arithmetic. */
export function positiveYuanToFen(value: string): number {
  const text = value.trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text)) throw new Error('价格必须大于 0 元，最多两位小数');
  const [whole = '0', fraction = ''] = text.split('.');
  const fen = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (fen <= 0n || fen > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('价格超出支持范围');
  return Number(fen);
}
