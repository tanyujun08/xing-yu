import { type DesignAssetName } from '../design/assets';

export type InfoGuideId = 'rental-flow' | 'deposit-waiver' | 'device-protection' | 'user-agreement' | 'privacy-policy';

export type InfoGuide = {
  id: InfoGuideId;
  title: string;
  summary: string;
  icon: DesignAssetName;
  sections: Array<{ title: string; body: string }>;
};

export type InfoGuideView = InfoGuide & { kicker: string };

/** Directory entries are copy and routing projections, so they belong to the presentation layer. */
export type InfoGuideDirectoryEntry = { id: InfoGuideId; title: string; route: string };

const directoryOrder: InfoGuideId[] = ['rental-flow', 'deposit-waiver', 'device-protection'];

export const infoGuides: InfoGuide[] = [
  {
    id: 'rental-flow',
    title: '租赁流程',
    summary: '选设备、确认租期，完成身份与合同后即可取用',
    icon: 'guideRental',
    sections: [
      { title: '选设备', body: '按柜机、门店或个人设备浏览，先确认可租时间、交付方式和设备资料。' },
      { title: '确认订单', body: '确认租期、交付和押金方案后提交订单；需要办理的身份和合同信息会在订单中提示。' },
      { title: '完成履约', body: '支付确认后按选定方式取用设备，交付、归还和验机进度会记录在订单详情中。' },
    ],
  },
  {
    id: 'deposit-waiver',
    title: '押金与免押',
    summary: '了解现金押金、微信免押和粉钻部分免押',
    icon: 'guideDeposit',
    sections: [
      { title: '押金方案', body: '不同设备和租赁方式支持的押金方案可能不同，下单时以订单页面展示为准。' },
      { title: '部分免押', body: '粉钻只按订单规则减少现金押金，不用于租金、售后或补缴。' },
      { title: '结果记录', body: '押金冻结、扣除、退回或免押结果会跟随订单进度展示。' },
    ],
  },
  {
    id: 'device-protection',
    title: '设备保障',
    summary: '交付、归还、验机和售后节点都有记录',
    icon: 'guideProtection',
    sections: [
      { title: '履约记录', body: '设备交付、归还、验机和相关凭证会保存在订单记录中，便于双方查看处理进度。' },
      { title: '售后守护', body: '售后守护提供优先排队、进度消息和一次主动跟进，具体以订单已购买服务为准。' },
      { title: '安心保', body: '意外损坏、缺件或丢失等情况按保障条款审核处理，订单会记录相关证据和结果。' },
    ],
  },
  {
    id: 'user-agreement',
    title: '用户协议',
    summary: '使用星遇服务前，请阅读并遵守以下约定。',
    icon: 'guideRental',
    sections: [
      { title: '服务范围', body: '星遇提供数码设备浏览、租赁、发布和订单协同服务，具体服务内容以页面展示为准。' },
      { title: '账号与使用', body: '你应使用本人账号并妥善保管登录信息，不得以任何方式转让、出租或冒用账号。' },
      { title: '订单与设备', body: '下单前请核对租期、费用、交付方式和设备资料；设备交付、归还及验机结果以订单记录为准。' },
      { title: '内容与责任', body: '发布设备和提交资料时应保证真实、合法、完整，不得上传侵犯他人权益或违反法律法规的内容。' },
      { title: '协议更新', body: '为持续改善服务，我们可能更新协议内容；重要变更会通过适当方式提示，并在生效前留出合理时间。' },
    ],
  },
  {
    id: 'privacy-policy',
    title: '隐私政策',
    summary: '我们仅在提供服务所必需的范围内处理相关信息。',
    icon: 'guideProtection',
    sections: [
      { title: '收集的信息', body: '在登录、下单、交付和售后过程中，我们可能处理手机号、订单、地址、设备资料及你主动提交的凭证。' },
      { title: '使用目的', body: '相关信息用于身份验证、订单履约、设备交付、风险控制、客户服务和必要的消息通知。' },
      { title: '保存与保护', body: '我们会采取访问控制和安全措施保护信息，并在达到收集目的或法律要求的期限内保存相关记录。' },
      { title: '你的权利', body: '你可以通过客服查询、更正或删除符合条件的信息，也可以了解信息处理方式及授权范围。' },
      { title: '联系我们', body: '如对隐私保护有疑问、建议或投诉，请通过应用内客服联系我们，我们会及时核实并处理。' },
    ],
  },
];

export function infoGuideById(id: string): InfoGuide | undefined {
  return infoGuides.find((guide) => guide.id === id);
}

export function infoGuideKicker(id: InfoGuideId): string {
  if (id === 'deposit-waiver') return '押金说明';
  if (id === 'device-protection') return '设备保障';
  if (id === 'user-agreement') return '用户协议';
  if (id === 'privacy-policy') return '隐私政策';
  return '租赁流程';
}

export function infoGuideDirectory(): InfoGuideDirectoryEntry[] {
  return infoGuides
    .filter((guide) => directoryOrder.includes(guide.id))
    .map((guide) => ({ id: guide.id, title: guide.title, route: '/pages/info-guide/index?id=' + guide.id }));
}

export function infoGuideView(id: string): InfoGuideView | undefined {
  const guide = infoGuideById(id);
  return guide === undefined ? undefined : { ...guide, kicker: infoGuideKicker(guide.id) };
}
