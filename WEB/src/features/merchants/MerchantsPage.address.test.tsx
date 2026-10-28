import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MerchantsPage } from './MerchantsPage';
import type { OperatingAddress } from '../../shared/services';
vi.mock('tdesign-react', async (original) => ({ ...await original<object>(), MessagePlugin: { success: vi.fn(), error: vi.fn() } }));
const fx = vi.hoisted(() => ({ create: vi.fn(), load: vi.fn() }));
vi.mock('../../shared/access/session', async (original) => ({ ...await original<object>(), useSession: () => ({ accountId: 'test-ops', permissions: [], hasPermission: () => true }) }));
vi.mock('../../shared/services', () => ({ useAdminServices: () => ({ merchants: { search: async () => ({ items: [], hasMore: false, nextCursor: null }), listRegions: fx.load, create: fx.create } }) }));
vi.mock('../../shared/ui/MediaUploadField', () => ({ MediaUploadField: () => null }));
vi.mock('./TencentAddressPicker', () => ({ TencentAddressPicker: ({ onChange }: { onChange: (a: OperatingAddress, s: AbortSignal) => Promise<unknown> }) => <button type="button" onClick={() => { void onChange({ province: '广东省', city: '深圳市', district: '福田区', provinceCode: '', cityCode: '', districtCode: '440304', poiName: null, detailAddress: '公共路12号', fullAddress: '广东省深圳市福田区公共路12号', latitude: 22.5, longitude: 114.1, confirmationStatus: 'TENCENT_CONFIRMED' }, new AbortController().signal).catch(() => undefined); }}>测试地图选点</button> }));
const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.clearAllMocks(); });
async function openMerchantForm() {
 const tree = { '': [{ id: 'p', parentId: null, code: '440000', name: '广东省', level: 'PROVINCE' }], p: [{ id: 'c', parentId: 'p', code: '440300', name: '深圳市', level: 'CITY' }], c: [{ id: 'd', parentId: 'c', code: '440304', name: '福田区', level: 'DISTRICT' }] };
 let activeDataset = 'active';
 fx.load.mockImplementation(async (_d: string, parent: keyof typeof tree = '') => ({ datasetId: activeDataset, items: tree[parent].map((n) => ({ ...n, codeKind: 'NATIONAL', isVirtual: false })) }));
 fx.create.mockResolvedValue({});const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
 clients.push(client);
 render(<QueryClientProvider client={client}><MemoryRouter><MerchantsPage /></MemoryRouter></QueryClientProvider>);
 fireEvent.click(await screen.findByRole('button', { name: '新增商家' }));
 return { setDataset: (dataset: string) => { activeDataset = dataset; } };
}
async function chooseMapPoint() {
 fireEvent.click(await screen.findByText('测试地图选点'));
 await waitFor(() => expect(screen.getByPlaceholderText('道路、门牌或场所名称')).toHaveValue('公共路12号'));
 await waitFor(() => expect(screen.getByPlaceholderText('请选择省 / 市 / 区')).toHaveValue('广东省 / 深圳市 / 福田区'));
}
async function saveMerchant(datasetId: string) {
 fireEvent.change(screen.getByPlaceholderText('例如：南山影像空间'), { target: { value: '测试商家' } });
 fireEvent.change(screen.getByPlaceholderText('请输入联系人姓名'), { target: { value: '测试联系人' } });
 fireEvent.change(screen.getByPlaceholderText('请输入商家联系电话'), { target: { value: '13800000000' } });
 const account = screen.getByText('结算账户', { selector: 'label' }).closest('.t-form__item')?.querySelector<HTMLInputElement>('input');expect(account).not.toBeNull();fireEvent.change(account!, { target: { value: '测试账户' } });
 fireEvent.click(screen.getByRole('button', { name: '保存商家' }));
 await waitFor(() => expect(fx.create).toHaveBeenCalledWith(expect.objectContaining({ operatingAddress: expect.objectContaining({ datasetId, provinceId: 'p', cityId: 'c', districtId: 'd', latitude: 22.5, longitude: 114.1, detailAddress: '公共路12号' }) })));
}
test('map-first fills real TDesign fields and Cascader path, and create receives active IDs', async () => {
 await openMerchantForm();
 await chooseMapPoint();
 await saveMerchant('active');
});
test('a changed region dataset rejects the point until the operator selects it again', async () => {
 const form = await openMerchantForm();
 await chooseMapPoint();
 form.setDataset('next-active');
 fireEvent.click(screen.getByText('测试地图选点'));
 await screen.findByText('区划版本已变化，已刷新省市区，请重新选址');
 expect(fx.create).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('测试地图选点'));
 await waitFor(() => expect(screen.queryByText('区划版本已变化，已刷新省市区，请重新选址')).toBeNull());
 await waitFor(() => expect(screen.getByPlaceholderText('请选择省 / 市 / 区')).toHaveValue('广东省 / 深圳市 / 福田区'));
 await saveMerchant('next-active');
});
test('clearing the real Cascader invalidates the address until a new map point is confirmed', async () => {
 await openMerchantForm();
 await chooseMapPoint();
 const regionInput = screen.getByPlaceholderText('请选择省 / 市 / 区');
 fireEvent.mouseEnter(regionInput.closest('.t-input')!);
 const clear = regionInput.closest('.t-input')!.querySelector('.t-input__suffix-clear');
 expect(clear).not.toBeNull();fireEvent.click(clear!);
 await waitFor(() => expect(screen.getByPlaceholderText('道路、门牌或场所名称')).toHaveValue(''));
 expect(screen.getByText('地址变更后需重新确认')).toBeInTheDocument();
 expect(fx.create).not.toHaveBeenCalled();
 await chooseMapPoint();
});
