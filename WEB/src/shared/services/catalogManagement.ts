import { randomId } from '../randomId';
import type { components } from '../api/generated/schema';
import type { ApiClient } from '../api/client';
import type { CatalogDirectoryOption, CatalogGateway, CreateProductInput, Product, ServiceRequestContext, UpdateProductInput } from './contracts';

type ApiProduct = components['schemas']['Product'];
type ApiProductView = components['schemas']['ProductView'];
type ProductPage = components['schemas']['ProductPage'];
type BrandPage = components['schemas']['CatalogBrandPage'];
type CategoryPage = components['schemas']['CatalogCategoryPage'];
type CatalogBrand = components['schemas']['CatalogBrand'];
type CatalogCategory = components['schemas']['CatalogCategory'];
const base = '/v1/ops/catalog/products';
const options = (context?: ServiceRequestContext) => context?.signal === undefined ? {} : { signal: context.signal };

function productProjection(value: ApiProduct | ApiProductView): Product {
  const cover = value.media.find((entry) => entry.role === 'COVER')?.material_id ?? null;
  return {
    id: value.product_id, productNo: value.product_no, brandId: value.brand_id, categoryId: value.category_id,
    name: value.name, brand: 'brand_name' in value ? value.brand_name : value.brand_id,
    model: value.model, normalizedModel: value.model, normalizedName: value.name,
    category: 'category_name' in value ? value.category_name : value.category_id,
    description: value.description, tags: value.tags, coverMediaId: cover,
    imageMediaIds: value.media.filter((entry) => entry.role === 'COVER' || entry.role === 'IMAGE').map((entry) => entry.material_id),
    videoMediaIds: value.media.filter((entry) => entry.role === 'VIDEO').map((entry) => entry.material_id),
    status: value.status, version: value.version,
    ...('asset_count' in value ? { assetCount: Number(value.asset_count), allowedActions: value.allowed_actions } : {}),
    createdAt: value.created_at, updatedAt: value.updated_at,
  };
}

function productBody(input: CreateProductInput) {
  if (!input.categoryId) throw new Error('请选择服务端商品分类');
  const imageIds = [...(input.imageMediaIds ?? [])];
  const cover = input.coverMediaId ?? imageIds[0];
  const orderedImages = cover === undefined || cover === null ? imageIds : [cover, ...imageIds.filter((id) => id !== cover)];
  if (orderedImages.length > 9 || (input.videoMediaIds?.length ?? 0) > 2) throw new Error('商品最多 9 张图片和 2 个视频');
  return {
    name: input.name, brand_id: input.brandId, category_id: input.categoryId, model: input.model,
    description: input.description, tags: [...input.tags],
    media: [
      ...orderedImages.map((material_id, index) => ({ material_id, role: index === 0 ? 'COVER' as const : 'IMAGE' as const, sort_order: index === 0 ? 0 : index - 1 })),
      ...(input.videoMediaIds ?? []).map((material_id, sort_order) => ({ material_id, role: 'VIDEO' as const, sort_order })),
    ],
  } satisfies components['schemas']['ProductInput'];
}

async function collectPages<T>(load: (cursor: string) => Promise<{ items: T[]; page: { has_more: boolean; next_cursor?: string | null } }>): Promise<T[]> {
  const result: T[] = [];
  let cursor = '';
  do {
    const page = await load(cursor);
    result.push(...page.items);
    cursor = page.page.has_more ? page.page.next_cursor ?? '' : '';
    if (page.page.has_more && cursor === '') throw new Error('服务端分页游标缺失');
  } while (cursor !== '');
  return result;
}

export function createCatalogManagement(client: ApiClient): CatalogGateway {
  const listProducts = async (context?: ServiceRequestContext) => (await collectPages<ApiProductView>((cursor) => client.request<ProductPage>({ path: `${base}?page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, ...options(context) }))).map(productProjection);
  return {
    listProducts,
    listBrands: async (context) => (await collectPages((cursor) => client.request<BrandPage>({ path: `/v1/ops/catalog/brands?page_size=100&status=ACTIVE${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, ...options(context) }))).map((item) => ({ id: item.brand_id, name: item.name, parentId: null })),
    listCategories: async (context) => {
      const result: CatalogDirectoryOption[] = [];
      const queue: (string | null)[] = [null];
      while (queue.length > 0) {
        const parentId = queue.shift()!;
        const entries = await collectPages((cursor) => client.request<CategoryPage>({ path: `/v1/ops/catalog/categories?page_size=100&status=ACTIVE${parentId === null ? '' : `&parent_id=${encodeURIComponent(parentId)}`}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, ...options(context) }));
        for (const item of entries) {
          result.push({ id: item.category_id, name: item.name, parentId: item.parent_id });
          queue.push(item.category_id);
        }
      }
      return result;
    },
    createBrand: async (name) => {
      const value = await client.request<CatalogBrand, components['schemas']['CatalogBrandInput']>({ path: '/v1/ops/catalog/brands', method: 'POST', body: { name }, idempotencyKey: randomId() });
      return { id: value.brand_id, name: value.name, parentId: null };
    },
    createCategory: async (name) => {
      const value = await client.request<CatalogCategory, components['schemas']['CatalogCategoryInput']>({ path: '/v1/ops/catalog/categories', method: 'POST', body: { name, parent_id: null, sort_order: 0 }, idempotencyKey: randomId() });
      return { id: value.category_id, name: value.name, parentId: value.parent_id };
    },
    listSupplementRequests: async () => { throw new Error('商品补录功能已移除'); },
    createProduct: async (input) => productProjection(await client.request<ApiProduct, components['schemas']['ProductInput']>({ path: base, method: 'POST', body: productBody(input), idempotencyKey: input.command?.idempotencyKey ?? randomId() })),
    updateProduct: async (input: UpdateProductInput) => {
      if (!input.version) throw new Error('缺少商品版本，请刷新后重试');
      return productProjection(await client.request<ApiProduct, components['schemas']['ProductPatch']>({ path: `${base}/${encodeURIComponent(input.productId)}`, method: 'PATCH', body: { ...productBody(input), reason: '后台编辑标准商品' }, aggregateVersion: `"v${input.version}"`, idempotencyKey: input.command?.idempotencyKey ?? randomId() }));
    },
    setProductStatus: async (product, action, command) => {
      if (!product.version) throw new Error('缺少商品版本，请刷新后重试');
      return productProjection(await client.request<ApiProduct, components['schemas']['ProductReason']>({ path: `${base}/${encodeURIComponent(product.id)}/${action}`, method: 'POST', body: { reason: action === 'activate' ? '后台启用标准商品' : '后台停用标准商品' }, aggregateVersion: `"v${product.version}"`, idempotencyKey: command.idempotencyKey }));
    },
    reviewSupplementRequest: async () => { throw new Error('商品补录功能已移除'); },
  };
}
