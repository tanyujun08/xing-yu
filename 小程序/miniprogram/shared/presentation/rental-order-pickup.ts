import { beijingTime, rentalActionAllowed } from './rental-order';
import { rentalDeliveryTerm } from './rental-order-delivery';

type Action = { action_code: string; allowed: boolean; display_reason: string | null };
type Order = {
    order: { supply_channel: string; viewer_role: string; stage: string; physical_status: string; has_exception: boolean;
        rental_start_at: string; rental_end_at: string; allowed_actions: readonly Action[] };
    delivery: { method: string };
    pickup: { name: string; address: string | null } | null;
    latest_cabinet_tasks: readonly { purpose: string; task_id: string; allowed_actions: readonly Action[] }[];
};

export function rentalOrderPickup(value: Order) {
    const o = value.order;
    if (o.supply_channel !== 'OFFICIAL_CABINET' || o.viewer_role !== 'TENANT' || o.stage !== 'ACTIVE' || o.physical_status !== 'NOT_DELIVERED' || o.has_exception || value.delivery.method !== 'CABINET' || !rentalActionAllowed(o.allowed_actions, 'READ_PICKUP_CODE')) return null;
    const ready = rentalActionAllowed(o.allowed_actions, 'OPEN_CABINET');
    const task = value.latest_cabinet_tasks.find(item => item.purpose === 'PICKUP');
    const taskAction = task ? ['QUERY_CABINET', 'OPEN_CABINET'].find(action => rentalActionAllowed(o.allowed_actions, action) && rentalActionAllowed(task.allowed_actions, action)) ?? '' : '';
    return { ready, taskAction, title: ready ? '可以取件了' : '待取件',
        start: beijingTime(o.rental_start_at), deadline: beijingTime(o.rental_end_at), term: rentalDeliveryTerm(o.rental_start_at, o.rental_end_at),
        name: value.pickup?.name ?? '', address: value.pickup?.address ?? '',
    };
}
