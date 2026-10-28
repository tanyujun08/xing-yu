import { availableServices } from './service-benefits';
import { getMockMemberRules } from './member-rules';
import { applyMemberReward, completeMemberCheckIn, settleGrowthTask, recordMemberVisit } from './member-benefits';
import { parseDateTimeMs, type DeliveryMethod, type DepositPlan, type RentalOrder } from './order-machine';
import type { RentalMode, SupplyType } from './lifecycle-rules';
import { DEFAULT_MOCK_DIAMOND_BALANCE, requireNonNegativeSafeInteger } from './diamond';
import { couponWalletFilter } from '../model/coupon-wallet';
import { getIdentityProfile } from './account-identity';
import {
  clearLegacyMockStorage,
  emptyMockState,
  readMockState,
  writeMockState,
  type MockAccount,
  type MockAddress,
  type MockBenefitRecord,
  type MockBenefitRecordKind,
  type MockCashAccount,
  type MockDiamondLedgerEntry,
  type MockFinancialFact,
  type MockListing,
  type MockListingDraftRecord,
  type MockListingPriceGuidance,
  type MockLedgerDirection,
  type MockListingStatus,
  type MockLocalProfile,
  type MockRootState,
  type MockServiceBalance,
  type MockServicePurchaseKind,
  type MockServicePurchaseRecord,
  type MockStarLedgerEntry,
  type MockTask,
  type MockTaskKind,
  type MockWalletEntryState,
  type MockWithdrawalRecord,
  type SupportMessage,
} from './mock-store';

export type { RentalMode, SupplyType } from './lifecycle-rules';
export { AFTER_SALES_GUARD_FEN, calculateHourlyBilling } from './lifecycle-rules';
export { parseDateTimeMs } from './order-machine';
export { MOCK_NAMESPACE, MOCK_SCHEMA_VERSION, LEGACY_MOCK_NAMESPACE, PREVIOUS_MOCK_NAMESPACE, simulateMockProcessRestartForTest } from './mock-store';
export { DEFAULT_MOCK_DIAMOND_BALANCE, DIAMOND_FEN_PER_YUAN, DIAMOND_POINTS_PER_YUAN, diamondFenForPoints, diamondPointsForFen, requireNonNegativeSafeInteger } from './diamond';
export type { MockAccount, MockAddress, MockBenefitRecord, MockBenefitRecordKind, MockCashAccount, MockDiamondLedgerEntry, MockFinancialFact, MockFinancialFactKind, MockListing, MockListingDraftRecord, MockListingPriceGuidance, MockListingStatus, MockLedgerDirection, MockLocalProfile, MockMediaObject, MockMediaStatus, MockMediaType, MockServiceBalance, MockServicePurchaseKind, MockServicePurchaseRecord, MockStarLedgerEntry, MockTask, MockWalletEntry, MockWalletEntryState, MockWithdrawalRecord, SupportMessage } from './mock-store';

export type DeviceSource = 'platform' | 'personal';

export interface Device {
  id: string;
  spuId?: string;
  skuId?: string;
  name: string;
  model: string;
  category: string;
  description: string;
  pricePerDay: number;
  deposit: number;
  source: DeviceSource;
  sourceLabel: string;
  tags: string[];
  image: string;
  location: string;
  address: string;
  availability: string;
  deliveries: DeliveryMethod[];
  supplyType: SupplyType;
  rentalMode: RentalMode;
  assetIds: string[];
  stock?: number;
  depositPlans?: DepositPlan[];
  allowRenewal?: boolean;
  hourlyRateFen?: number;
  referenceValueFen?: number;
  minimumDays?: number;
  allowEarlyReduction?: boolean;
  fullDepositAllowed?: boolean;
  diamondPointsRequired?: number;
  diamondWaiverFen?: number;
  wechatWaiverAllowed?: boolean;
  lessorUserId?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  deliveryRules?: Record<string, string>;
  deliveryAddresses?: Record<string, string>;
  runnerContact?: string;
  runnerPhone?: string;
  runnerService?: string;
  meetingAddress?: string;
  meetingTime?: string;
  storeHours?: string;
}


export interface CabinetOption {
  /** GCJ-02 coordinates; absent until a verified location is supplied. */
  latitude?: number;
  longitude?: number;
  id: string;
  name: string;
  address: string;
  distance: string;
  hours: string;
  region: string;
  nearest: boolean;
}

export interface CabinetView extends CabinetOption {
  availableCount: number;
  status: '可取用' | '部分占用' | '暂不可用';
  deviceIds: string[];
}

export interface StoreView {
  /** GCJ-02 coordinates; absent until a verified location is supplied. */
  latitude?: number;
  longitude?: number;
  id: string;
  name: string;
  address: string;
  region: string;
  distance?: string;
  hours: string;
  phone: string;
  serviceCopy: string;
  deviceIds: string[];
}

export interface PlatformMeetLocation {
  id: string;
  city: string;
  name: string;
  address: string;
  hours: string;
}



export const categoryNames = ['CCD/卡片机', '演唱会长焦', '微单/单反', '独立镜头', '电脑/平板', '影视配件'];

export const defaultListingPriceGuidance: MockListingPriceGuidance = {
  rentMinFen: 20000,
  rentMaxFen: 80000,
  depositMinFen: 300000,
  depositMaxFen: 1000000,
};

export function listingPriceGuidanceFor(_category = ''): MockListingPriceGuidance {
  void _category;
  return { ...defaultListingPriceGuidance };
}

export function listingPriceGuidanceText(guidance = defaultListingPriceGuidance): string {
  return `平台价格区间：日租 ¥${moneyYuan(guidance.rentMinFen)}～¥${moneyYuan(guidance.rentMaxFen)}，押金 ¥${moneyYuan(guidance.depositMinFen)}～¥${moneyYuan(guidance.depositMaxFen)}`;
}

export const cabinetOptions: CabinetOption[] = [
  { id: 'cabinet-xuhui-riverside', name: '徐汇滨江柜机', address: '上海市徐汇区龙腾大道188号1层', distance: '1.2KM', hours: '24小时营业', region: '上海市徐汇区', nearest: true },
  { id: 'cabinet-xujiahui', name: '徐家汇中心柜机', address: '上海市徐汇区肇嘉浜路1111号B1层', distance: '2.8KM', hours: '07:00–23:00', region: '上海市徐汇区', nearest: false },
  { id: 'cabinet-jingan', name: '静安寺柜机', address: '上海市静安区南京西路1618号B2层', distance: '6.4KM', hours: '24小时营业', region: '上海市静安区', nearest: false },
  { id: 'cabinet-pudong', name: '陆家嘴中心柜机', address: '上海市浦东新区世纪大道100号B1层', distance: '9.1KM', hours: '08:00–22:00', region: '上海市浦东新区', nearest: false },
];


const storeOptions: StoreView[] = [
  {
    id: 'store-jingan-image',
    name: '静安影像门店',
    address: '上海市静安区南京西路1618号B2层',
    region: '上海市静安区',
    distance: '6.4KM',
    hours: '10:00–21:00',
    phone: '021-6123-8800',
    serviceCopy: '门店自提、快递和同城配送，现场可核验设备状态。',
    deviceIds: ['sony-200-600', 'dji-mic-2-store'],
  },
  {
    id: 'store-xuhui-service',
    name: '徐汇滨江服务店',
    address: '上海市徐汇区龙腾大道188号1层',
    region: '上海市徐汇区',
    distance: '1.2KM',
    hours: '09:00–20:00',
    phone: '021-6123-8818',
    serviceCopy: '支持门店面交与同城配送，预约后按订单交接。',
    deviceIds: ['sigma-24-70-store'],
  },
  {
    id: 'store-xuhui-center',
    name: '徐汇中心器材店',
    address: '上海市徐汇区漕溪北路88号1层',
    region: '上海市徐汇区',
    distance: '2.1KM',
    hours: '09:30–20:30',
    phone: '021-6123-8836',
    serviceCopy: '支持门店面交，设备交接和归还均按订单记录处理。',
    deviceIds: ['nikon-zf-store'],
  },
];

export const platformReturnMeetLocations: PlatformMeetLocation[] = [
  { id: 'platform-meet-xuhui', city: '上海', name: '徐汇滨江服务点', address: '上海市徐汇区龙腾大道188号1层', hours: '10:00–18:00' },
  { id: 'platform-meet-jingan', city: '上海', name: '静安仓服务点', address: '上海市静安区南京西路1618号B2层', hours: '10:00–20:00' },
  { id: 'platform-meet-pudong', city: '上海', name: '陆家嘴服务点', address: '上海市浦东新区世纪大道100号B1层', hours: '09:00–18:00' },
];


export const deliveryOptions: Array<{ id: DeliveryMethod; label: string; hint: string }> = [
  { id: 'cabinet', label: '柜机自提', hint: '1.2KM · 24小时营业' },
  { id: 'express', label: '快递', hint: '送货上门' },
  { id: 'runner', label: '跑腿', hint: '同城送达' },
  { id: 'meet', label: '面交', hint: '双方确认时间和地点' },
];

export const depositOptions: Array<{ id: DepositPlan; label: string; hint: string }> = [
  { id: 'cash', label: '标准现金押金', hint: '可按商品规则使用粉钻部分免押' },
  { id: 'wechat', label: '微信支付免押', hint: '由微信支付确认免押资格，责任金额不因此减免' },
  { id: 'full', label: '¥13,000全额押金', hint: '正常登录即可创建待支付订单并直接支付，跳过实名认证和合同办理' },
];

export const renewalOptions = [
  { days: 1, label: '续租1天' },
  { days: 3, label: '续租3天' },
  { days: 7, label: '续租7天' },
];

const asset = '/assets/figma-icons/device-mark.svg';

const cabinetDeviceIdsByCabinet: Record<string, string[]> = {
  'cabinet-xuhui-riverside': [
    'sony-a7c', 'fujifilm-x100-cabinet', 'canon-eos-r8-cabinet', 'cab-xuhui-ricoh-gr3x', 'cab-xuhui-panasonic-s5ii',
    'cab-xuhui-om5', 'cab-xuhui-gopro13', 'cab-xuhui-osmo-pocket3', 'cab-xuhui-insta360-x4', 'cab-xuhui-leica-q3',
  ],
  'cabinet-xujiahui': [
    'cab-xujiahui-sony-a6700', 'cab-xujiahui-canon-r6ii', 'cab-xujiahui-nikon-z6iii', 'cab-xujiahui-fuji-xt5', 'cab-xujiahui-panasonic-gh7',
    'cab-xujiahui-om1ii', 'cab-xujiahui-ricoh-gr3', 'cab-xujiahui-dji-action5', 'cab-xujiahui-gopro-max', 'cab-xujiahui-canon-g7x3',
  ],
  'cabinet-jingan': [
    'cab-jingan-sony-fx3', 'cab-jingan-canon-c70', 'cab-jingan-nikon-z8', 'cab-jingan-fuji-gfx100s2', 'cab-jingan-panasonic-gh6',
    'cab-jingan-sigma-35', 'cab-jingan-tamron-2875', 'cab-jingan-sony-2470gm2', 'cab-jingan-dji-mic-mini', 'cab-jingan-sennheiser-mke600',
  ],
  'cabinet-pudong': [
    'cab-pudong-sony-70200gm2', 'cab-pudong-canon-rf2470', 'cab-pudong-nikon-z2470', 'cab-pudong-fuji-1655', 'cab-pudong-sigma-70200',
    'cab-pudong-dji-rs4pro', 'cab-pudong-zhiyun-crane4', 'cab-pudong-atomos-ninjav', 'cab-pudong-elgato-camlink4k', 'cab-pudong-zoom-h6e',
  ],
};

interface CabinetDeviceSeed {
  cabinetId: string;
  id: string;
  name: string;
  model: string;
  category: string;
  description: string;
  pricePerDay: number;
  deposit: number;
}

const cabinetDeviceSeeds: CabinetDeviceSeed[] = [
  { cabinetId: 'cabinet-xuhui-riverside', id: 'cab-xuhui-ricoh-gr3x', name: 'Ricoh GR IIIx', model: 'GR IIIx 40mm 定焦相机', category: 'CCD/卡片机', description: '轻便街拍 · 柜机天租', pricePerDay: 108, deposit: 1200 },
  { cabinetId: 'cabinet-xuhui-riverside', id: 'cab-xuhui-panasonic-s5ii', name: 'Panasonic Lumix S5II', model: 'Lumix S5II 全画幅微单', category: '微单/单反', description: '全画幅视频 · 柜机天租', pricePerDay: 178, deposit: 2200 },
  { cabinetId: 'cabinet-xuhui-riverside', id: 'cab-xuhui-om5', name: 'OM SYSTEM OM-5', model: 'OM-5 轻量微单', category: '微单/单反', description: '轻量防抖 · 柜机天租', pricePerDay: 118, deposit: 1400 },
  { cabinetId: 'cabinet-xuhui-riverside', id: 'cab-xuhui-gopro13', name: 'GoPro HERO13 Black', model: 'HERO13 Black 运动相机', category: '影视配件', description: '运动记录 · 柜机天租', pricePerDay: 88, deposit: 800 },
  { cabinetId: 'cabinet-xuhui-riverside', id: 'cab-xuhui-osmo-pocket3', name: 'DJI Osmo Pocket 3', model: 'Osmo Pocket 3 云台相机', category: '影视配件', description: '随身云台 · 柜机天租', pricePerDay: 98, deposit: 900 },
  { cabinetId: 'cabinet-xuhui-riverside', id: 'cab-xuhui-insta360-x4', name: 'Insta360 X4', model: 'X4 全景运动相机', category: '影视配件', description: '全景记录 · 柜机天租', pricePerDay: 108, deposit: 1000 },
  { cabinetId: 'cabinet-xuhui-riverside', id: 'cab-xuhui-leica-q3', name: 'Leica Q3', model: 'Q3 全画幅定焦相机', category: 'CCD/卡片机', description: '高画质定焦 · 柜机天租', pricePerDay: 268, deposit: 4000 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-sony-a6700', name: 'Sony α6700', model: 'α6700 APS-C 微单', category: '微单/单反', description: '轻量高速对焦 · 柜机天租', pricePerDay: 148, deposit: 1800 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-canon-r6ii', name: 'Canon EOS R6 Mark II', model: 'EOS R6 Mark II 全画幅微单', category: '微单/单反', description: '高速连拍 · 柜机天租', pricePerDay: 218, deposit: 2800 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-nikon-z6iii', name: 'Nikon Z6III', model: 'Z6III 全画幅微单', category: '微单/单反', description: '视频与照片兼顾 · 柜机天租', pricePerDay: 198, deposit: 2600 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-fuji-xt5', name: 'Fujifilm X-T5', model: 'X-T5 复古微单', category: '微单/单反', description: '高画质复古机身 · 柜机天租', pricePerDay: 168, deposit: 2200 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-panasonic-gh7', name: 'Panasonic GH7', model: 'GH7 电影级微单', category: '微单/单反', description: '视频创作 · 柜机天租', pricePerDay: 188, deposit: 2400 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-om1ii', name: 'OM SYSTEM OM-1 Mark II', model: 'OM-1 Mark II 防抖微单', category: '微单/单反', description: '户外防护 · 柜机天租', pricePerDay: 178, deposit: 2200 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-ricoh-gr3', name: 'Ricoh GR III', model: 'GR III 28mm 定焦相机', category: 'CCD/卡片机', description: '随身街拍 · 柜机天租', pricePerDay: 98, deposit: 1100 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-dji-action5', name: 'DJI Osmo Action 5 Pro', model: 'Osmo Action 5 Pro 运动相机', category: '影视配件', description: '户外运动记录 · 柜机天租', pricePerDay: 88, deposit: 800 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-gopro-max', name: 'GoPro MAX', model: 'MAX 360 全景相机', category: '影视配件', description: '全景运动记录 · 柜机天租', pricePerDay: 92, deposit: 900 },
  { cabinetId: 'cabinet-xujiahui', id: 'cab-xujiahui-canon-g7x3', name: 'Canon PowerShot G7 X Mark III', model: 'G7 X Mark III 便携相机', category: 'CCD/卡片机', description: '便携视频 · 柜机天租', pricePerDay: 118, deposit: 1400 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-sony-fx3', name: 'Sony FX3', model: 'FX3 全画幅电影机', category: '影视配件', description: '电影级视频 · 柜机天租', pricePerDay: 288, deposit: 3800 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-canon-c70', name: 'Canon EOS C70', model: 'EOS C70 电影摄影机', category: '影视配件', description: '专业视频拍摄 · 柜机天租', pricePerDay: 328, deposit: 4500 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-nikon-z8', name: 'Nikon Z8', model: 'Z8 高像素全画幅微单', category: '微单/单反', description: '高像素创作 · 柜机天租', pricePerDay: 248, deposit: 3400 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-fuji-gfx100s2', name: 'Fujifilm GFX100S II', model: 'GFX100S II 中画幅微单', category: '微单/单反', description: '中画幅创作 · 柜机天租', pricePerDay: 368, deposit: 5200 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-panasonic-gh6', name: 'Panasonic GH6', model: 'GH6 电影级微单', category: '微单/单反', description: '高规格视频 · 柜机天租', pricePerDay: 188, deposit: 2400 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-sigma-35', name: 'Sigma 35mm F1.4 DG DN', model: '35mm F1.4 DG DN 定焦镜头', category: '独立镜头', description: '大光圈定焦 · 柜机天租', pricePerDay: 108, deposit: 1200 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-tamron-2875', name: 'Tamron 28-75mm F2.8 G2', model: '28-75mm F2.8 G2 变焦镜头', category: '独立镜头', description: '通用变焦 · 柜机天租', pricePerDay: 128, deposit: 1500 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-sony-2470gm2', name: 'Sony FE 24-70mm GM II', model: 'FE 24-70mm F2.8 GM II 变焦镜头', category: '独立镜头', description: '旗舰变焦 · 柜机天租', pricePerDay: 168, deposit: 2200 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-dji-mic-mini', name: 'DJI Mic Mini', model: 'Mic Mini 无线麦克风', category: '影视配件', description: '轻量无线收音 · 柜机天租', pricePerDay: 68, deposit: 600 },
  { cabinetId: 'cabinet-jingan', id: 'cab-jingan-sennheiser-mke600', name: 'Sennheiser MKE 600', model: 'MKE 600 指向性麦克风', category: '影视配件', description: '专业指向收音 · 柜机天租', pricePerDay: 78, deposit: 700 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-sony-70200gm2', name: 'Sony FE 70-200mm GM II', model: 'FE 70-200mm F2.8 GM II 长焦镜头', category: '演唱会长焦', description: '演唱会长焦 · 柜机天租', pricePerDay: 188, deposit: 2600 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-canon-rf2470', name: 'Canon RF 24-70mm F2.8 L', model: 'RF 24-70mm F2.8 L 变焦镜头', category: '独立镜头', description: '全能变焦 · 柜机天租', pricePerDay: 158, deposit: 2100 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-nikon-z2470', name: 'NIKKOR Z 24-70mm F2.8 S', model: 'NIKKOR Z 24-70mm F2.8 S 变焦镜头', category: '独立镜头', description: '高解析变焦 · 柜机天租', pricePerDay: 148, deposit: 2000 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-fuji-1655', name: 'Fujifilm XF 16-55mm', model: 'XF 16-55mm F2.8 R LM WR 变焦镜头', category: '独立镜头', description: '旅行变焦 · 柜机天租', pricePerDay: 128, deposit: 1700 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-sigma-70200', name: 'Sigma 70-200mm F2.8 DG DN', model: '70-200mm F2.8 DG DN Sports 长焦镜头', category: '演唱会长焦', description: '远摄防抖 · 柜机天租', pricePerDay: 178, deposit: 2400 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-dji-rs4pro', name: 'DJI RS 4 Pro', model: 'RS 4 Pro 相机稳定器', category: '影视配件', description: '专业相机稳定 · 柜机天租', pricePerDay: 108, deposit: 1000 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-zhiyun-crane4', name: 'Zhiyun Crane 4', model: 'Crane 4 相机稳定器', category: '影视配件', description: '便携稳定拍摄 · 柜机天租', pricePerDay: 98, deposit: 900 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-atomos-ninjav', name: 'Atomos Ninja V', model: 'Ninja V 监视记录仪', category: '影视配件', description: '外置监看记录 · 柜机天租', pricePerDay: 128, deposit: 1400 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-elgato-camlink4k', name: 'Elgato Cam Link 4K', model: 'Cam Link 4K 采集卡', category: '影视配件', description: '直播采集 · 柜机天租', pricePerDay: 58, deposit: 500 },
  { cabinetId: 'cabinet-pudong', id: 'cab-pudong-zoom-h6e', name: 'Zoom H6essential', model: 'H6essential 便携录音机', category: '影视配件', description: '多轨现场录音 · 柜机天租', pricePerDay: 88, deposit: 800 },
];

const additionalCabinetDevices: Device[] = cabinetDeviceSeeds.map((seed) => {
  const cabinet = cabinetOptions.find((item) => item.id === seed.cabinetId)!;
  return {
    id: seed.id,
    name: seed.name,
    model: seed.model,
    category: seed.category,
    description: seed.description,
    pricePerDay: seed.pricePerDay,
    deposit: seed.deposit,
    source: 'platform',
    sourceLabel: '共享柜',
    tags: ['共享柜', '天租', '柜取柜还'],
    image: asset,
    location: cabinet.name,
    address: cabinet.address,
    availability: '可租 1 台',
    deliveries: ['cabinet'],
    supplyType: 'cabinet',
    rentalMode: 'daily',
    assetIds: [`asset-${seed.id}-01`],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
  };
});

const devices: Device[] = [
  {
    id: 'sony-a7c',
    name: 'Sony A7C',
    model: 'α7C 全画幅微单',
    category: 'CCD/卡片机',
    description: '全画幅轻便微单 · Vlog神器',
    pricePerDay: 128,
    deposit: 1000,
    source: 'platform',
    sourceLabel: '共享柜',
    tags: ['共享柜', '柜取柜还', '正常痕迹'],
    image: asset,
    location: '徐汇滨江柜机',
    address: '上海市徐汇区龙腾大道188号1层',
    availability: '可租 3 台',
    deliveries: ['cabinet'],
    supplyType: 'cabinet',
    rentalMode: 'hourly',
    assetIds: ['asset-ccd-a7c-01', 'asset-ccd-a7c-02', 'asset-ccd-a7c-03'],
    hourlyRateFen: 2_000,
    referenceValueFen: 1_300_000,
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: false,
  },
  {
    id: 'sony-a7c-personal',
    name: 'Sony A7C',
    model: 'Sony A7C + 28-60mm',
    category: 'CCD/卡片机',
    description: '轻便全画幅 · 个人闲置出租',
    pricePerDay: 98,
    deposit: 800,
    source: 'personal',
    sourceLabel: '个人',
    tags: ['相机', '快递', '成色良好'],
    image: asset,
    location: '上海徐汇',
    address: '上海市徐汇区漕河泾街道',
    availability: '可租 1 台',
    deliveries: ['express', 'runner', 'meet'],
    supplyType: 'personal',
    rentalMode: 'daily',
    assetIds: ['asset-personal-a7c-01'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
    lessorUserId: 'mock-lessor-b',
  },
  {
    id: 'fujifilm-x100-cabinet',
    name: 'Fujifilm X100VI',
    model: 'X100VI 便携定焦相机',
    category: '微单/单反',
    description: '共享柜天租 · 轻便定焦相机',
    pricePerDay: 188,
    deposit: 2000,
    source: 'platform',
    sourceLabel: '共享柜',
    tags: ['共享柜', '天租', '柜取柜还'],
    image: asset,
    location: '徐汇滨江柜机',
    address: '上海市徐汇区龙腾大道188号1层',
    availability: '可租 2 台',
    deliveries: ['cabinet'],
    supplyType: 'cabinet',
    rentalMode: 'daily',
    assetIds: ['asset-cabinet-x100-01', 'asset-cabinet-x100-02'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
  },
  {
    id: 'sony-200-600',
    name: 'Sony 200-600mm',
    model: 'FE 200-600mm F5.6-6.3 G OSS',
    category: '演唱会长焦',
    description: '演唱会远摄 · 防抖清晰',
    pricePerDay: 168,
    deposit: 1500,
    source: 'platform',
    sourceLabel: '门店',
    tags: ['门店', '自提', '热门'],
    image: asset,
    location: '静安影像门店',
    address: '上海市静安区南京西路1618号B2层',
    storeHours: '10:00–21:00',
    availability: '可租 2 台',
    deliveries: ['meet', 'express', 'runner'],
    supplyType: 'store',
    rentalMode: 'daily',
    assetIds: ['asset-store-tele-01', 'asset-store-tele-02'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
  },
  {
    id: 'canon-eos-r8-cabinet',
    name: 'Canon EOS R8',
    model: 'EOS R8 全画幅微单',
    category: '微单/单反',
    description: '轻量全画幅 · 柜机天租',
    pricePerDay: 158,
    deposit: 1800,
    source: 'platform',
    sourceLabel: '共享柜',
    tags: ['共享柜', '天租', '柜取柜还'],
    image: asset,
    location: '徐汇滨江柜机',
    address: '上海市徐汇区龙腾大道188号1层',
    availability: '可租 2 台',
    deliveries: ['cabinet'],
    supplyType: 'cabinet',
    rentalMode: 'daily',
    assetIds: ['asset-cabinet-r8-01', 'asset-cabinet-r8-02'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
  },
  {
    id: 'sigma-24-70-store',
    name: 'Sigma 24-70mm Art',
    model: '24-70mm F2.8 DG DN II',
    category: '独立镜头',
    description: '通用变焦镜头 · 门店面交',
    pricePerDay: 138,
    deposit: 1200,
    source: 'platform',
    sourceLabel: '门店',
    tags: ['门店', '面交', '热门'],
    image: asset,
    location: '徐汇滨江服务店',
    address: '上海市徐汇区龙腾大道188号1层',
    storeHours: '09:00–20:00',
    availability: '可租 1 台',
    deliveries: ['meet', 'express', 'runner'],
    supplyType: 'store',
    rentalMode: 'daily',
    assetIds: ['asset-store-sigma-01'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
  },
  {
    id: 'nikon-zf-store',
    name: 'Nikon Z f',
    model: 'Z f 复古全画幅微单',
    category: '微单/单反',
    description: '复古机身 · 门店天租',
    pricePerDay: 148,
    deposit: 1600,
    source: 'platform',
    sourceLabel: '门店',
    tags: ['门店', '自提', '天租'],
    image: asset,
    location: '徐汇中心器材店',
    address: '上海市徐汇区漕溪北路88号1层',
    storeHours: '09:30–20:30',
    availability: '可租 2 台',
    deliveries: ['meet', 'express', 'runner'],
    supplyType: 'store',
    rentalMode: 'daily',
    assetIds: ['asset-store-zf-01', 'asset-store-zf-02'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
  },
  {
    id: 'dji-mic-2-store',
    name: 'DJI Mic 2',
    model: '双发一收无线麦克风',
    category: '影视配件',
    description: '双人收音 · 门店灵活取还',
    pricePerDay: 78,
    deposit: 500,
    source: 'platform',
    sourceLabel: '门店',
    tags: ['门店', '配件', '同城配送'],
    image: asset,
    location: '静安影像门店',
    address: '上海市静安区南京西路1618号B2层',
    storeHours: '10:00–21:00',
    availability: '可租 2 套',
    deliveries: ['meet', 'express', 'runner'],
    supplyType: 'store',
    rentalMode: 'daily',
    assetIds: ['asset-store-mic-01', 'asset-store-mic-02'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
  },
  {
    id: 'fujifilm-x-s20-personal',
    name: 'Fujifilm X-S20',
    model: 'X-S20 + 18-55mm 套机',
    category: '微单/单反',
    description: '轻量旅行套机 · 个人闲置出租',
    pricePerDay: 118,
    deposit: 900,
    source: 'personal',
    sourceLabel: '个人',
    tags: ['个人出租', '快递', '成色良好'],
    image: asset,
    location: '上海徐汇',
    address: '上海市徐汇区漕河泾街道',
    availability: '可租 1 台',
    deliveries: ['express', 'runner', 'meet'],
    supplyType: 'personal',
    rentalMode: 'daily',
    assetIds: ['asset-personal-xs20-01'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
    lessorUserId: 'mock-lessor-b',
  },
  {
    id: 'ipad-pro-11-personal',
    name: 'iPad Pro 11',
    model: 'M2 11英寸 · 256GB',
    category: '电脑/平板',
    description: '移动创作平板 · 个人闲置出租',
    pricePerDay: 88,
    deposit: 800,
    source: 'personal',
    sourceLabel: '个人',
    tags: ['个人出租', '快递', '配件齐全'],
    image: asset,
    location: '上海静安',
    address: '上海市静安区江宁路街道',
    availability: '可租 1 台',
    deliveries: ['express', 'runner', 'meet'],
    supplyType: 'personal',
    rentalMode: 'daily',
    assetIds: ['asset-personal-ipad-01'],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
    lessorUserId: 'mock-lessor-b',
  },
  ...additionalCabinetDevices,
];

const catalogImages: Record<string, string> = {
  "sony-a7c": "/assets/figma-media/official-sony-a7c.jpg",
  "sony-a7c-personal": "/assets/figma-media/official-sony-a7c.jpg",
  "canon-eos-r8-cabinet": "/assets/figma-media/official-canon-eos-r8.jpg",
  "fujifilm-x100-cabinet": "/assets/figma-media/discovery-reference-fuji.jpg",
  "sigma-24-70-store": "/assets/figma-media/discovery-reference-sigma.jpg",
  "nikon-zf-store": "/assets/figma-media/discovery-reference-nikon.jpg",
  "cab-xuhui-ricoh-gr3x": "/assets/figma-media/discovery-reference-ricoh.jpg",
  "cab-xuhui-panasonic-s5ii": "/assets/figma-media/discovery-reference-panasonic.jpg",
  "cab-xuhui-om5": "/assets/figma-media/discovery-reference-olympus.jpg",
  "cab-xuhui-gopro13": "/assets/figma-media/discovery-reference-gopro.jpg"
};
for (const device of devices) {
  const image = catalogImages[device.id];
  if (image) device.image = image;
}

// Independent personal stock keeps the preview usable when one owner's devices are excluded.
const personalPreviewBase = devices.find((device) => device.id === 'sony-a7c-personal');
if (personalPreviewBase) {
  for (const owner of ['mock-lessor-b', 'mock-user-c']) {
    const id = 'personal-preview-a7c-' + owner;
    devices.push({ ...personalPreviewBase, id, lessorUserId: owner, assetIds: ['asset-' + id] });
  }
}

// Additional store fixtures share the same detail and order device records.
storeOptions.push(
  { id: 'store-xuhui-west', name: '徐汇西岸影像店', address: '上海市徐汇区龙腾大道300号1层', region: '上海市徐汇区', distance: '2.8KM', hours: '09:00–21:00', phone: '', serviceCopy: '支持门店面交与同城配送。', deviceIds: [] },
  { id: 'store-jingan-camera', name: '静安相机体验店', address: '上海市静安区南京西路900号1层', region: '上海市静安区', distance: '5.8KM', hours: '10:00–21:00', phone: '', serviceCopy: '支持门店面交与设备体验。', deviceIds: [] },
  { id: 'store-pudong-photo', name: '浦东摄影器材店', address: '上海市浦东新区世纪大道600号1层', region: '上海市浦东新区', distance: '8.2KM', hours: '09:30–20:30', phone: '', serviceCopy: '支持门店面交与同城配送。', deviceIds: [] },
);

// Browsing fixtures: three distinct rentable products per store for preview layout.
const storePreviewModels = [
  { suffix: 'nikon-zf', name: 'Nikon Z f', model: 'Z f 复古全画幅微单', description: '复古机身 · 日常摄影', pricePerDay: 148, deposit: 1600, image: '/assets/figma-media/discovery-reference-nikon.jpg' },
  { suffix: 'canon-r8', name: 'Canon EOS R8', model: 'EOS R8 全画幅微单', description: '轻量全画幅 · 旅行与日常创作', pricePerDay: 158, deposit: 1800, image: '/assets/figma-media/official-canon-eos-r8.jpg' },
  { suffix: 'fuji-x100', name: 'Fujifilm X100VI', model: 'X100VI 便携定焦相机', description: '经典色彩 · 轻便街拍', pricePerDay: 188, deposit: 2000, image: '/assets/figma-media/discovery-reference-fuji.jpg' },
];
for (const store of storeOptions) {
  const base = devices.find((device) => device.id === 'sigma-24-70-store');
  if (!base) continue;
  for (const model of storePreviewModels) {
    if (store.deviceIds.length >= 3) break;
    if (devices.some((device) => store.deviceIds.includes(device.id) && device.name === model.name)) continue;
    const id = store.id + '-preview-' + model.suffix;
    devices.push({
      ...base, ...model, id, category: '微单/单反',
      location: store.name, address: store.address, storeHours: store.hours,
      tags: ['门店', '面交'], availability: '可租 1 台',
      assetIds: ['asset-' + id],
    });
    store.deviceIds.push(id);
  }
}

function dateText(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateTimeText(date: Date): string {
  return date.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}


let selectedRegion = '上海市徐汇区';

export function getMockDiamondBalance(): number {
  const state = ensureState();
  return requireNonNegativeSafeInteger(state.diamondBalances?.[state.currentAccountId] ?? DEFAULT_MOCK_DIAMOND_BALANCE, '粉钻余额');
}

function appendDiamondLedgerEntry(state: MockRootState, input: Omit<MockDiamondLedgerEntry, 'id' | 'userId' | 'createdAt'>): boolean {
  state.diamondLedger ??= [];
  if (state.diamondLedger.some((entry) => entry.userId === state.currentAccountId && entry.businessKey === input.businessKey)) return false;
  state.diamondLedger.push({
    ...input,
    id: `diamond-ledger-${state.sequence++}`,
    userId: state.currentAccountId,
    createdAt: new Date().toISOString(),
  });
  return true;
}

export function getMockDiamondLedger(): MockDiamondLedgerEntry[] {
  const state = ensureState();
  return [...(state.diamondLedger ?? [])].filter((entry) => entry.userId === state.currentAccountId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getMockStarBalance(): number {
  const state = ensureState();
  return Math.max(0, Math.floor(state.starBalances?.[state.currentAccountId] ?? 0));
}

export function getMockStarLedger(): MockStarLedgerEntry[] {
  const state = ensureState();
  return [...(state.starLedger ?? [])].filter((entry) => entry.userId === state.currentAccountId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getMockBenefitRecords(): MockBenefitRecord[] {
  const state = ensureState();
  return [...(state.benefitRecords ?? [])].filter((record) => record.userId === state.currentAccountId).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export interface MockBenefitMutationResult {
  ok: boolean;
  record: MockBenefitRecord | null;
  reason: string;
}

export interface MockBenefitReward {
  starPoints?: number;
  diamondPoints?: number;
  note: string;
}

export function runMockBenefit(kind: MockBenefitRecordKind, businessKey: string, reward: MockBenefitReward, outcome: 'success' | 'failure' = 'success'): MockBenefitMutationResult {
  const state = ensureState();
  if (reward.diamondPoints !== undefined && (!Number.isSafeInteger(reward.diamondPoints) || reward.diamondPoints < 0)) return { ok: false, record: null, reason: '粉钻奖励数量必须是非负安全整数' };
  const result = applyMemberReward(state, kind, businessKey.trim(), reward, outcome);
  writeMockState(state);
  return result;
}

export const completeMockCheckIn = completeMemberCheckIn;

export function recordMockMemberVisit(kind: string, id: string): boolean {
  const valid = kind === 'devices' ? Boolean(findDevice(id))
    : kind === 'inventory' ? Boolean(id.startsWith('store:') && getStore(id.slice(6)) || id.startsWith('cabinet:') && getCabinet(id.slice(8)))
      : kind === 'guide' && ['rental-flow', 'deposit-waiver', 'device-protection'].includes(id);
  return valid ? recordMemberVisit(kind, id) : false;
}

export interface MockDiamondMutationResult {
  ok: boolean;
  points: number;
  balance: number;
  reason: string;
}

export function spendMockDiamonds(points: number, businessKey = '', note = '粉钻使用'): MockDiamondMutationResult {
  const state = ensureState();
  const current = getMockDiamondBalance();
  if (!Number.isSafeInteger(points) || points <= 0) return { ok: false, points: 0, balance: current, reason: '扣除数量必须是正安全整数' };
  const amount = points;
  const normalizedKey = businessKey.trim() || `manual:diamond-debit:${state.sequence}`;
  const existing = (state.diamondLedger ?? []).find((entry) => entry.userId === state.currentAccountId && entry.businessKey === normalizedKey);
  if (existing) return { ok: true, points: existing.points, balance: current, reason: '' };
  if (current < amount) return { ok: false, points: amount, balance: current, reason: '粉钻余额不足' };
  consumeMockDiamonds(state, amount, normalizedKey, 'debit', note);
  writeMockState(state);
  return { ok: true, points: amount, balance: getMockDiamondBalance(), reason: '' };
}

export function grantMockDiamonds(points: number, businessKey = '', note = '粉钻奖励'): MockDiamondMutationResult {
  const state = ensureState();
  const current = getMockDiamondBalance();
  if (!Number.isSafeInteger(points) || points <= 0) return { ok: false, points: 0, balance: current, reason: '奖励数量必须是正安全整数' };
  const amount = points;
  const normalizedKey = businessKey.trim() || `manual:diamond-credit:${state.sequence}`;
  const existing = (state.diamondLedger ?? []).find((entry) => entry.userId === state.currentAccountId && entry.businessKey === normalizedKey);
  if (existing) return { ok: true, points: existing.points, balance: current, reason: '' };
  restoreMockDiamonds(state, amount, normalizedKey, 'credit', note);
  writeMockState(state);
  return { ok: true, points: amount, balance: getMockDiamondBalance(), reason: '' };
}

export function getAvailableVouchers(type?: 'rental' | 'insurance' | 'guard'): MockRootState['vouchers'] {
  const state = ensureState();
  const now = Date.now();
  return state.vouchers
    .filter((voucher) => voucher.ownerUserId === state.currentAccountId && (!type || voucher.type === type) && couponWalletFilter({ ...voucher, orderId: voucher.orderId ?? '' }, now) === 'available')
    .map((voucher) => ({ ...voucher }));
}


function consumeMockDiamonds(state: MockRootState, points: number, businessKey: string, direction: MockLedgerDirection, note: string): void {
  const current = requireNonNegativeSafeInteger(state.diamondBalances?.[state.currentAccountId] ?? DEFAULT_MOCK_DIAMOND_BALANCE, '粉钻余额');
  const amount = requireNonNegativeSafeInteger(points, '粉钻数量');
  state.diamondBalances[state.currentAccountId] = Math.max(0, current - amount);
  appendDiamondLedgerEntry(state, { businessKey, direction, points: amount, note });
}

function restoreMockDiamonds(state: MockRootState, points: number, businessKey: string, direction: MockLedgerDirection, note: string): void {
  const current = requireNonNegativeSafeInteger(state.diamondBalances?.[state.currentAccountId] ?? DEFAULT_MOCK_DIAMOND_BALANCE, '粉钻余额');
  const amount = requireNonNegativeSafeInteger(points, '粉钻数量');
  const restored = requireNonNegativeSafeInteger(current + amount, '粉钻余额');
  if (appendDiamondLedgerEntry(state, { businessKey, direction, points: amount, note })) state.diamondBalances[state.currentAccountId] = restored;
}


function seedListings(): MockListing[] {
  const now = dateTimeText(new Date());
  const availableStart = dateText(new Date());
  const availableEnd = dateText(addDays(new Date(), 120));
  return [
    { id: 'listing-own-reviewing', lessorUserId: 'mock-tenant-a', name: 'Canon R8', category: '微单/单反', brand: 'Canon', model: 'R8', condition: '九成新', notes: '机身底部轻微使用痕迹', accessories: '电池、充电器、肩带', description: '刚提交的个人设备', location: '上海徐汇', deliveryMethods: ['express', 'runner', 'meet'], photoRefs: [asset], proofRefs: [asset], priceFen: null, depositFen: null, status: 'reviewing', createdAt: now, updatedAt: now, serialNumber: 'R8-REVIEW-001', availabilityStart: availableStart, availabilityEnd: availableEnd, deliveryRules: { express: 'each', runner: 'each', meet: 'free' }, deliveryAddresses: { express: '上海徐汇', runner: '上海徐汇', meet: '上海徐汇' }, runnerContact: '小宇', runnerPhone: '13900006666', runnerService: '送到承租方地址', meetingAddress: '上海徐汇', meetingTime: '工作日 18:00–21:00' },
    { id: 'listing-own-pricing', lessorUserId: 'mock-tenant-a', name: 'Sony A7C', category: 'CCD/卡片机', brand: 'Sony', model: 'A7C', condition: '成色良好', notes: '', accessories: '电池、充电器', description: '审核已通过，等待设置价格', location: '上海徐汇', deliveryMethods: ['express', 'runner', 'meet'], photoRefs: [asset], proofRefs: [asset], priceFen: null, depositFen: null, status: 'pricing', createdAt: now, updatedAt: now, serialNumber: 'A7C-PRICE-001', availabilityStart: availableStart, availabilityEnd: availableEnd, deliveryRules: { express: 'each', runner: 'each', meet: 'free' }, deliveryAddresses: { express: '上海徐汇', runner: '上海徐汇', meet: '上海徐汇' }, runnerContact: '小宇', runnerPhone: '13900006666', runnerService: '送到承租方地址', meetingAddress: '上海徐汇', meetingTime: '周末 10:00–18:00' },
    { id: 'listing-own-listed', lessorUserId: 'mock-tenant-a', name: 'Fujifilm X100VI', category: 'CCD/卡片机', brand: 'Fujifilm', model: 'X100VI', condition: '近全新', notes: '', accessories: '原装电池、皮套', description: '已通过审核并上架', location: '上海徐汇', deliveryMethods: ['runner', 'meet'], photoRefs: [asset], proofRefs: [asset], priceFen: 36800, depositFen: 500000, expectedRentFen: 36800, expectedDepositFen: 500000, priceGuidance: listingPriceGuidanceFor('CCD/卡片机'), status: 'listed', createdAt: now, updatedAt: now, serialNumber: 'X100VI-LISTED-001', availabilityStart: availableStart, availabilityEnd: availableEnd, deliveryRules: { runner: 'each', meet: 'free' }, deliveryAddresses: { runner: '上海徐汇', meet: '上海徐汇' }, runnerContact: '小宇', runnerPhone: '13900006666', runnerService: '送到承租方地址', meetingAddress: '上海徐汇', meetingTime: '周末 10:00–18:00' },
    { id: 'listing-own-unlisted', lessorUserId: 'mock-tenant-a', name: 'DJI Mic 2', category: '影视配件', brand: 'DJI', model: 'Mic 2', condition: '成色良好', notes: '', accessories: '发射器、接收器、充电盒', description: '已下架的个人设备，可重新上架', location: '上海静安', deliveryMethods: ['express', 'runner'], photoRefs: [asset], proofRefs: [asset], priceFen: 88_00, depositFen: 300_000, expectedRentFen: 88_00, expectedDepositFen: 300_000, priceGuidance: listingPriceGuidanceFor('影视配件'), status: 'unlisted', createdAt: now, updatedAt: now, serialNumber: 'MIC2-UNLISTED-001', availabilityStart: availableStart, availabilityEnd: availableEnd, deliveryRules: { express: 'each', runner: 'each' }, deliveryAddresses: { express: '上海静安', runner: '上海静安' }, runnerContact: '小宇', runnerPhone: '13900006666', runnerService: '送到承租方地址' },
    { id: 'listing-own-rejected', lessorUserId: 'mock-tenant-a', name: 'Nikon Z6II', category: '微单/单反', brand: 'Nikon', model: 'Z6II', condition: '九成新', notes: '凭证照片反光', accessories: '电池', description: '设备资料待补充', location: '上海静安', deliveryMethods: ['express', 'meet'], photoRefs: [asset], proofRefs: [asset], priceFen: null, depositFen: null, status: 'rejected', createdAt: now, updatedAt: now, serialNumber: 'Z6-REJECT-001', availabilityStart: availableStart, availabilityEnd: availableEnd, deliveryRules: { express: 'each', meet: 'free' }, deliveryAddresses: { express: '上海静安', meet: '上海静安' }, meetingAddress: '上海静安', meetingTime: '周末 10:00–18:00', rejectReason: '购买凭证信息不清晰，请重新上传' },
    { id: 'listing-other-listed', lessorUserId: 'mock-lessor-b', name: 'Sony 200-600mm', category: '演唱会长焦', brand: 'Sony', model: '200-600mm', condition: '正常使用痕迹', notes: '', accessories: '镜头包', description: '演唱会远摄', location: '上海徐汇', deliveryMethods: ['express', 'meet'], photoRefs: [asset], proofRefs: [asset], priceFen: 48000, depositFen: 800000, expectedRentFen: 48000, expectedDepositFen: 800000, priceGuidance: listingPriceGuidanceFor('演唱会长焦'), status: 'listed', createdAt: now, updatedAt: now, serialNumber: '200-600-LISTED-001', availabilityStart: availableStart, availabilityEnd: availableEnd, deliveryRules: { express: 'each', meet: 'free' }, deliveryAddresses: { express: '上海徐汇', meet: '上海徐汇' }, meetingAddress: '上海徐汇', meetingTime: '周末 10:00–18:00' },
  ];
}

function seedAddresses(): MockAddress[] {
  const now = '2026-08-25 09:00';
  return [
    { id: 'address-tenant-home', userId: 'mock-tenant-a', name: '小星', phone: '13800008888', region: '上海市徐汇区', detail: '龙腾大道188号滨江公寓2号楼1203室', isDefault: true, createdAt: now, updatedAt: now },
    { id: 'address-tenant-work', userId: 'mock-tenant-a', name: '小星', phone: '13800008888', region: '上海市静安区', detail: '南京西路1266号恒隆广场办公楼18层', isDefault: false, createdAt: now, updatedAt: now },
    { id: 'address-lessor-home', userId: 'mock-lessor-b', name: '小宇', phone: '13900006666', region: '上海市徐汇区', detail: '漕溪北路88号6号楼502室', isDefault: true, createdAt: now, updatedAt: now },
  ];
}

function seedCabinetSlots(): MockRootState['cabinetSlots'] {
  return cabinetOptions.flatMap((cabinet) => Array.from({ length: 10 }, (_, index) => {
    const deviceId = cabinetDeviceIdsByCabinet[cabinet.id]?.[index];
    const device = deviceId ? devices.find((item) => item.id === deviceId) : undefined;
    return {
      id: `${cabinet.id}-slot-${index + 1}`,
      cabinetId: cabinet.id,
      index: index + 1,
      size: index < 4 ? 'small' as const : index < 8 ? 'medium' as const : 'large' as const,
      compatibleCategories: device ? [device.category] : [...categoryNames],
      state: 'available' as const,
      assetId: device?.assetIds[0] ?? null,
      orderId: null,
      ...(deviceId ? { deviceId } : {}),
    };
  }));
}

function ensureCabinetInventory(state: MockRootState): boolean {
  let changed = false;
  for (const cabinet of cabinetOptions) {
    const deviceIds = cabinetDeviceIdsByCabinet[cabinet.id] ?? [];
    for (let index = 0; index < 10; index += 1) {
      const expectedDeviceId = deviceIds[index];
      let slot = state.cabinetSlots.find((item) => item.cabinetId === cabinet.id && item.index === index + 1);
      if (!slot) {
        const device = expectedDeviceId ? devices.find((item) => item.id === expectedDeviceId) : undefined;
        slot = {
          id: `${cabinet.id}-slot-${index + 1}`,
          cabinetId: cabinet.id,
          index: index + 1,
          size: index < 4 ? 'small' : index < 8 ? 'medium' : 'large',
          compatibleCategories: device ? [device.category] : [...categoryNames],
          state: 'available',
          assetId: device?.assetIds[0] ?? null,
          orderId: null,
          ...(expectedDeviceId ? { deviceId: expectedDeviceId } : {}),
        };
        state.cabinetSlots.push(slot);
        changed = true;
      }
      const reservedOrder = slot.orderId ? state.orders.find((order) => order.id === slot.orderId) : undefined;
      const deviceId = reservedOrder?.deviceId ?? expectedDeviceId;
      if (deviceId && slot.deviceId !== deviceId) { slot.deviceId = deviceId; changed = true; }
      const device = deviceId ? devices.find((item) => item.id === deviceId) : undefined;
      const expectedAssetId = device?.assetIds[0] ?? null;
      if (device && !reservedOrder && slot.assetId !== expectedAssetId) { slot.assetId = expectedAssetId; changed = true; }
      if (device && (!reservedOrder || slot.compatibleCategories.length === 0) && slot.compatibleCategories[0] !== device.category) { slot.compatibleCategories = [device.category]; changed = true; }
    }
  }
  return changed;
}

function seedVouchers(): MockRootState['vouchers'] {
  const expiresAt = '2027-12-31T23:59:59+08:00';
  return ['mock-tenant-a', 'mock-lessor-b', 'mock-user-c'].flatMap((ownerUserId) => [
    { id: `rental-voucher-${ownerUserId}`, ownerUserId, type: 'rental' as const, amountFen: 2_000, expiresAt, state: 'available' as const, orderId: null },
    { id: `insurance-voucher-${ownerUserId}`, ownerUserId, type: 'insurance' as const, amountFen: 4_500, expiresAt, state: 'available' as const, orderId: null },
  ]);
}

/**
 * Repair contradictory axis combinations left by earlier local builds while
 * keeping the order snapshot and all user-entered evidence intact.  In
 * particular, a resolved dispute must not leave the main order axis stuck at
 * `dispute`, and an issue raised during an active rental must not manufacture
 * a return fact.
 */

function ensureState(): MockRootState {
  const current = readMockState();
  if (current.initialized) {
    let changed = false;
    if (!Array.isArray(current.addresses)) { current.addresses = []; changed = true; }
    if (!current.drafts || typeof current.drafts !== 'object') { current.drafts = {}; changed = true; }
    if (!current.diamondBalances || typeof current.diamondBalances !== 'object') { current.diamondBalances = {}; changed = true; }
    if (!current.starBalances || typeof current.starBalances !== 'object') { current.starBalances = {}; changed = true; }
    if (!current.selectedRegion) { current.selectedRegion = selectedRegion; changed = true; }
    if (!Array.isArray(current.mediaObjects)) { current.mediaObjects = []; changed = true; }
    if (!Array.isArray(current.diamondLedger)) { current.diamondLedger = []; changed = true; }
    if (!Array.isArray(current.starLedger)) { current.starLedger = []; changed = true; }
    if (!Array.isArray(current.benefitRecords)) { current.benefitRecords = []; changed = true; }
    if (!current.cashAccounts || typeof current.cashAccounts !== 'object') { current.cashAccounts = {}; changed = true; }
    if (!current.publishQuotas || typeof current.publishQuotas !== 'object') { current.publishQuotas = {}; changed = true; }
    if (!current.publishQuotaTotals || typeof current.publishQuotaTotals !== 'object') { current.publishQuotaTotals = {}; changed = true; }
    if (!current.serviceBalances || typeof current.serviceBalances !== 'object') { current.serviceBalances = {}; changed = true; }
    if (!Array.isArray(current.servicePurchaseRecords)) { current.servicePurchaseRecords = []; changed = true; }
    if (!Array.isArray(current.reservations)) { current.reservations = []; changed = true; }
    if (!Array.isArray(current.cabinetSlots) || current.cabinetSlots.length === 0) { current.cabinetSlots = seedCabinetSlots(); changed = true; }
    if (!Array.isArray(current.vouchers) || current.vouchers.length === 0) { current.vouchers = seedVouchers(); changed = true; }
    if (!Array.isArray(current.supportMessages)) { current.supportMessages = []; changed = true; }
    if (!Array.isArray(current.walletEntries)) { current.walletEntries = []; changed = true; }
    if (!Array.isArray(current.withdrawals)) { current.withdrawals = []; changed = true; }
    if (!Array.isArray(current.financialFacts)) { current.financialFacts = []; changed = true; }
    if (!current.listingDrafts) { current.listingDrafts = {}; changed = true; }
    if (ensureCabinetInventory(current)) changed = true;
    for (const account of current.accounts) {
      if (current.diamondBalances[account.id] === undefined) { current.diamondBalances[account.id] = DEFAULT_MOCK_DIAMOND_BALANCE; changed = true; }
      if (current.starBalances[account.id] === undefined) { current.starBalances[account.id] = account.id === 'mock-tenant-a' ? 2_340 : 0; changed = true; }
      if (current.publishQuotas[account.id] === undefined) { current.publishQuotas[account.id] = 11; changed = true; }
      if (current.publishQuotaTotals[account.id] === undefined) { current.publishQuotaTotals[account.id] = current.publishQuotas[account.id]! + 1; changed = true; }
      if (!current.serviceBalances[account.id]) { current.serviceBalances[account.id] = { contract: 0, face: 2, risk: 2 }; changed = true; }
    }
    for (const address of seedAddresses()) {
      if (!current.addresses.some((item) => item.id === address.id)) { current.addresses.push(address); changed = true; }
    }
    for (const listing of seedListings()) {
      if (!current.listings.some((item) => item.id === listing.id)) { current.listings.push(listing); changed = true; }
    }
    return changed ? writeMockState(current) : current;
  }
  const seeded = emptyMockState();
    seeded.currentAccountId = current.currentAccountId || seeded.currentAccountId;
  seeded.selectedRegion = current.selectedRegion ?? '上海市徐汇区';
  seeded.starBalances = { ...seeded.starBalances, ...(current.starBalances ?? {}) };
  seeded.mediaObjects = [...(current.mediaObjects ?? [])];
  seeded.diamondLedger = [...(current.diamondLedger ?? [])];
  seeded.starLedger = [...(current.starLedger ?? [])];
  seeded.benefitRecords = [...(current.benefitRecords ?? [])];
  seeded.cashAccounts = { ...(current.cashAccounts ?? {}) };
  seeded.identityProfiles = { ...current.identityProfiles };
  seeded.addresses = seedAddresses();
  seeded.cabinetSlots = seedCabinetSlots();
  seeded.vouchers = seedVouchers();
  seeded.listings = seedListings();
  seeded.walletEntries = [];
  seeded.withdrawals = [];
  seeded.initialized = true;
  clearLegacyMockStorage();
  return writeMockState(seeded);
}

ensureState();



export function listDevices(category = '', search = ''): Device[] {
  const keyword = search.trim().toLowerCase();
  const state = ensureState();
  const currentDraft = state.drafts[state.currentAccountId];
  const draftStartAt = currentDraft?.startDate ? `${currentDraft.startDate} 10:00:00` : dateTimeText(new Date());
  const draftEndAt = currentDraft?.endDate ? `${currentDraft.endDate} 10:00:00` : dateTimeText(addDays(new Date(), currentDraft?.days ?? 1));
  const overlappingReservations = activeReservationsOverlapping(state, draftStartAt, draftEndAt);
  const listedDevices = state.listings
    .filter((listing) => {
      if (isDiagnosticListing(listing) || listing.status !== 'listed' || listing.priceFen === null || listing.depositFen === null || listing.lessorUserId === state.currentAccountId) return false;
      return !overlappingReservations.some((reservation) => reservation.assetId === `asset-${listing.id}`);
    })
    .map(deviceFromListing);
  const fixedDevices = devices.filter((device) => {
    if (device.source === 'personal' && device.lessorUserId === state.currentAccountId) return false;
    return device.assetIds.some((assetId) => !overlappingReservations.some((reservation) => reservation.assetId === assetId));
  });
  return [...fixedDevices, ...listedDevices].map(catalogDevice).filter((device) => {
    const categoryMatches = category.length === 0 || category === '全部' || device.category === category;
    const keywordMatches = keyword.length === 0 || `${device.name}${device.model}${device.description}`.toLowerCase().includes(keyword);
    return categoryMatches && keywordMatches;
  });
}

export function supplyLabel(supplyType: SupplyType): string {
  if (supplyType === 'cabinet') return '共享柜';
  if (supplyType === 'store') return '门店';
  return '个人出租';
}

export function listDevicesBySupply(supplyType: SupplyType, category = '', search = ''): Device[] {
  return listDevices(category, search).filter((device) => device.supplyType === supplyType);
}

export function listCabinets(region = ''): CabinetView[] {
  const availableDeviceIds = new Set(listDevicesBySupply('cabinet').map((device) => device.id));
  const state = ensureState();
  return cabinetOptions
    .filter((cabinet) => !region || cabinet.region === region)
    .map((cabinet) => {
      const slots = state.cabinetSlots.filter((slot) => slot.cabinetId === cabinet.id);
      const availableCount = slots.filter((slot) => slot.state === 'available').length;
      const occupiedCount = slots.filter((slot) => ['reserved', 'occupied'].includes(slot.state)).length;
      return {
        ...cabinet,
        availableCount,
        status: availableCount === 0 ? '暂不可用' as const : occupiedCount > 0 ? '部分占用' as const : '可取用' as const,
        deviceIds: [...(cabinetDeviceIdsByCabinet[cabinet.id] ?? [])].filter((deviceId) => availableDeviceIds.has(deviceId)),
      };
    });
}

export function getCabinet(id: string): CabinetView | undefined {
  return listCabinets().find((cabinet) => cabinet.id === id);
}

export function getPickupCabinetForDevice(deviceId: string): CabinetOption | undefined {
  const cabinetId = Object.entries(cabinetDeviceIdsByCabinet).find(([, deviceIds]) => deviceIds.includes(deviceId))?.[0];
  const cabinet = cabinetId ? cabinetOptions.find((item) => item.id === cabinetId) : undefined;
  return cabinet ? { ...cabinet } : undefined;
}

export function listStores(region = ''): StoreView[] {
  const availableStoreIds = new Set(listDevicesBySupply('store').map((device) => device.id));
  return storeOptions
    .filter((store) => !region || store.region === region)
    .map((store) => ({ ...store, deviceIds: store.deviceIds.filter((id) => availableStoreIds.has(id)) }));
}

export function getStore(id: string): StoreView | undefined {
  return listStores().find((store) => store.id === id);
}

function deviceFromListing(listing: MockListing): Device {
  return catalogDevice({
    id: `listing-device-${listing.id}`,
    name: listing.name,
    model: listing.model,
    category: listing.category,
    description: listing.description || '个人闲置设备',
    pricePerDay: (listing.priceFen ?? 0) / 100,
    deposit: (listing.depositFen ?? 0) / 100,
    source: 'personal',
    sourceLabel: '个人',
    tags: ['个人出租', '已上架'],
    image: listing.photoRefs[0] || asset,
    location: listing.location || '上海',
    address: listing.location || '上海',
    availability: listing.availabilityStart && listing.availabilityEnd ? `可租 ${listing.availabilityStart} 至 ${listing.availabilityEnd}` : '可租 1 台',
    deliveries: listing.deliveryMethods.filter((method): method is DeliveryMethod => ['express', 'runner', 'meet'].includes(method)),
    supplyType: 'personal',
    rentalMode: 'daily',
    assetIds: [`asset-${listing.id}`],
    minimumDays: 1,
    allowEarlyReduction: true,
    fullDepositAllowed: true,
    diamondPointsRequired: 20_000,
    diamondWaiverFen: 20_000,
    wechatWaiverAllowed: true,
    lessorUserId: listing.lessorUserId,
    ...(listing.availabilityStart ? { availabilityStart: listing.availabilityStart } : {}),
    ...(listing.availabilityEnd ? { availabilityEnd: listing.availabilityEnd } : {}),
    ...(listing.deliveryRules ? { deliveryRules: { ...listing.deliveryRules } } : {}),
    ...(listing.deliveryAddresses ? { deliveryAddresses: { ...listing.deliveryAddresses } } : {}),
    ...(listing.runnerContact ? { runnerContact: listing.runnerContact } : {}),
    ...(listing.runnerPhone ? { runnerPhone: listing.runnerPhone } : {}),
    ...(listing.runnerService ? { runnerService: listing.runnerService } : {}),
    ...(listing.meetingAddress ? { meetingAddress: listing.meetingAddress } : {}),
    ...(listing.meetingTime ? { meetingTime: listing.meetingTime } : {}),
  });
}

function catalogDevice(device: Device): Device {
  const spuKey = device.category.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').toLowerCase() || 'rental';
  const allowRenewal = device.supplyType === 'cabinet' || device.rentalMode === 'hourly'
    ? false
    : device.allowRenewal ?? true;
  return {
    ...device,
    spuId: device.spuId ?? `spu-${spuKey}`,
    skuId: device.skuId ?? `sku-${device.id}`,
    stock: device.stock ?? device.assetIds.length,
    depositPlans: device.depositPlans ?? (device.supplyType === 'cabinet' && device.rentalMode === 'hourly' ? ['cash'] : ['cash', 'wechat', 'full']),
    allowRenewal,
    assetIds: [...device.assetIds],
    deliveries: [...device.deliveries],
  };
}

export function getDevice(id: string): Device {
  const fixed = devices.find((device) => device.id === id);
  if (fixed) return catalogDevice(fixed);
  const listingId = id.startsWith('listing-device-') ? id.slice('listing-device-'.length) : '';
  const listing = ensureState().listings.find((item) => item.id === listingId && item.status === 'listed' && item.priceFen !== null && item.depositFen !== null);
  if (!listing) return devices[0]!;
  return deviceFromListing(listing);
}

export function findDevice(id: string): Device | undefined {
  const fixed = devices.find((device) => device.id === id);
  if (fixed) return catalogDevice(fixed);
  const listingId = id.startsWith('listing-device-') ? id.slice('listing-device-'.length) : '';
  const listing = ensureState().listings.find((item) => item.id === listingId && item.status === 'listed' && item.priceFen !== null && item.depositFen !== null);
  return listing ? deviceFromListing(listing) : undefined;
}


export function getRegion(): string {
  const state = ensureState();
  selectedRegion = state.selectedRegion ?? selectedRegion;
  return selectedRegion;
}

export function setRegion(region: string): string {
  const normalized = region.trim() || '上海市徐汇区';
  selectedRegion = normalized;
  const state = ensureState();
  state.selectedRegion = normalized;
  writeMockState(state);
  return normalized;
}

export interface MockAddressDraft {
  id?: string;
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault?: boolean;
}

export function getMockAddresses(): MockAddress[] {
  const state = ensureState();
  return state.addresses
    .filter((address) => address.userId === state.currentAccountId)
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault))
    .map((address) => ({ ...address }));
}

export function getDefaultMockAddress(): MockAddress | null {
  const addresses = getMockAddresses();
  return addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;
}

export function saveMockAddress(input: MockAddressDraft): MockAddress | null {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const region = input.region.trim();
  const detail = input.detail.trim();
  if (!name || !/^1\d{10}$/.test(phone) || !region || !detail) return null;
  const state = ensureState();
  const existing = input.id ? state.addresses.find((address) => address.id === input.id && address.userId === state.currentAccountId) : undefined;
  const now = new Date().toISOString();
  const shouldDefault = input.isDefault === true || !state.addresses.some((address) => address.userId === state.currentAccountId && address.isDefault);
  if (shouldDefault) {
    state.addresses = state.addresses.map((address) => address.userId === state.currentAccountId ? { ...address, isDefault: false, updatedAt: now } : address);
  }
  const address: MockAddress = existing
    ? { ...existing, name, phone, region, detail, isDefault: shouldDefault || existing.isDefault, updatedAt: now }
    : { id: `address-${state.sequence++}`, userId: state.currentAccountId, name, phone, region, detail, isDefault: shouldDefault, createdAt: now, updatedAt: now };
  state.addresses = existing
    ? state.addresses.map((item) => item.id === address.id ? address : item)
    : [address, ...state.addresses];
  writeMockState(state);
  return { ...address };
}

export function setDefaultMockAddress(id: string): boolean {
  const state = ensureState();
  const selected = state.addresses.find((address) => address.id === id && address.userId === state.currentAccountId);
  if (!selected) return false;
  const now = new Date().toISOString();
  state.addresses = state.addresses.map((address) => address.userId === state.currentAccountId ? { ...address, isDefault: address.id === id, updatedAt: now } : address);
  writeMockState(state);
  return true;
}

export function deleteMockAddress(id: string): boolean {
  const state = ensureState();
  const selected = state.addresses.find((address) => address.id === id && address.userId === state.currentAccountId);
  if (!selected) return false;
  state.addresses = state.addresses.filter((address) => address.id !== id);
  if (selected.isDefault) {
    const replacement = state.addresses.find((address) => address.userId === state.currentAccountId);
    if (replacement) replacement.isDefault = true;
  }
  writeMockState(state);
  return true;
}


function reservationRangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean {
  const leftStartMs = parseDateTimeMs(leftStart);
  const leftEndMs = parseDateTimeMs(leftEnd);
  const rightStartMs = parseDateTimeMs(rightStart);
  const rightEndMs = parseDateTimeMs(rightEnd);
  if (![leftStartMs, leftEndMs, rightStartMs, rightEndMs].every(Number.isFinite)) return true;
  return leftStartMs < rightEndMs && rightStartMs < leftEndMs;
}

function activeReservationsOverlapping(state: MockRootState, startAt: string, endAt: string) {
  return state.reservations.filter((reservation) => ['held', 'occupied', 'confirming'].includes(reservation.state)
    && reservationRangesOverlap(startAt, endAt, reservation.startAt, reservation.endAt));
}


export function getSupportMessages(): SupportMessage[] {
  const state = ensureState();
  const visibleOrderIds = new Set(state.orders.filter((order) => !order.diagnosticFixture && (order.tenantUserId === state.currentAccountId || order.lessorUserId === state.currentAccountId)).map((order) => order.id));
  return state.supportMessages
    .filter((message) => message.ownerUserId === state.currentAccountId && (!message.orderId || visibleOrderIds.has(message.orderId)))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((message) => ({ ...message }));
}






function defaultMockTaskDelayMs(kind: MockTaskKind): number {
  if (kind === 'listing_review') return 1200;
  if (kind === 'payment_expire') return 30 * 60 * 1000;
  if (kind === 'approval_expire') return 24 * 60 * 60 * 1000;
  if (kind === 'cancellation_approval') return 800;
  if (kind === 'payment_complete') return 800;
  if (kind === 'insurance_claim_complete') return 1200;
  if (kind === 'platform_receive') return 4000;
  if (kind === 'platform_inspect') return 6000;
  if (['deposit_start', 'refund_start', 'settlement_start', 'waived_close'].includes(kind)) return 3000;
  if (['deposit_complete', 'refund_complete', 'settlement_complete'].includes(kind)) return 4000;
  return 500;
}

function scheduleTask(state: MockRootState, orderId: string, kind: MockTaskKind, delayMs = defaultMockTaskDelayMs(kind)): void {
  if (state.tasks.some((task) => task.orderId === orderId && task.kind === kind && task.status === 'pending')) return;
  const sequence = state.sequence++;
  state.tasks.push({ id: `task-${sequence}`, orderId, kind, dueAt: Date.now() + delayMs, status: 'pending', eventId: `event-${orderId}-${kind}-${sequence}`, createdAt: Date.now(), attempts: 0 });
}

function markTaskCompleted(task: MockTask): void {
  task.status = 'completed';
  task.processedAt = Date.now();
  delete task.lastError;
}


function appendFinancialFact(state: MockRootState, input: Omit<MockFinancialFact, 'id' | 'createdAt'>): void {
  if (state.financialFacts.some((fact) => fact.businessKey === input.businessKey)) return;
  state.financialFacts.push({
    ...input,
    id: `financial-${state.sequence++}`,
    amountFen: Math.max(0, Math.floor(input.amountFen)),
    createdAt: new Date().toISOString(),
  });
}


export function resetFixture(): void {
  const state = emptyMockState();
  state.listings = seedListings();
  state.addresses = seedAddresses();
  state.cabinetSlots = seedCabinetSlots();
  state.vouchers = seedVouchers();
  state.walletEntries = [];
  state.initialized = true;
  clearLegacyMockStorage();
  writeMockState(state);
  selectedRegion = '上海市徐汇区';
}


export function runMockOrchestrator(options: { force?: boolean; maxTasks?: number; orderId?: string; taskKind?: MockTaskKind } = {}): number {
  let processed = 0;
  const maxTasks = options.maxTasks ?? 50;
  while (processed < maxTasks) {
    const state = ensureState();
    const expectedRevision = state.revision;
    const task = state.tasks.find((item) => item.kind === 'listing_review' && item.status === 'pending' && (!options.orderId || item.orderId === options.orderId) && (!options.taskKind || item.kind === options.taskKind) && (options.force || item.dueAt <= Date.now()));
    if (!task) break;
    task.attempts += 1;
    if (task.kind === 'listing_review') {
      const listing = state.listings.find((item) => item.id === task.orderId);
      if (!listing || listing.status !== 'reviewing') {
        task.lastError = '刊登审核迁移条件不满足';
        task.dueAt = Date.now() + 1_000;
        writeMockState(state, expectedRevision);
        break;
      }
      listing.status = 'pricing';
      listing.updatedAt = new Date().toISOString();
      markTaskCompleted(task);
      state.processedEventIds.push(task.eventId);
      writeMockState(state, expectedRevision);
      processed += 1;
      continue;
    }
  }
  return processed;
}


export function getCurrentMockAccount(): MockAccount {
  const state = ensureState();
  return { ...(state.accounts.find((account) => account.id === state.currentAccountId) ?? state.accounts[0]!) };
}

export function getCurrentMockProfile(): MockLocalProfile {
  const state = ensureState();
  const account = state.accounts.find((item) => item.id === state.currentAccountId) ?? state.accounts[0]!;
  return { accountId: account.id, name: state.profileNames?.[account.id] ?? account.name, avatarPath: state.profileAvatars?.[account.id] ?? '', phone: state.verifiedPhones[account.id] ?? '' };
}

export function updateCurrentMockProfile(input: { name: string; avatarPath?: string }): MockLocalProfile | null {
  const name = input.name.trim();
  if (!name) return null;
  const state = ensureState();
  const account = state.accounts.find((item) => item.id === state.currentAccountId);
  if (!account) return null;
  state.profileNames ??= {};
  state.profileNames[account.id] = name;
  state.profileAvatars ??= {};
  if (input.avatarPath !== undefined) state.profileAvatars[account.id] = input.avatarPath.trim();
  settleGrowthTask(state, 'profile');
  writeMockState(state);
  return getCurrentMockProfile();
}

export function listMockAccounts(): MockAccount[] { return ensureState().accounts.map((account) => ({ ...account })); }

export function findMockAccountIdByPhone(phone: string): string | null {
  const normalized = phone.trim();
  const state = ensureState();
  return Object.entries(state.verifiedPhones).find(([, value]) => value === normalized)?.[0] ?? null;
}

export function switchMockAccount(accountId: string): boolean {
  const state = ensureState();
  if (!state.accounts.some((account) => account.id === accountId)) return false;
  state.currentAccountId = accountId;
  writeMockState(state);
  return true;
}


export function getPendingMockTasks(orderId?: string): MockTask[] {
  return ensureState().tasks.filter((task) => task.status === 'pending' && (!orderId || task.orderId === orderId)).map((task) => ({ ...task }));
}

export interface MockListingDraft {
  name: string; category: string; brand: string; model: string; condition: string; notes: string; accessories: string;
  description: string; location: string; deliveryMethods: string[]; photoRefs: string[]; proofRefs: string[];
  expectedRentYuan?: number; expectedDepositYuan?: number;
  serialNumber?: string; availabilityStart?: string; availabilityEnd?: string; deliveryRules?: Record<string, string>; deliveryAddresses?: Record<string, string>;
  runnerContact?: string; runnerPhone?: string; runnerService?: string; meetingAddress?: string; meetingTime?: string;
}

export interface MockPublishEligibility {
  memberLevel: string;
  identityStatus: 'unverified' | 'documents_submitted' | 'verified';
  identityName: string;
  publishQuota: number;
  publishQuotaTotal: number;
  publishQuotaUsed: number;
  serviceBalance: MockServiceBalance;
  publishEnabled: boolean;
}

export interface MockPublishQuotaPurchaseResult {
  ok: boolean;
  added: number;
  diamondCost: number;
  available: number;
  total: number;
  reason: string;
}

export interface MockServicePurchaseResult {
  ok: boolean;
  kind: MockServicePurchaseKind;
  quantity: number;
  diamondCost: number;
  diamondBalance: number;
  balance: MockServiceBalance;
  record: MockServicePurchaseRecord | null;
  reason: string;
}

export interface MockWalletViewEntry {
  id: string;
  listingId: string;
  listingName: string;
  orderId: string;
  rentFen: number;
  amountFen: number;
  state: MockWalletEntryState;
  stateText: string;
  settlementCondition: string;
  createdAt: string;
}

export interface MockWalletView {
  escrowFen: number;
  expectedFen: number;
  availableFen: number;
  entries: MockWalletViewEntry[];
  withdrawals: MockWithdrawalRecord[];
}

export interface MockWithdrawalResult {
  ok: boolean;
  record: MockWithdrawalRecord | null;
  reason: string;
}

export function getMockPublishEligibility(): MockPublishEligibility {
  const state = ensureState();
  const identity = getIdentityProfile();
  const serviceBalance = availableServices(state, state.currentAccountId);
  const publishQuota = state.publishQuotas[state.currentAccountId] ?? 0;
  const publishQuotaTotal = Math.max(publishQuota, state.publishQuotaTotals[state.currentAccountId] ?? publishQuota);
  return {
    memberLevel: getMockStarBalance() >= getMockMemberRules().publishStars ? '黄金会员 / LV3+' : '等级不足',
    identityStatus: identity.status,
    identityName: identity.name,
    publishQuota,
    publishQuotaTotal,
    publishQuotaUsed: Math.max(0, publishQuotaTotal - publishQuota),
    serviceBalance: { ...serviceBalance },
    publishEnabled: identity.status === 'verified' && publishQuota > 0 && getMockStarBalance() >= getMockMemberRules().publishStars,
  };
}

const publishQuotaCosts: Record<1 | 5 | 12, number> = { 1: 800, 5: 3_500, 12: 7_200 };

export function purchaseMockPublishQuota(quantity: 1 | 5 | 12): MockPublishQuotaPurchaseResult {
  const state = ensureState();
  const diamondCost = publishQuotaCosts[quantity];
  if (!diamondCost) return { ok: false, added: 0, diamondCost: 0, available: state.publishQuotas[state.currentAccountId] ?? 0, total: state.publishQuotaTotals[state.currentAccountId] ?? 0, reason: '当前发布服务不可购买' };
  const diamondBalance = getMockDiamondBalance();
  if (diamondBalance < diamondCost) return { ok: false, added: 0, diamondCost, available: state.publishQuotas[state.currentAccountId] ?? 0, total: state.publishQuotaTotals[state.currentAccountId] ?? 0, reason: '粉钻余额不足' };
  consumeMockDiamonds(state, diamondCost, `publish-quota:${state.currentAccountId}:${state.sequence}`, 'debit', '购买发布额度');
  state.publishQuotas[state.currentAccountId] = (state.publishQuotas[state.currentAccountId] ?? 0) + quantity;
  state.publishQuotaTotals[state.currentAccountId] = (state.publishQuotaTotals[state.currentAccountId] ?? state.publishQuotas[state.currentAccountId]!) + quantity;
  writeMockState(state);
  return { ok: true, added: quantity, diamondCost, available: state.publishQuotas[state.currentAccountId]!, total: state.publishQuotaTotals[state.currentAccountId]!, reason: '' };
}

export function purchaseMockService(kind: MockServicePurchaseKind, quantity: number, _priceText: string, intent?: { idempotencyKey: string; accountId: string; ruleVersion: string; diamondCost: number }): MockServicePurchaseResult {
  const state = ensureState();
  void _priceText; // Retained call signature; configured prices are authoritative.
  const normalizedQuantity = Math.floor(quantity);
  const current = { ...(state.serviceBalances[state.currentAccountId] ?? { contract: 0, face: 2, risk: 2 }) };
  const diamondCosts = getMockMemberRules().servicePrices;
  const isServiceKind = ['contract', 'face', 'risk', 'bundle'].includes(kind);
  const isServiceQuantity = [1, 5, 12].includes(normalizedQuantity);
  const diamondCost = isServiceKind && isServiceQuantity ? diamondCosts[kind][normalizedQuantity as 1 | 5 | 12] : 0;
  const diamondBalance = getMockDiamondBalance();
  const reject = (reason: string): MockServicePurchaseResult => ({ ok: false, kind, quantity: normalizedQuantity, diamondCost, diamondBalance, balance: current, record: null, reason });
  if (!intent?.idempotencyKey.trim() || intent.accountId !== state.currentAccountId) return reject('购买请求或账户已失效，请重新确认');
  const existing = state.servicePurchaseRecords.find((item) => item.userId === intent.accountId && item.idempotencyKey === intent.idempotencyKey);
  if (existing) {
    if (existing.kind !== kind || existing.quantity !== quantity || existing.ruleVersion !== intent.ruleVersion || existing.diamondCost !== intent.diamondCost) return reject('购买请求已绑定其他参数');
    return { ok: true, kind, quantity, diamondCost: existing.diamondCost!, diamondBalance, balance: current, record: { ...existing }, reason: '' };
  }
  if (!Number.isInteger(quantity)) return reject('套餐数量无效');
  if (intent.ruleVersion !== getMockMemberRules().version || intent.diamondCost !== diamondCost) return reject('套餐价格已更新，请确认新价格后再次购买');
  if (!diamondCost) return { ok: false, kind, quantity: normalizedQuantity, diamondCost: 0, diamondBalance, balance: current, record: null, reason: '当前服务套餐不可购买' };
  if (diamondBalance < diamondCost) return { ok: false, kind, quantity: normalizedQuantity, diamondCost, diamondBalance, balance: current, record: null, reason: '粉钻余额不足' };
  consumeMockDiamonds(state, diamondCost, `rental-service:${state.currentAccountId}:${state.sequence}`, 'debit', '购买出租服务');
  if (kind === 'bundle') {
    current.contract += normalizedQuantity;
    current.face += normalizedQuantity;
    current.risk += normalizedQuantity;
  } else {
    current[kind] += normalizedQuantity;
  }
  state.serviceBalances[state.currentAccountId] = current;
  const record: MockServicePurchaseRecord = { id: `service-purchase-${state.sequence++}`, userId: state.currentAccountId, idempotencyKey: intent.idempotencyKey, kind, quantity: normalizedQuantity, priceText: `${diamondCost} 粉钻`, diamondCost, ruleVersion: getMockMemberRules().version, createdAt: new Date().toISOString() };
  state.servicePurchaseRecords.unshift(record);
  writeMockState(state);
  return { ok: true, kind, quantity: normalizedQuantity, diamondCost, diamondBalance: diamondBalance - diamondCost, balance: { ...current }, record: { ...record }, reason: '' };
}

export function getMockServicePurchaseRecords(): MockServicePurchaseRecord[] {
  const state = ensureState();
  return state.servicePurchaseRecords.filter((record) => record.userId === state.currentAccountId).map((record) => ({ ...record }));
}

function listingProjection(listing: MockListing): MockListing {
  const guidance = listing.priceGuidance ?? listingPriceGuidanceFor(listing.category);
  return {
    ...listing,
    priceGuidance: guidance,
    expectedRentFen: listing.expectedRentFen ?? listing.priceFen ?? guidance.rentMinFen,
    expectedDepositFen: listing.expectedDepositFen ?? listing.depositFen ?? guidance.depositMinFen,
    deliveryMethods: [...listing.deliveryMethods],
    photoRefs: [...listing.photoRefs],
    proofRefs: [...listing.proofRefs],
  };
}

function isDiagnosticListing(listing: MockListing): boolean {
  return listing.id.startsWith('listing-own-') || listing.id === 'listing-other-listed';
}

export function getMockListings(): MockListing[] {
  const state = ensureState();
  return state.listings.filter((listing) => listing.lessorUserId === state.currentAccountId).map(listingProjection);
}

export function getMockListing(id: string): MockListing | undefined {
  const listing = getMockListings().find((item) => item.id === id);
  return listing ? listingProjection(listing) : undefined;
}

function walletStateForOrder(order: RentalOrder): MockWalletEntryState {
  if (order.axes.settlement === 'succeeded') return 'settled';
  if (order.axes.payment === 'paid') return 'escrow';
  return 'pending';
}

function walletEntriesForAccount(state: MockRootState, accountId: string): MockWalletViewEntry[] {
  const seeded = state.walletEntries
    .filter((entry) => entry.userId === accountId)
    .map((entry) => ({
      id: entry.id,
      listingId: entry.listingId,
      listingName: entry.listingNameSnapshot,
      orderId: entry.orderId,
      rentFen: entry.rentFen,
      amountFen: entry.amountFen,
      state: entry.state,
      stateText: entry.state === 'settled' ? '已入账' : entry.state === 'escrow' ? '预计收入冻结' : '待收款',
      settlementCondition: entry.settlementCondition,
      createdAt: entry.createdAt,
    }));
  const live = state.orders
    .filter((order) => order.kind === 'c2c' && order.lessorUserId === accountId && !order.diagnosticFixture)
    .map((order) => {
      const listingId = order.deviceId.startsWith('listing-device-') ? order.deviceId.slice('listing-device-'.length) : '';
      const listing = state.listings.find((item) => item.id === listingId);
      const stateForOrder = walletStateForOrder(order);
      const settlementFrozen = order.axes.appeal === 'available' || order.axes.appeal === 'open' || order.axes.dispute !== 'none';
      return {
        id: `wallet-order-${order.id}`,
        listingId,
        listingName: order.productSnapshot?.name ?? listing?.name ?? '个人设备',
        orderId: order.id,
        rentFen: order.amounts.rentFen,
        amountFen: order.amounts.settlementFen || order.amounts.rentFen,
        state: stateForOrder,
        stateText: stateForOrder === 'settled' ? '已入账' : stateForOrder === 'escrow' ? '预计收入冻结' : '待收款',
        settlementCondition: settlementFrozen ? '申诉期内资金终局和 C2C 结算冻结' : stateForOrder === 'settled' ? '已完成结算' : '归还、验机、售后和退款完成后结算',
        createdAt: order.createdAt,
      } satisfies MockWalletViewEntry;
    });
  const entries = new Map<string, MockWalletViewEntry>();
  for (const entry of [...seeded, ...live]) entries.set(entry.orderId, entry);
  return [...entries.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function walletEntriesForCurrentAccount(state: MockRootState): MockWalletViewEntry[] {
  return walletEntriesForAccount(state, state.currentAccountId);
}

export function getMockWallet(): MockWalletView {
  const state = ensureState();
  const entries = walletEntriesForCurrentAccount(state);
  const expectedFen = entries.filter((entry) => entry.state !== 'settled').reduce((total, entry) => total + entry.amountFen, 0);
  const escrowFen = entries.filter((entry) => entry.state === 'escrow').reduce((total, entry) => total + entry.amountFen, 0);
  const settledFen = entries.filter((entry) => entry.state === 'settled').reduce((total, entry) => total + entry.amountFen, 0);
  const withdrawnFen = state.withdrawals.filter((record) => record.userId === state.currentAccountId && record.state !== 'failed').reduce((total, record) => total + record.amountFen, 0);
  return {
    escrowFen,
    expectedFen,
    availableFen: Math.max(0, settledFen - withdrawnFen),
    entries,
    withdrawals: state.withdrawals.filter((record) => record.userId === state.currentAccountId).map((record) => ({ ...record })),
  };
}

export function getMockCashAccount(accountId = ensureState().currentAccountId): MockCashAccount {
  const state = ensureState();
  const entries = walletEntriesForAccount(state, accountId);
  const pendingReceivableFen = entries.filter((entry) => entry.state === 'pending').reduce((total, entry) => total + Math.max(0, entry.amountFen), 0);
  const frozenFen = entries.filter((entry) => entry.state === 'escrow').reduce((total, entry) => total + Math.max(0, entry.amountFen), 0);
  const settledFen = entries.filter((entry) => entry.state === 'settled').reduce((total, entry) => total + Math.max(0, entry.amountFen), 0);
  const withdrawalProcessingFen = state.withdrawals.filter((record) => record.userId === accountId && ['processing', 'confirming', 'unknown'].includes(record.state)).reduce((total, record) => total + Math.max(0, record.amountFen), 0);
  const withdrawnFen = state.withdrawals.filter((record) => record.userId === accountId && record.state !== 'failed').reduce((total, record) => total + Math.max(0, record.amountFen), 0);
  const depositHeldFen = state.orders.filter((order) => order.tenantUserId === accountId && ['held', 'frozen', 'deducted', 'partially_deducted'].includes(order.axes.deposit)).reduce((total, order) => total + Math.max(0, order.amounts.depositFen), 0);
  return { pendingReceivableFen, depositHeldFen, reserveFen: 0, availableFen: Math.max(0, settledFen - withdrawnFen), frozenFen, withdrawalProcessingFen, settledFen, receivedFen: settledFen };
}

export function getMockCashAccounts(): Record<string, MockCashAccount> {
  const state = ensureState();
  return Object.fromEntries(state.accounts.map((account) => [account.id, getMockCashAccount(account.id)]));
}

export function getMockFinancialFacts(): MockFinancialFact[] {
  const state = ensureState();
  return state.financialFacts
    .filter((fact) => fact.userId === state.currentAccountId)
    .map((fact) => ({ ...fact }));
}

export function submitMockWithdrawal(amountYuan: number, idempotencyKey = ''): MockWithdrawalResult {
  const state = ensureState();
  if (!Number.isInteger(amountYuan) || amountYuan <= 0) return { ok: false, record: null, reason: '请输入大于0的整数金额' };
  const wallet = getMockWallet();
  const amountFen = amountYuan * 100;
  const normalizedKey = idempotencyKey.trim();
  const existing = normalizedKey ? state.withdrawals.find((record) => record.userId === state.currentAccountId && record.idempotencyKey === normalizedKey) : undefined;
  if (existing) {
    if (existing.amountFen !== amountFen) return { ok: false, record: { ...existing }, reason: '幂等键已绑定其他提现金额' };
    return { ok: true, record: { ...existing }, reason: '' };
  }
  if (amountFen > wallet.availableFen) return { ok: false, record: null, reason: '可提现余额不足，请等待订单结算' };
  const id = `withdrawal-${state.sequence++}`;
  const record: MockWithdrawalRecord = {
    id,
    userId: state.currentAccountId,
    amountFen,
    state: 'processing',
    idempotencyKey: normalizedKey || `auto:${id}`,
    accountLabel: `微信账户 · ${state.accounts.find((account) => account.id === state.currentAccountId)?.name ?? '当前账户'}`,
    createdAt: new Date().toISOString(),
  };
  state.withdrawals.unshift(record);
  appendFinancialFact(state, { businessKey: `${id}:withdrawal_request`, kind: 'withdrawal_request', orderId: null, userId: record.userId, amountFen, source: 'withdrawal_action' });
  writeMockState(state);
  return { ok: true, record: { ...record }, reason: '' };
}

function findWithdrawal(state: MockRootState, id: string): MockWithdrawalRecord | undefined {
  return state.withdrawals.find((record) => record.id === id && record.userId === state.currentAccountId);
}

export function completeMockWithdrawal(id: string, externalResult: 'success' | 'failure' | 'confirming' | 'unknown' = 'success'): MockWithdrawalResult {
  const state = ensureState();
  const record = findWithdrawal(state, id);
  if (!record || !['processing', 'confirming', 'unknown'].includes(record.state)) return { ok: false, record: record ? { ...record } : null, reason: '当前提现无需确认' };
  if (externalResult === 'failure') record.state = 'failed';
  else if (externalResult === 'unknown') record.state = 'unknown';
  else if (externalResult === 'confirming') record.state = 'confirming';
  else {
    record.state = 'completed';
    appendFinancialFact(state, { businessKey: `${record.id}:withdrawal_payout`, kind: 'withdrawal_payout', orderId: null, userId: record.userId, amountFen: record.amountFen, source: 'withdrawal_action' });
  }
  writeMockState(state);
  return { ok: true, record: { ...record }, reason: '' };
}

export function queryMockWithdrawal(id: string): MockWithdrawalResult {
  const state = ensureState();
  const record = findWithdrawal(state, id);
  if (!record || !['processing', 'confirming', 'unknown'].includes(record.state)) return { ok: false, record: record ? { ...record } : null, reason: '当前没有待查询的提现结果' };
  record.state = record.state === 'unknown' ? 'completed' : 'unknown';
  if (record.state === 'completed') appendFinancialFact(state, { businessKey: `${record.id}:withdrawal_payout`, kind: 'withdrawal_payout', orderId: null, userId: record.userId, amountFen: record.amountFen, source: 'withdrawal_action' });
  writeMockState(state);
  return { ok: true, record: { ...record }, reason: '' };
}

export function retryMockWithdrawal(id: string): MockWithdrawalResult {
  const state = ensureState();
  const record = findWithdrawal(state, id);
  if (!record || record.state !== 'failed') return { ok: false, record: record ? { ...record } : null, reason: '当前提现无需重试' };
  record.state = 'processing';
  writeMockState(state);
  return { ok: true, record: { ...record }, reason: '' };
}

function listingDraftProjection(draftRecord: MockListingDraftRecord): MockListingDraftRecord {
  return { ...draftRecord, deliveryMethods: [...(draftRecord.deliveryMethods ?? [])], photoRefs: [...(draftRecord.photoRefs ?? [])], proofRefs: [...(draftRecord.proofRefs ?? [])] };
}

export function getMockListingDrafts(): MockListingDraftRecord[] {
  const state = ensureState();
  return Object.values(state.listingDrafts)
    .filter((draftRecord) => draftRecord.lessorUserId === state.currentAccountId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(listingDraftProjection);
}

export function getMockListingDraft(id: string): MockListingDraftRecord | undefined {
  const state = ensureState();
  const draftRecord = state.listingDrafts[id];
  if (!draftRecord || draftRecord.lessorUserId !== state.currentAccountId) return undefined;
  return listingDraftProjection(draftRecord);
}

export function saveMockListingDraft(input: MockListingDraft, draftId = ''): MockListingDraftRecord | null {
  const state = ensureState();
  const existing = draftId ? state.listingDrafts[draftId] : undefined;
  if (existing && existing.lessorUserId !== state.currentAccountId) return null;
  const now = new Date().toISOString();
  const id = existing?.id ?? (draftId || `listing-draft-${state.sequence++}`);
  const record: MockListingDraftRecord = {
    ...(existing ?? {}),
    ...input,
    id,
    lessorUserId: state.currentAccountId,
    status: 'draft',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deliveryMethods: [...input.deliveryMethods],
    photoRefs: [...input.photoRefs],
    proofRefs: [...input.proofRefs],
  };
  state.listingDrafts[id] = record;
  writeMockState(state);
  return listingDraftProjection(record);
}

export function deleteMockListingDraft(id: string): boolean {
  const state = ensureState();
  const draftRecord = state.listingDrafts[id];
  if (!draftRecord || draftRecord.lessorUserId !== state.currentAccountId) return false;
  delete state.listingDrafts[id];
  writeMockState(state);
  return true;
}

export function createMockListing(input: MockListingDraft): MockListing | null {
  const state = ensureState();
  if (getIdentityProfile().status !== 'verified') return null;
  if ((state.publishQuotas[state.currentAccountId] ?? 0) <= 0 || getMockStarBalance() < getMockMemberRules().publishStars) return null;
  const today = dateText(new Date());
  const supportedDeliveries = input.deliveryMethods.every((method) => ['express', 'runner', 'meet'].includes(method));
  const runnerSelected = input.deliveryMethods.includes('runner');
  const meetSelected = input.deliveryMethods.includes('meet');
  const guidance = listingPriceGuidanceFor(input.category);
  const expectedRentYuan = input.expectedRentYuan ?? 0;
  const expectedDepositYuan = input.expectedDepositYuan ?? 0;
  const validExpectedPrice = Number.isInteger(expectedRentYuan) && expectedRentYuan * 100 >= guidance.rentMinFen && expectedRentYuan * 100 <= guidance.rentMaxFen
    && Number.isInteger(expectedDepositYuan) && expectedDepositYuan * 100 >= guidance.depositMinFen && expectedDepositYuan * 100 <= guidance.depositMaxFen;
  if (!validExpectedPrice || !input.brand.trim() || !input.model.trim() || !input.condition.trim() || !input.location.trim() || !input.serialNumber?.trim() || !input.availabilityStart || !input.availabilityEnd || input.availabilityStart < today || input.availabilityEnd < input.availabilityStart || input.photoRefs.length < 1 || input.photoRefs.length > 9 || input.proofRefs.length < 1 || input.proofRefs.length > 6 || input.deliveryMethods.length < 1 || !supportedDeliveries || (runnerSelected && (!input.runnerContact?.trim() || !/^1\d{10}$/.test(input.runnerPhone?.trim() ?? '') || !input.runnerService?.trim())) || (meetSelected && (!input.meetingAddress?.trim() || !input.meetingTime?.trim()))) return null;
  const sequence = state.sequence++;
  const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
  const listing: MockListing = { id: `listing-${sequence}`, lessorUserId: state.currentAccountId, name: input.name.trim() || `${input.brand.trim()} ${input.model.trim()}`, category: input.category, brand: input.brand.trim(), model: input.model.trim(), condition: input.condition.trim(), notes: input.notes.trim(), accessories: input.accessories.trim(), description: input.description.trim(), location: input.location.trim(), deliveryMethods: [...input.deliveryMethods], photoRefs: [...input.photoRefs], proofRefs: [...input.proofRefs], priceFen: null, depositFen: null, expectedRentFen: expectedRentYuan * 100, expectedDepositFen: expectedDepositYuan * 100, priceGuidance: guidance, status: 'reviewing', createdAt: now, updatedAt: now, serialNumber: input.serialNumber.trim(), availabilityStart: input.availabilityStart, availabilityEnd: input.availabilityEnd, deliveryRules: { ...(input.deliveryRules ?? {}) }, deliveryAddresses: { ...(input.deliveryAddresses ?? {}), express: input.deliveryAddresses?.express || input.location.trim(), runner: input.deliveryAddresses?.runner || input.location.trim(), meet: input.deliveryAddresses?.meet || input.meetingAddress?.trim() || input.location.trim() }, runnerContact: input.runnerContact?.trim() ?? '', runnerPhone: input.runnerPhone?.trim() ?? '', runnerService: input.runnerService?.trim() ?? '', meetingAddress: input.meetingAddress?.trim() ?? input.location.trim(), meetingTime: input.meetingTime?.trim() ?? '' };
  state.listings.unshift(listing);
  settleGrowthTask(state, 'publish');
  state.publishQuotas[state.currentAccountId] = (state.publishQuotas[state.currentAccountId] ?? 0) - 1;
  scheduleTask(state, listing.id, 'listing_review', 1200);
  writeMockState(state);
  return { ...listing };
}

export function updateMockListing(id: string, patch: Partial<MockListingDraft>): MockListing | null {
  const state = ensureState();
  if (getIdentityProfile().status !== 'verified') return null;
  const listing = state.listings.find((item) => item.id === id && item.lessorUserId === state.currentAccountId);
  if (!listing || state.orders.some((order) => order.deviceId === `listing-device-${id}` && !['completed', 'cancelled'].includes(order.axes.order))) return null;
  const today = dateText(new Date());
  const deliveryMethods = patch.deliveryMethods ?? listing.deliveryMethods;
  const supportedDeliveries = deliveryMethods.every((method) => ['express', 'runner', 'meet'].includes(method));
  const availabilityStart = patch.availabilityStart ?? listing.availabilityStart;
  const availabilityEnd = patch.availabilityEnd ?? listing.availabilityEnd;
  if (patch.photoRefs && (patch.photoRefs.length < 1 || patch.photoRefs.length > 9)) return null;
  if (patch.proofRefs && (patch.proofRefs.length < 1 || patch.proofRefs.length > 6)) return null;
  const runnerSelected = deliveryMethods.includes('runner');
  const meetSelected = deliveryMethods.includes('meet');
  const meetingAddress = patch.meetingAddress?.trim() || listing.meetingAddress?.trim() || patch.location?.trim() || listing.location.trim();
  const meetingTime = patch.meetingTime?.trim() || listing.meetingTime?.trim() || '';
  const guidance = listing.priceGuidance ?? listingPriceGuidanceFor(listing.category);
  const expectedRentFen = patch.expectedRentYuan === undefined ? (listing.expectedRentFen ?? guidance.rentMinFen) : patch.expectedRentYuan * 100;
  const expectedDepositFen = patch.expectedDepositYuan === undefined ? (listing.expectedDepositFen ?? guidance.depositMinFen) : patch.expectedDepositYuan * 100;
  if (!supportedDeliveries || deliveryMethods.length < 1 || !availabilityStart || !availabilityEnd || availabilityStart < today || availabilityEnd < availabilityStart || expectedRentFen < guidance.rentMinFen || expectedRentFen > guidance.rentMaxFen || !Number.isInteger(expectedRentFen) || expectedDepositFen < guidance.depositMinFen || expectedDepositFen > guidance.depositMaxFen || !Number.isInteger(expectedDepositFen) || (runnerSelected && ((!patch.runnerContact?.trim() && !listing.runnerContact?.trim()) || (!patch.runnerPhone?.trim() && !listing.runnerPhone?.trim()) || (!patch.runnerService?.trim() && !listing.runnerService?.trim()))) || (meetSelected && (!meetingAddress || !meetingTime))) return null;
  Object.assign(listing, {
    ...patch,
    name: patch.name?.trim() || listing.name,
    brand: patch.brand?.trim() || listing.brand,
    model: patch.model?.trim() || listing.model,
    condition: patch.condition?.trim() || listing.condition,
    location: patch.location?.trim() || listing.location,
    updatedAt: new Date().toISOString(),
  });
  listing.expectedRentFen = expectedRentFen;
  listing.expectedDepositFen = expectedDepositFen;
  listing.priceGuidance = guidance;
  if (patch.deliveryAddresses) listing.deliveryAddresses = { ...(listing.deliveryAddresses ?? {}), ...patch.deliveryAddresses };
  if (listing.status === 'rejected') { listing.status = 'reviewing'; listing.rejectReason = ''; }
  if (listing.status === 'reviewing') scheduleTask(state, listing.id, 'listing_review', 1200);
  writeMockState(state);
  return { ...listing, deliveryMethods: [...listing.deliveryMethods], photoRefs: [...listing.photoRefs], proofRefs: [...listing.proofRefs] };
}

export function setMockListingPrice(id: string, priceYuan: number, depositYuan: number, availabilityStart?: string, availabilityEnd?: string): boolean {
  if (!Number.isInteger(priceYuan) || !Number.isInteger(depositYuan)) return false;
  const state = ensureState();
  const listing = state.listings.find((item) => item.id === id && item.lessorUserId === state.currentAccountId);
  if (!listing || listing.status !== 'pricing') return false;
  const guidance = listing.priceGuidance ?? listingPriceGuidanceFor(listing.category);
  if (priceYuan * 100 < guidance.rentMinFen || priceYuan * 100 > guidance.rentMaxFen || depositYuan * 100 < guidance.depositMinFen || depositYuan * 100 > guidance.depositMaxFen) return false;
  const nextStart = availabilityStart ?? listing.availabilityStart;
  const nextEnd = availabilityEnd ?? listing.availabilityEnd;
  const today = dateText(new Date());
  if (!nextStart || !nextEnd || nextStart < today || nextEnd < nextStart) return false;
  listing.priceFen = priceYuan * 100;
  listing.depositFen = depositYuan * 100;
  listing.expectedRentFen = priceYuan * 100;
  listing.expectedDepositFen = depositYuan * 100;
  listing.availabilityStart = nextStart;
  listing.availabilityEnd = nextEnd;
  listing.priceGuidance = guidance;
  listing.status = 'listed';
  listing.updatedAt = new Date().toISOString();
  writeMockState(state);
  return true;
}

export function setMockListingStatus(id: string, status: Extract<MockListingStatus, 'listed' | 'unlisted'>): boolean {
  const state = ensureState();
  const listing = state.listings.find((item) => item.id === id && item.lessorUserId === state.currentAccountId);
  const transitionAllowed = listing && ((listing.status === 'listed' && status === 'unlisted') || (listing.status === 'unlisted' && status === 'listed'));
  if (!listing || listing.priceFen === null || !transitionAllowed) return false;
  if (state.orders.some((order) => order.deviceId === `listing-device-${id}` && !['completed', 'cancelled'].includes(order.axes.order))) return false;
  listing.status = status;
  listing.updatedAt = new Date().toISOString();
  writeMockState(state);
  return true;
}

export function deliveryLabel(method: DeliveryMethod | null): string {
  if (!method) return '尚未选择';
  return deliveryOptions.find((option) => option.id === method)?.label ?? '未知方式';
}

export function depositLabel(plan: DepositPlan): string {
  return depositOptions.find((option) => option.id === plan)?.label ?? '全额支付';
}

export function moneyYuan(fen: number): string {
  return (fen / 100).toFixed(fen % 100 === 0 ? 0 : 2);
}
