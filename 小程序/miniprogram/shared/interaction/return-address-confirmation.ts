// A one-use handoff of the user's checkbox, never an API permission or persisted address.
let pending: { owner: string; orderId: string; snapshot: string; version: string } | null = null;
export function rememberReturnAddressConfirmation(owner: string, orderId: string, snapshot: string, version: string) {
    pending = owner && orderId && snapshot && /^[1-9][0-9]*$/.test(version) ? { owner, orderId, snapshot, version } : null;
}
export function takeReturnAddressConfirmation(owner: string, orderId: string, snapshot: string, version: string) {
    const value = pending; pending = null;
    return !!value && value.owner === owner && value.orderId === orderId && value.snapshot === snapshot && value.version === version;
}
export function clearReturnAddressConfirmation(owner: string, orderId: string) {
    if (pending?.owner === owner && pending.orderId === orderId) pending = null;
}
