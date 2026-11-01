interface BusinessHours { week: { day: number; closed: boolean; intervals: { start: string; end: string }[] }[] }

export function businessHoursText(hours?: BusinessHours | null): string {
  if (!hours || !Array.isArray(hours.week) || !hours.week.length) return '';
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const groups: { first: number; last: number; text: string }[] = [];
  for (const day of [...hours.week].sort((a, b) => a.day - b.day)) {
    if (!days[day.day - 1]) continue;
    const text = day.closed ? '休息' : day.intervals.map(interval => `${interval.start}–${interval.end}`).join('、');
    const previous = groups[groups.length - 1];
    if (previous && previous.last + 1 === day.day && previous.text === text) previous.last = day.day;
    else groups.push({ first: day.day, last: day.day, text });
  }
  return groups.map(group => {
    const label = group.first === 1 && group.last === 7 ? '每天' : group.first === group.last ? days[group.first - 1] : `${days[group.first - 1]}至${days[group.last - 1]}`;
    return `${label} ${group.text}`;
  }).join('；');
}

export function isOpenNow(hours?: BusinessHours | null, now: Date = new Date()): boolean {
  if (!hours || !Array.isArray(hours.week)) return false;
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const today = hours.week.find(item => item.day === day);
  if (!today || today.closed) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (text: string) => { const [h, m] = text.split(':'); return Number(h) * 60 + Number(m); };
  return today.intervals.some(interval => minutes >= toMinutes(interval.start) && minutes < toMinutes(interval.end));
}

export function navigableLocation(location?: { latitude: string; longitude: string; coordinate_system: string } | null) {
  if (!location || location.coordinate_system !== 'GCJ02' || !location.latitude.trim() || !location.longitude.trim()) return null;
  const latitude = Number(location.latitude), longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
