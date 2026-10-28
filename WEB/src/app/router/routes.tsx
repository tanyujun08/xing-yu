import { Suspense, type ReactElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { RequirePermission } from '../guards/RequirePermission';
import { RequireSession } from '../guards/RequireSession';
import { permissions } from '../../shared/access/session';
import {
  AdminSettingsPage,
  AssetDetailPage,
  AssetsPage,
  CabinetsPage,
  CatalogPage,
  ContractPurchaseOrdersPage,
  RentalOrdersPage,
  DashboardPage,
  FinancePage,
  LoginLogsSettingsPage,
  LoginPage,
  LoyaltySettingsPage,
  CouponsSettingsPage,
  LotteryPrizesSettingsPage,
  MembershipPage,
  MerchantDetailPage,
  MerchantsPage,
  OperationLogsSettingsPage,
  RolesSettingsPage,
  RulesSettingsPage,
  UserDossierPage,
} from './lazyPages';
import { navigationLeaves, toChildRoutePath, type AppRouteKey } from './navigation';
import { ForbiddenPage, NotFoundPage, RouteLoadingPage } from './RouteMessages';

function loading(element: ReactElement): ReactElement {
  return <Suspense fallback={<RouteLoadingPage />}>{element}</Suspense>;
}

const routeElements: Record<AppRouteKey, ReactElement> = {
  dashboard: <DashboardPage />,
  merchants: <MerchantsPage />,
  cabinets: <CabinetsPage />,
  catalog: <CatalogPage />,
  assets: <AssetsPage />,
  'orders-contract-purchases': <ContractPurchaseOrdersPage />,
  'orders-rental': <RentalOrdersPage />,
  finance: <FinancePage />,
  membership: <MembershipPage />,
  'settings-rules': <RulesSettingsPage />,
  'settings-loyalty': <LoyaltySettingsPage />,
  'settings-coupons': <CouponsSettingsPage />,
  'settings-lottery-prizes': <LotteryPrizesSettingsPage />,
  'settings-admins': <AdminSettingsPage />,
  'settings-roles': <RolesSettingsPage />,
  'settings-login-logs': <LoginLogsSettingsPage />,
  'settings-operation-logs': <OperationLogsSettingsPage />,
};

const navigationRoutes: RouteObject[] = navigationLeaves().map((item) => {
  const element = (
    <RequirePermission permission={item.permission}>
      {loading(routeElements[item.key])}
    </RequirePermission>
  );

  return item.path === '/'
    ? { index: true, element }
    : { path: toChildRoutePath(item.path), element };
});

export const routes: RouteObject[] = [
  { path: '/login', element: loading(<LoginPage />) },
  {
    path: '/',
    element: <RequireSession><AppLayout /></RequireSession>,
    children: [
      ...navigationRoutes,
      {
        path: 'merchants/:merchantId',
        element: <RequirePermission permission={permissions.merchantView}>{loading(<MerchantDetailPage />)}</RequirePermission>,
      },
      {
        path: 'assets/:assetId',
        element: <RequirePermission permission={permissions.assetView}>{loading(<AssetDetailPage />)}</RequirePermission>,
      },
      {
        path: 'membership/:userId',
        element: <RequirePermission permission={permissions.memberView}>{loading(<UserDossierPage />)}</RequirePermission>,
      },
      {
        path: 'orders',
        element: (
          <RequirePermission permission={permissions.orderView}>
            <Navigate to="/orders/rental" replace />
          </RequirePermission>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequirePermission permission={permissions.systemView}>
            <Navigate to="/settings/rules" replace />
          </RequirePermission>
        ),
      },
      { path: '403', element: <ForbiddenPage /> },
      { path: '404', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/404" replace /> },
];
