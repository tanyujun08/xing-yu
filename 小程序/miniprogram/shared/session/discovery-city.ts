// Public, transient selection preference. It does not assert availability or
// service activation and is never an authorization or account identity.
export type DiscoveryCity = { datasetId: string; cityId: string; name: string };
let selected: DiscoveryCity | null = null;
export function readDiscoveryCity(): DiscoveryCity | null { return selected ? { ...selected } : null; }
export function selectDiscoveryCity(value: DiscoveryCity | null): void { selected = value ? { ...value } : null; }