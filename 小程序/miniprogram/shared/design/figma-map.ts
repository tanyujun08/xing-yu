export const figmaFileKey = '5srSnlaI9DwEchNeGOHrqb';

export type FigmaSurface = 'page' | 'state' | 'component';
export type DesignSource = 'figma' | 'derived';

export interface FigmaBoard {
  sourceNodeId: string;
  nodeId: string;
  name: string;
  route: string;
  surface: FigmaSurface;
  designSource: DesignSource;
}

const directBoards: FigmaBoard[] = [
  { sourceNodeId: '62:787', nodeId: '62:787', name: '首页', route: '/pages/home/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '2102:1416', nodeId: '2102:1416', name: '个人中心', route: '/pages/profile/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '2102:929', nodeId: '2102:929', name: '发布定价', route: '/pages/listing-price/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '2102:534', nodeId: '2102:534', name: '会员中心', route: '/pages/membership/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '62:947', nodeId: '62:947', name: '登录', route: '/pages/login/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '50:526', nodeId: '50:526', name: '柜机列表', route: '/pages/cabinets/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '161:934', nodeId: '161:934', name: '机柜详情', route: '/pages/cabinet-detail/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '161:1261', nodeId: '161:1261', name: '门店列表', route: '/pages/stores/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '161:1112', nodeId: '161:1112', name: '门店详情', route: '/pages/store-detail/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '50:247', nodeId: '50:247', name: '确认租赁订单', route: '/pages/confirm/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '161:1724', nodeId: '161:1724', name: '订单详情', route: '/pages/order-detail/index', surface: 'page', designSource: 'figma' },
  { sourceNodeId: '2007:26', nodeId: '2007:26', name: '底栏', route: '/pages/home/index', surface: 'component', designSource: 'figma' },
];

const derivedRoutes: Array<[string, string]> = [
  ['/pages/about/index', '关于星遇'],
  ['/pages/account-security/index', '账户安全'],
  ['/pages/check-in/index', '签到与非现金权益'],
  ['/pages/orders/index', '订单中心'],
  ['/pages/info/index', '沟通聚合'],
  ['/pages/order-messages/index', '订单消息'],
  ['/pages/private-messages/index', '私信'],
  ['/pages/info-guide/index', '租赁指南'],
  ['/pages/chat/index', '聊天'],
  ['/pages/profile/index', '个人中心'],
  ['/pages/profile-edit/index', '个人资料'],
  ['/pages/addresses/index', '地址管理'],
  ['/pages/detail/index', '设备详情'],
  ['/pages/identity/index', '实名认证'],
  ['/pages/wechat-waiver/index', '免押校验'],
  ['/pages/contract/index', '电子合同'],
  ['/pages/service-detail/index', '服务详情'],
  ['/pages/device-orders/index', '角色订单'],
  ['/pages/cabinet-code/index', '柜机凭证'],
  ['/pages/cabinet-open/index', '开柜'],
  ['/pages/return-submit/index', '提交归还'],
  ['/pages/cabinet-return/index', '柜机归还'],
  ['/pages/dispute/index', '售后与争议'],
  ['/pages/region/index', '地区选择'],
  ['/pages/publish-eligibility/index', '发布资格'],
  ['/pages/publish-quota/index', '发布额度'],
  ['/pages/rental-service/index', '出租服务'],
  ['/pages/publish/index', '发布设备'],
  ['/pages/listings/index', '我的发布'],
  ['/pages/listing-price/index', '发布定价'],
  ['/pages/wallet/index', '钱包'],
  ['/pages/withdrawal/index', '提现'],
  ['/pages/level-rights/index', '等级权益'],
  ['/pages/growth-tasks/index', '成长任务'],
  ['/pages/powder-ledger/index', '粉钻流水'],
  ['/pages/powder-mall/index', '粉钻商城'],
  ['/pages/star-ledger/index', '星光流水'],
  ['/pages/lottery/index', '粉钻抽奖'],
  ['/pages/no-deposit/index', '免押权益'],
  ['/pages/address-edit/index', '编辑地址'],
  ['/pages/coupons/index', '优惠券'],
  ['/pages/admin-approval/index', '后台登录确认'],
  ['/pages/coupon-detail/index', '优惠券详情'],
  // v1.0.1.7 R4 B2/I1 image handoff; this route has no authored Figma node.
  ['/pages/contract-sign/index', '合同本人手写签名'],
  // v1.0.1.7 R4 J4 image handoff; no authored Figma node exists for this page.
  ['/pages/order-fees/index', '订单费用依据'],
];

/** A 类页面/底栏直接追溯到新 Figma；C 类页面只登记推导关系，不伪造不存在的 Figma 节点。 */
export const figmaBoards: FigmaBoard[] = [
  ...directBoards,
  ...derivedRoutes.map(([route, name], index) => ({
    sourceNodeId: `derived:${index + 1}`,
    nodeId: `derived:${index + 1}`,
    name,
    route,
    surface: 'page' as const,
    designSource: 'derived' as const,
  })).filter((board) => !directBoards.some((directBoard) => directBoard.route === board.route && directBoard.surface === 'page')),
];

export function findFigmaBoard(nodeId: string): FigmaBoard | undefined {
  return figmaBoards.find((board) => board.sourceNodeId === nodeId || board.nodeId === nodeId);
}
