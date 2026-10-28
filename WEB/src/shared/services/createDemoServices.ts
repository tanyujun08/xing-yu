import type { AdminServices, ServiceRequestContext } from './contracts';
import type { DemoRuntime } from '../mock/runtime';
import { readCurrentSessionProjection } from '../access/session';
import { MockBehaviorController } from '../mock/scenario';

function actorId(): string {
  return readCurrentSessionProjection().accountId ?? 'mock-anonymous';
}

function withActor<T extends object>(input: T): T & { actorId: string } {
  return { ...input, actorId: actorId() };
}

async function query<T>(context: ServiceRequestContext | undefined, load: () => T | Promise<T>): Promise<T> {
  context?.signal?.throwIfAborted();
  const result = await load();
  context?.signal?.throwIfAborted();
  return result;
}

function requestSignal(args: readonly unknown[]): AbortSignal | undefined {
  for (const argument of args) {
    if (typeof argument !== 'object' || argument === null || !('signal' in argument)) continue;
    const signal = (argument as { signal?: unknown }).signal;
    if (signal instanceof AbortSignal) return signal;
  }
  return undefined;
}

function withMockBehavior<T extends object>(domain: string, gateway: T, controller: MockBehaviorController): T {
  return new Proxy(gateway, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => controller.execute(
        `${domain}.${String(property)}`,
        requestSignal(args),
        () => Reflect.apply(value, target, args) as unknown,
      );
    },
  });
}

export function createMockAdminServices(runtime: DemoRuntime, behaviorController = new MockBehaviorController()): AdminServices {
  const base: AdminServices = {
    runtime: {
      getInfo: async (context) => query(context, () => runtime.getInfo()),
      resetScenario: async (scenarioName) => runtime.resetScenario(scenarioName, actorId()),
    },
    dashboard: {
      getSummary: async (context) => query(context, () => runtime.getDashboardSummary()),
    },
    merchants: {
      list: async (context) => query(context, () => runtime.listMerchants()),
      getById: async (merchantId, context) => query(context, () => runtime.getMerchantById(merchantId)),
      create: async (input) => runtime.createMerchant(withActor(input)),
      update: async (input) => runtime.updateMerchant(withActor(input)),
      updatePhotos: async (merchantId, expectedVersion, photoMaterialIds) => runtime.updateMerchantPhotos(merchantId, expectedVersion, photoMaterialIds, actorId()),
      archive: async (input) => runtime.archiveMerchant(withActor(input)),
      restore: async (input) => runtime.restoreMerchant(withActor(input)),
    },
    cabinets: {
      list: async (context) => query(context, () => runtime.listCabinets()),
    },
    catalog: {
      listProducts: async (context) => query(context, () => runtime.listProducts()),
      listBrands: async (context) => query(context, () => [...new Map(runtime.listProducts().map((product) => [product.brandId, { id: product.brandId, name: product.brand, parentId: null }])).values()]),
      listCategories: async (context) => query(context, () => [...new Map(runtime.listProducts().map((product) => [product.category, { id: product.category, name: product.category, parentId: null }])).values()]),
      listSupplementRequests: async (context) => query(context, () => runtime.listProductSupplementRequests()),
      createProduct: async (input) => runtime.createProduct(withActor(input)),
      updateProduct: async (input) => runtime.updateProduct(withActor(input)),
      reviewSupplementRequest: async (input) => runtime.reviewProductSupplementRequest(withActor(input)),
    },
    assets: {
      list: async (context) => query(context, () => runtime.listAssets()),
      listLessors: async (context) => query(context, () => runtime.listLessors()),
      listTerms: async (assetId, context) => query(context, () => runtime.listAssetTerms(assetId)),
      createOfficialBatch: async (input) => runtime.createOfficialAssetBatch(withActor(input)),
      updateRFID: async (assetId, expectedVersion, rfidCode) => runtime.updateAssetRFID(assetId, expectedVersion, rfidCode, actorId()),
      update: async (input) => runtime.updateAsset(withActor(input)),
      review: async (input) => runtime.reviewAsset(withActor(input)),
      setPublishStatus: async (input) => runtime.setAssetPublishStatus(withActor(input)),
    },
    stars: {
      getAccount: async (userId, context) => query(context, () => runtime.getStarAccount(userId)),
      listLedger: async (userId, context) => query(context, () => runtime.listStarLedger(userId)),
    },
    
    
    audit: {
      list: async (limit, context) => query(context, () => runtime.listAuditEvents(limit)),
    },
    sessionAudit: {
      recordLoginAttempt: async (input) => runtime.recordLoginAttempt(input),
      recordRoleSwitch: async (input) => runtime.recordRoleSwitch(input),
    },
    rules: {
      getCurrent: async (context) => query(context, () => runtime.getCurrentBusinessRules()),
      listVersions: async (context) => query(context, () => runtime.listBusinessRuleVersions()),
      save: async (input) => runtime.saveBusinessRules(withActor(input)),
    },
    systemConfig: {
      listDefinitions: async () => [],
      listEffective: async () => [],
      listVersions: async () => ({ items: [], page: { page_size: 20, has_more: false } }),
      createVersion: async () => { throw new Error('强类型系统配置仅在 api-integration 模式可写'); },
      createDefault: async () => { throw new Error('强类型系统配置仅在 api-integration 模式可写'); },
      transition: async () => { throw new Error('强类型系统配置仅在 api-integration 模式可写'); },
    },
    materials: {
      uploadFile: async () => { throw new Error('真实文件上传仅在 api-integration 模式可用'); },
      get: async () => { throw new Error('素材查询仅在 api-integration 模式可用'); },
    },
    loyalty: {
      getCurrent: async (context) => query(context, () => runtime.getCurrentLoyaltyConfig()),
      listVersions: async (context) => query(context, () => runtime.listLoyaltyConfigVersions()),
      save: async (input) => runtime.saveLoyaltyConfig(withActor(input)),
    },
    members: {
      list: async (context) => query(context, () => runtime.listMembers()),
      getDossier: async (userId, context) => query(context, () => runtime.getUserDossier(userId)),
    },
    admins: {
      list: async (context) => query(context, () => runtime.listAdmins()),
      create: async (input) => runtime.createAdmin(withActor(input)),
      update: async (input) => runtime.updateAdmin(withActor(input)),
      setStatus: async (input) => runtime.setAdminStatus(withActor(input)),
      archive: async (input) => runtime.archiveAdmin(withActor(input)),
      restore: async (input) => runtime.restoreAdmin(withActor(input)),
    },
  };
  return Object.fromEntries(Object.entries(base).map(([domain, gateway]) => [
    domain,
    domain === 'runtime' || domain === 'sessionAudit' ? gateway : withMockBehavior(domain, gateway, behaviorController),
  ])) as unknown as AdminServices;
}

/** @deprecated Use createMockAdminServices. */
export const createDemoServices = createMockAdminServices;
