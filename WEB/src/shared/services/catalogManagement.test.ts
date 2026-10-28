import { describe, expect, it, vi } from 'vitest';
import type { ApiClient, RequestOptions } from '../api/client';
import { createCatalogManagement } from './catalogManagement';

const apiProduct = {
  product_id: 'product-1', product_no: '1'.repeat(32), name: '相机', brand_id: 'brand-1', category_id: 'category-1',
  model: 'M1', description: '', tags: ['摄影'], media: [], status: 'DRAFT', version: '1',
  created_at: '2026-09-22T00:00:00Z', updated_at: '2026-09-22T00:00:00Z',
};

describe('catalog management API boundary', () => {
  it('creates brand and root category through real directory endpoints', async () => {
    const request = vi.fn(async (input: RequestOptions<unknown>) => input.path.endsWith('/brands')
      ? { brand_id: 'brand-created', name: '索尼' }
      : { category_id: 'category-created', name: '摄影器材', parent_id: null });
    const api = createCatalogManagement({ request } as ApiClient);
    await expect(api.createBrand!('索尼')).resolves.toEqual({ id: 'brand-created', name: '索尼', parentId: null });
    await expect(api.createCategory!('摄影器材')).resolves.toEqual({ id: 'category-created', name: '摄影器材', parentId: null });
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: '/v1/ops/catalog/brands', method: 'POST', body: { name: '索尼' }, idempotencyKey: expect.any(String) }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/v1/ops/catalog/categories', method: 'POST', body: { name: '摄影器材', parent_id: null, sort_order: 0 }, idempotencyKey: expect.any(String) }));
  });

  it('uses real directory identities and exact product media/state contracts', async () => {
    const request = vi.fn(async (input: RequestOptions<unknown>) => {
      if (input.path.includes('/brands')) return { items: [{ brand_id: 'brand-1', name: '品牌', status: 'ACTIVE', version: '1', created_at: '', updated_at: '', allowed_actions: [], blocked_reasons: [] }], page: { page_size: 100, has_more: false } };
      if (input.path.includes('/categories')) return { items: [], page: { page_size: 100, has_more: false } };
      if (input.method === 'POST' && input.path.endsWith('/activate')) return { ...apiProduct, status: 'ACTIVE', version: '2' };
      if (input.method === 'POST') return apiProduct;
      return { items: [{ ...apiProduct, brand_name: '品牌', category_name: '分类', asset_count: '3', allowed_actions: [], blocked_reasons: [] }], page: { page_size: 100, has_more: false } };
    });
    const api = createCatalogManagement({ request } as ApiClient);
    await expect(api.listBrands()).resolves.toEqual([{ id: 'brand-1', name: '品牌', parentId: null }]);
    const products = await api.listProducts();
    expect(products[0]).toMatchObject({ brandId: 'brand-1', categoryId: 'category-1', assetCount: 3, status: 'DRAFT' });
    const images = Array.from({ length: 9 }, (_, index) => `image-${index}`);
    await api.createProduct({ name: '相机', brandId: 'brand-1', brand: '品牌', categoryId: 'category-1', category: '分类', model: 'M1', description: '', tags: [], coverMediaId: images[0]!, imageMediaIds: images, videoMediaIds: ['video-1', 'video-2'], command: { intentId: 'intent', idempotencyKey: 'key' } });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      path: '/v1/ops/catalog/products', method: 'POST', idempotencyKey: 'key',
      body: expect.objectContaining({ brand_id: 'brand-1', category_id: 'category-1', media: expect.arrayContaining([{ material_id: 'image-0', role: 'COVER', sort_order: 0 }, { material_id: 'video-2', role: 'VIDEO', sort_order: 1 }]) }),
    }));
    await api.setProductStatus!(products[0]!, 'activate', { intentId: 'activate', idempotencyKey: 'activate-key' });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/v1/ops/catalog/products/product-1/activate', aggregateVersion: '"v1"', idempotencyKey: 'activate-key' }));
  });

  it('rejects the tenth image and third video before an API write', async () => {
    const request = vi.fn();
    const api = createCatalogManagement({ request } as ApiClient);
    const base = { name: '相机', brandId: 'brand-1', brand: '品牌', categoryId: 'category-1', category: '分类', model: 'M1', description: '', tags: [] };
    await expect(api.createProduct({ ...base, imageMediaIds: Array.from({ length: 10 }, (_, index) => `image-${index}`) })).rejects.toThrow('最多 9 张图片');
    await expect(api.createProduct({ ...base, videoMediaIds: ['v1', 'v2', 'v3'] })).rejects.toThrow('最多 9 张图片');
    expect(request).not.toHaveBeenCalled();
  });
});
