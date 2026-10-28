import { accountApi } from '../../shared/api/account-api';
import { rentalOrderApi } from '../../shared/api/rental-api';
import { designAssets } from '../../shared/design/assets';
import { createRentalOrdersPage } from '../../shared/interaction/rental-orders-page';
import { rentalOrderCard } from '../../shared/presentation/rental-order';
Page(createRentalOrdersPage({ currentOwner: accountApi.sessionIdentity, icons: designAssets, present: rentalOrderCard, assetScoped: true,
    load: async (filter) => { const result = await rentalOrderApi.list(filter).promise; return { items: result.value.items, hasMore: result.value.has_more, nextCursor: result.value.next_cursor }; },
}));
