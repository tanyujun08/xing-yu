// Transient navigation preference only; the API still decides access to each role's orders.
let next: { owner: string; role: 'rent' | 'lend' } | null = null;
export function setOrderListContext(owner: string, role: string) {
    next = owner && ['TENANT', 'LESSOR'].includes(role) ? { owner, role: role === 'LESSOR' ? 'lend' : 'rent' } : null;
}
export function consumeOrderListContext(owner: string) {
    const value = next; next = null;
    return value?.owner === owner ? value.role : null;
}
