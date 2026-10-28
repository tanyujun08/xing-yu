export type RuntimeStage = 'develop' | 'trial' | 'release';
export function runtimeStage(): RuntimeStage { return 'develop'; }
export function apiOrigin(): string { return 'https://offline.invalid'; }
