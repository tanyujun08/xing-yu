export const MAX_LOYALTY_UNITS = '9223372036854775807';

export type ParsedInput<T> = { ok: true; value: T } | { ok: false; message: string };

const invalid = (message: string): ParsedInput<never> => ({ ok: false, message });

export function parseLoyaltyInteger(input: string, positive = false): ParsedInput<string> {
  if (!(positive ? /^[1-9][0-9]*$/ : /^(0|[1-9][0-9]*)$/).test(input)) {
    return invalid(positive ? '请输入不含小数、符号或前导零的正整数。' : '请输入不含小数、符号或前导零的非负整数。');
  }
  if (BigInt(input) > BigInt(MAX_LOYALTY_UNITS)) return invalid(`数值不能超过 ${MAX_LOYALTY_UNITS}。`);
  return { ok: true, value: input };
}

export function parseLoyaltyMoney(input: string): ParsedInput<string> {
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(input)) return invalid('请输入有效人民币金额，最多两位小数，不含符号或前导零。');
  const [whole = '0', fraction = ''] = input.split('.');
  const fen = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (fen === 0n) return invalid('抵扣金额必须大于零。');
  if (fen > BigInt(MAX_LOYALTY_UNITS)) return invalid('抵扣金额不能超过 92233720368547758.07 元。');
  return { ok: true, value: fen.toString() };
}

export function parseLoyaltyPercent(input: string): ParsedInput<number> {
  if (!/^(?:(?:0|[1-9][0-9]?)(?:\.[0-9]{1,2})?|100(?:\.0{1,2})?)$/.test(input)) {
    return invalid('概率须为 0～100 的百分比，最多两位小数。');
  }
  const [whole = '0', fraction = ''] = input.split('.');
  // The validated result is bounded by 10000; integer arithmetic keeps 0.01% exact.
  return { ok: true, value: Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) };
}

export function formatLoyaltyMoney(fen: string): string {
  const value = parseLoyaltyInteger(fen);
  if (!value.ok) return fen;
  const units = BigInt(value.value);
  return `${units / 100n}.${(units % 100n).toString().padStart(2, '0')}`;
}

export function formatLoyaltyPercent(bps: number): string {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) return String(bps);
  return `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, '0')}`;
}

export function loyaltyProbabilityTotal(inputs: readonly string[]): ParsedInput<{ totalBps: number; differenceBps: number }> {
  let totalBps = 0;
  for (const input of inputs) {
    const probability = parseLoyaltyPercent(input);
    if (!probability.ok) return probability;
    totalBps += probability.value;
  }
  return { ok: true, value: { totalBps, differenceBps: 10000 - totalBps } };
}

export function validateLoyaltyStock(totalInput: string, issuedQty: string, enabled: boolean): ParsedInput<string> {
  const total = parseLoyaltyInteger(totalInput);
  const issued = parseLoyaltyInteger(issuedQty);
  if (!total.ok) return total;
  if (!issued.ok) return invalid('已发库存数据异常，请重新读取库存。');
  if (BigInt(total.value) < BigInt(issued.value)) return invalid(`累计总份数不能少于已发 ${issued.value} 份。`);
  if (enabled && total.value === issued.value) return invalid('启用奖品必须有剩余库存，请补量或停用该奖品。');
  return total;
}

export function parseLoyaltyReason(input: string): ParsedInput<string> {
  const value = input.replaceAll('\r\n', '\n').trim();
  const length = [...value].length;
  if (length < 3 || length > 256) return invalid('保存原因须为 3～256 个字符。');
  return { ok: true, value };
}

export function validLoyaltyId(input: string): boolean {
  return /^[\x21-\x7e]{1,64}$/.test(input);
}

export function validLoyaltyIdempotencyKey(input: string): boolean {
  return /^[\x21-\x7e]{16,64}$/.test(input);
}

function validQueryTimestamp(input: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))?$/.exec(input);
  if (match === null) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0)
    && Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6] ?? '0') <= 59
    && Number(match[7] ?? '0') <= 23 && Number(match[8] ?? '0') <= 59;
}

export function parseLoyaltyTimeRange(from: string, to: string): ParsedInput<{ from?: string; to?: string }> {
  const first = from === '' ? null : new Date(from);
  const last = to === '' ? null : new Date(to);
  if (first !== null && (!validQueryTimestamp(from) || !Number.isFinite(first.getTime())) || last !== null && (!validQueryTimestamp(to) || !Number.isFinite(last.getTime()))) {
    return invalid('请输入有效的查询时间。');
  }
  if (first !== null && last !== null && first >= last) return invalid('结束时间须晚于开始时间，结束时间不含在查询范围内。');
  return { ok: true, value: { ...(first === null ? {} : { from: first.toISOString() }), ...(last === null ? {} : { to: last.toISOString() }) } };
}
