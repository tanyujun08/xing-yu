const blockerLabels: Record<string, string> = {
  LATEST_APPROVED_REVISION_REQUIRED: '最新版本尚未就绪；请核对资产状态',
  CABINET_PLACEMENT_REQUIRED: '请先将资产入柜，再点击上架',
  PUBLICATION_LOCATION_REQUIRED: '柜机所属商家地址或定位尚未核验',
  MATERIALS_NOT_READY: '设备素材尚未就绪',
  ASSET_UNAVAILABLE: '资产已冻结或退役',
  LESSOR_DISABLED: '出租主体已停用',
  PUBLISHER_DISABLED: '发布人已停用',
  CATALOG_INACTIVE: '标准商品或分类已停用',
  RENTAL_PERIOD_ENDED: '资产可租期已结束',
  DELIVERY_REQUIRED: '交付方式尚未配置',
  STORE_PLACEMENT_REQUIRED: '门店资产尚未完成投放',
  ALREADY_ONLINE: '资产已经上架',
  NOT_ONLINE: '资产当前未上架',
};

export function publicationBlockerMessages(codes: readonly string[]): string[] {
  return codes.map((code) => blockerLabels[code] ?? `上架条件未满足（${code}）`);
}
