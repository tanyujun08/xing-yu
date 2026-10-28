import { readMockState, writeMockState } from './mock-store';

export type IdentityStatus = 'unverified' | 'documents_submitted' | 'verified';
export interface AccountIdentityProfile { status: IdentityStatus; name: string; idNumber: string; submittedAt: string | null; verifiedAt: string | null; }
export interface IdentityResult { ok: boolean; profile: AccountIdentityProfile; reason: string; }

const emptyProfile: AccountIdentityProfile = { status: 'unverified', name: '', idNumber: '', submittedAt: null, verifiedAt: null };
function nowText(): string { return new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'); }

export function getIdentityProfile(): AccountIdentityProfile {
  const state = readMockState();
  return { ...(state.identityProfiles[state.currentAccountId] ?? emptyProfile) };
}

function save(profile: AccountIdentityProfile): AccountIdentityProfile {
  const state = readMockState();
  state.identityProfiles[state.currentAccountId] = { ...profile };
  writeMockState(state);
  return { ...profile };
}

export function submitIdentityDocuments(nameValue: string, idNumberValue: string): IdentityResult {
  const name = nameValue.trim();
  const idNumber = idNumberValue.trim().toUpperCase();
  if (name.length < 2) return { ok: false, profile: getIdentityProfile(), reason: '请填写真实姓名' };
  if (!/^\d{17}[\dX]$/.test(idNumber)) return { ok: false, profile: getIdentityProfile(), reason: '请填写正确的身份证号码' };
  return { ok: true, profile: save({ status: 'documents_submitted', name, idNumber, submittedAt: nowText(), verifiedAt: null }), reason: '' };
}

export function completeFaceAuthentication(): IdentityResult {
  const profile = getIdentityProfile();
  if (profile.status !== 'documents_submitted') return { ok: false, profile, reason: '请先提交证件信息' };
  return { ok: true, profile: save({ ...profile, status: 'verified', verifiedAt: nowText() }), reason: '' };
}

export function resetIdentityProfile(): void {
  const state = readMockState();
  delete state.identityProfiles[state.currentAccountId];
  writeMockState(state);
}
