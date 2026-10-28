import { randomId } from '../../shared/randomId';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, MessagePlugin, Select, Space, Table, Tag, Textarea, type PrimaryTableCol } from 'tdesign-react';
import { AddIcon } from 'tdesign-icons-react';
import { PermissionGate } from '../../shared/access/PermissionGate';
import { permissions, useSession } from '../../shared/access/session';
import { useCommandSingleFlight } from '../../shared/commands/useCommandSingleFlight';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type Product } from '../../shared/services';
import { AdminFormDrawer } from '../../shared/ui/AdminFormDrawer';
import { AdminListPanel } from '../../shared/ui/AdminListPanel';
import { AdminAsyncState } from '../../shared/ui/AdminAsyncState';
import { classifyAdminAsyncError } from '../../shared/ui/adminAsyncStateModel';
import { FormGrid } from '../../shared/ui/FormGrid';
import { FormSection } from '../../shared/ui/FormSection';
import { ListFilterBar, ListFilterField } from '../../shared/ui/ListFilterBar';
import { ListPagination } from '../../shared/ui/ListPagination';
import { mediaRefsFromUploads, type StagedMediaFile } from '../../shared/media/demoMedia';
import { MediaThumbnail } from '../../shared/ui/MediaThumbnail';
import { MediaUploadField } from '../../shared/ui/MediaUploadField';
import { PageHeader } from '../../shared/ui/PageHeader';
import { StatusTag } from '../../shared/ui/StatusTag';
import { paginateListRows, useListParams } from '../../shared/ui/useListParams';
import { resolveCatalogName } from './catalogNameResolution';
import './catalog.css';

interface CatalogFormState {
  [key: string]: unknown;
  brand: string; model: string; name: string; category: string; description: string; tags: string;
  images: StagedMediaFile[]; videos: StagedMediaFile[];
}

const initialForm: CatalogFormState = { brand: '', model: '', name: '', category: '', description: '', tags: '', images: [], videos: [] };
const splitValues = (value: string) => value.split(',').map((entry) => entry.trim()).filter(Boolean);
const staged = (id: string, kind: 'image' | 'video'): StagedMediaFile => ({ id, materialId: id, name: id, mimeType: kind === 'image' ? 'image/*' : 'video/mp4', size: 0, dataUrl: '' });

export function CatalogPage() {
  const { accountId } = useSession();
  return <CatalogPageContent key={accountId ?? 'anonymous'} />;
}
function CatalogPageContent() {
  const services = useAdminServices();
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKeys = useAdminQueryKeys();
  const commands = useCommandSingleFlight();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(initialForm);
  const [imagesBlocked, setImagesBlocked] = useState(false);
  const [videosBlocked, setVideosBlocked] = useState(false);
  const mediaBlocked = imagesBlocked || videosBlocked;
  const formController = Form.useForm()[0]!;
  const list = useListParams({ defaultPageSize: 10 });
  const productQuery = useQuery({ queryKey: queryKeys.resource('catalog', 'products'), queryFn: ({ signal }) => services.catalog.listProducts({ signal }) });
  const brandQuery = useQuery({ queryKey: queryKeys.resource('catalog', 'brands'), queryFn: ({ signal }) => services.catalog.listBrands({ signal }) });
  const categoryQuery = useQuery({ queryKey: queryKeys.resource('catalog', 'categories'), queryFn: ({ signal }) => services.catalog.listCategories({ signal }) });
  const products = useMemo(() => Array.from(productQuery.data ?? []), [productQuery.data]);
  const keyword = list.get('keyword').trim().toLocaleLowerCase('zh-CN');
  const brand = list.get('brand'); const category = list.get('category'); const tag = list.get('tag'); const status = list.get('status');
  const filtered = useMemo(() => products.filter((product) => (keyword === '' || [product.name, product.brand, product.model, product.productNo].some((value) => value.toLocaleLowerCase('zh-CN').includes(keyword))) && (brand === '' || product.brand === brand) && (category === '' || product.category === category) && (tag === '' || product.tags.includes(tag)) && (status === '' || product.status === status)), [brand, category, keyword, products, status, tag]);
  const page = paginateListRows(filtered, list.page, list.pageSize);

  const closeDrawer = () => { setDrawerOpen(false); };
  const openCreate = () => { if (editing !== null) setForm(initialForm); setEditing(null); setDrawerOpen(true); };
  const openEdit = (product: Product) => {
    if (editing?.id === product.id) { setDrawerOpen(true); return; }
    setEditing(product);
    setForm({ brand: product.brand, model: product.model, name: product.name, category: product.category, description: product.description, tags: product.tags.join(','), images: product.imageMediaIds.map((id) => staged(id, 'image')), videos: product.videoMediaIds.map((id) => staged(id, 'video')) });
    setDrawerOpen(true);
  };
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mediaBlocked) throw new Error('请先完成或移除待处理素材');
      const brandEntry = await resolveCatalogName(form.brand, brandQuery.data ?? [], services.catalog.createBrand, () => services.catalog.listBrands());
      const categoryEntry = await resolveCatalogName(form.category, categoryQuery.data ?? [], services.catalog.createCategory, () => services.catalog.listCategories());
      const imageMediaIds = mediaRefsFromUploads(form.images, session.apiMode);
      const idempotencyKey = randomId();
      const input = { name: form.name, brandId: brandEntry.id, brand: brandEntry.name, model: form.model, categoryId: categoryEntry.id, category: categoryEntry.name, description: form.description, tags: splitValues(form.tags), coverMediaId: imageMediaIds[0] ?? null, imageMediaIds, videoMediaIds: mediaRefsFromUploads(form.videos, session.apiMode), command: { intentId: idempotencyKey, idempotencyKey } };
      if (editing === null) return services.catalog.createProduct(input);
      if (!editing.version) throw new Error('缺少商品版本，请刷新后重试');
      return services.catalog.updateProduct({ ...input, productId: editing.id, status: editing.status, version: editing.version });
    },
    onSuccess: async () => { const created = editing === null; await queryClient.invalidateQueries({ queryKey: queryKeys.domain('catalog') }); closeDrawer(); setEditing(null); setForm(initialForm); await MessagePlugin.success(created ? '标准商品草稿已保存' : '标准商品已更新'); },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '商品保存失败'),
  });
  const statusMutation = useMutation({
    mutationFn: ({ product, action }: { product: Product; action: 'activate' | 'deactivate' }) => commands.run(product.id, `product-${action}`, (command) => {
      if (!services.catalog.setProductStatus) throw new Error('当前网关不支持商品状态变更');
      return services.catalog.setProductStatus(product, action, command);
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: queryKeys.domain('catalog') }); await MessagePlugin.success('商品状态已更新'); },
    onError: async (error) => MessagePlugin.error(error instanceof Error ? error.message : '商品状态更新失败'),
  });

  const productColumns: PrimaryTableCol<Product>[] = [
    { colKey: 'product', title: '标准商品', width: 280, cell: ({ row }) => <div className="catalog-product-cell catalog-product-cell--media"><MediaThumbnail mediaRef={row.coverMediaId ?? row.imageMediaIds[0]} alt={`${row.name}标准封面`} /><div><strong>{row.name}</strong><span>{row.productNo}</span></div></div> },
    { colKey: 'brandModel', title: '品牌 / 型号', width: 150, cell: ({ row }) => <div className="catalog-product-cell"><strong>{row.brand}</strong><span>{row.model}</span></div> },
    { colKey: 'category', title: '分类 / 标签', width: 180, cell: ({ row }) => <div className="catalog-product-cell"><span>{row.category}</span><Space breakLine size={4}>{row.tags.slice(0, 3).map((value) => <Tag key={value} size="small" variant="light">{value}</Tag>)}</Space></div> },
    { colKey: 'media', title: '标准素材', width: 110, cell: ({ row }) => `${row.imageMediaIds.length} 图 · ${row.videoMediaIds.length} 视频` },
    { colKey: 'assets', title: '关联资产', width: 80, cell: ({ row }) => `${row.assetCount ?? 0} 台` },
    { colKey: 'status', title: '状态', width: 80, cell: ({ row }) => <StatusTag value={row.status} /> },
    { colKey: 'actions', title: '操作', width: 235, cell: ({ row }) => <PermissionGate permission={permissions.catalogManage}><Space size={4}><Button size="small" variant="text" onClick={() => openEdit(row)}>编辑</Button>{row.status === 'ACTIVE' ? <Button size="small" variant="text" theme="danger" disabled={row.allowedActions?.find((action) => action.code === 'DEACTIVATE')?.enabled === false} onClick={() => statusMutation.mutate({ product: row, action: 'deactivate' })}>停用</Button> : <Button size="small" variant="text" theme="primary" onClick={() => statusMutation.mutate({ product: row, action: 'activate' })}>启用</Button>}<Button size="small" variant="text" onClick={() => navigate(`/assets?keyword=${encodeURIComponent(row.name)}`)}>查看资产</Button></Space></PermissionGate> },
  ];
  const failure = productQuery.error ?? brandQuery.error ?? categoryQuery.error;

  return <div>
    <PageHeader title="商品管理" description="统一维护品牌、型号与标准 SKU；租金、押金、配件和每台设备档案在资产中配置。" actions={<PermissionGate permission={permissions.catalogManage}><Button theme="primary" icon={<AddIcon />} onClick={openCreate}>新增标准商品</Button></PermissionGate>} />
    <section className="catalog-metric-strip" aria-label="商品概览">
      {[{ label: '商品总数', value: products.length, tone: 'neutral' }, { label: '已启用', value: products.filter((product) => product.status === 'ACTIVE').length, tone: 'success' }, { label: '草稿', value: products.filter((product) => product.status === 'DRAFT').length, tone: 'warning' }, { label: '已停用', value: products.filter((product) => product.status === 'INACTIVE').length, tone: 'danger' }].map((metric) => <div key={metric.label} className={`catalog-metric-strip__item catalog-metric-strip__item--${metric.tone}`}><span><i aria-hidden="true" />{metric.label}</span><strong>{metric.value}</strong></div>)}
    </section>
    <AdminListPanel className="catalog-list-table" density="media" title="标准商品清单" count={filtered.length} countLabel="个商品" filters={<ListFilterBar className="catalog-filter-bar" ariaLabel="商品筛选" actions={<Button size="small" variant="outline" onClick={list.resetFilters}>重置</Button>}><ListFilterField label="关键词" wide><Input clearable placeholder="商品名、品牌或型号" value={list.get('keyword')} onChange={(value) => list.setFilters({ keyword: value })} /></ListFilterField><ListFilterField label="品牌"><Select clearable placeholder="全部" options={[...new Set(products.map((product) => product.brand))].map((value) => ({ label: value, value }))} value={brand} onChange={(value) => list.setFilters({ brand: value == null ? null : String(value) })} /></ListFilterField><ListFilterField label="分类"><Select clearable placeholder="全部" options={[...new Set(products.map((product) => product.category))].map((value) => ({ label: value, value }))} value={category} onChange={(value) => list.setFilters({ category: value == null ? null : String(value) })} /></ListFilterField><ListFilterField label="状态"><Select clearable placeholder="全部" options={[{ label: '启用', value: 'ACTIVE' }, { label: '草稿', value: 'DRAFT' }, { label: '停用', value: 'INACTIVE' }]} value={status} onChange={(value) => list.setFilters({ status: value == null ? null : String(value) })} /></ListFilterField><ListFilterField label="标签"><Select clearable placeholder="全部" options={[...new Set(products.flatMap((product) => product.tags))].map((value) => ({ label: value, value }))} value={tag} onChange={(value) => list.setFilters({ tag: value == null ? null : String(value) })} /></ListFilterField></ListFilterBar>} pagination={<ListPagination current={page.current} pageSize={page.pageSize} total={page.total} onChange={(current, pageSize) => list.update({ page: current, pageSize })} ariaLabel="商品分页" />}>
      {failure !== null ? <AdminAsyncState kind={classifyAdminAsyncError(failure)} title="商品数据加载失败" actionLabel="重新加载" onAction={() => void Promise.all([productQuery.refetch(), brandQuery.refetch(), categoryQuery.refetch()])} /> : <Table rowKey="id" data={page.rows} columns={productColumns} loading={productQuery.isLoading} hover tableLayout="fixed" empty="暂无标准商品" />}
    </AdminListPanel>
    <AdminFormDrawer visible={drawerOpen} title={editing === null ? '新增标准商品' : '编辑标准商品'} description="建立可复用的商品基准，不在这里维护租金、押金、配件或库存。" confirmText="保存商品" form={formController} values={form} pending={saveMutation.isPending} submitBlocked={mediaBlocked} dirty={JSON.stringify(form) !== JSON.stringify(initialForm)} onCancel={closeDrawer} onSubmit={() => saveMutation.mutateAsync().then(() => undefined)}>
      <FormSection title="基础信息" description="输入品牌和分类名称，保存时复用或创建真实目录记录；商品保存后默认为草稿。"><FormGrid>
        <Form.FormItem name="brand" label="品牌" rules={[{ required: true, whitespace: true, message: '请输入品牌' }]}><Input value={form.brand} onChange={(brand) => setForm((value) => ({ ...value, brand }))} /></Form.FormItem>
        <Form.FormItem name="model" label="型号" rules={[{ required: true, whitespace: true, message: '请输入型号' }]}><Input value={form.model} onChange={(model) => setForm((value) => ({ ...value, model }))} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="name" label="对外商品名" rules={[{ required: true, whitespace: true, message: '请输入商品名' }]}><Input value={form.name} onChange={(name) => setForm((value) => ({ ...value, name }))} /></Form.FormItem>
        <Form.FormItem name="category" label="分类" rules={[{ required: true, whitespace: true, message: '请输入分类' }]}><Input value={form.category} onChange={(category) => setForm((value) => ({ ...value, category }))} /></Form.FormItem>
        <Form.FormItem name="tags" label="标签（选填）"><Input value={form.tags} onChange={(tags) => setForm((value) => ({ ...value, tags }))} placeholder="多个标签用逗号分隔" /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="description" label="商品说明"><Textarea value={form.description} onChange={(description) => setForm((value) => ({ ...value, description }))} /></Form.FormItem>
      </FormGrid></FormSection>
      <FormSection title="标准素材" description="最多 9 张图片（首图为封面）和 2 个 MP4 原件；单个视频上限 100 MiB（104,857,600 字节），不转码。"><FormGrid>
        <Form.FormItem className="admin-form-grid__full" name="images" label="商品图片（选填）"><MediaUploadField kind="image" max={9} materialClass="CATALOG_IMAGE" ownerId={session.accountId} active={drawerOpen} onStateChange={(state) => setImagesBlocked(state.blocked)} label="上传商品图片" value={form.images} onChange={(images) => setForm((value) => ({ ...value, images }))} /></Form.FormItem>
        <Form.FormItem className="admin-form-grid__full" name="videos" label="商品视频（选填）"><MediaUploadField kind="video" max={2} materialClass="CATALOG_VIDEO" ownerId={session.accountId} active={drawerOpen} onStateChange={(state) => setVideosBlocked(state.blocked)} label="上传商品视频" value={form.videos} onChange={(videos) => setForm((value) => ({ ...value, videos }))} /></Form.FormItem>
      </FormGrid></FormSection>
    </AdminFormDrawer>
  </div>;
}
