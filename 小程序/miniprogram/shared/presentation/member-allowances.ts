interface AllowanceSummary {
  as_of_at: string;
  allowances: { allowance_id: string; cycle_key: string; cycle_start: string; cycle_end: string; granted_count: string; reserved_count: string; consumed_count: string; revoked_count: string; available_count: string }[];
}

export function currentAllowances(summary: AllowanceSummary) {
  const asOf = Date.parse(summary.as_of_at);
  if (!Number.isFinite(asOf) || !Array.isArray(summary.allowances)) throw new Error('免押次数读取不完整，请刷新。');
  return summary.allowances.filter(item => {
    const start = Date.parse(item.cycle_start), end = Date.parse(item.cycle_end);
    return Number.isFinite(start) && Number.isFinite(end) && start <= asOf && asOf < end;
  }).map(item => {
    for (const value of [item.granted_count, item.reserved_count, item.consumed_count, item.revoked_count, item.available_count]) {
      if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('免押次数读取不完整，请刷新。');
    }
    return { id: item.allowance_id, cycle: item.cycle_key, available: item.available_count, reserved: item.reserved_count, consumed: item.consumed_count, granted: item.granted_count };
  });
}
