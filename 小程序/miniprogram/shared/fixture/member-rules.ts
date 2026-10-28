/** Mock defaults for API-owned rules; consumers render this projection. */
export function getMockMemberRules() {
  return {
    version: 'member-20260909-1',
    publishStars: 2_000,
    daily: { starPoints: 20, diamondPoints: 20, note: '每日签到奖励' },
    growth: {
      profile: { starPoints: 100, diamondPoints: 50, note: '完善个人资料奖励' },
      identity: { starPoints: 100, diamondPoints: 100, note: '实名认证与人脸核身奖励' },
      checkin: { starPoints: 50, diamondPoints: 0, note: '首次签到奖励' },
      publish: { starPoints: 10, diamondPoints: 5, note: '发布设备奖励' },
    },
    milestones: [
      { days: 7, starPoints: 20, diamondPoints: 20, insurance: [20], rental: [] as number[] },
      { days: 14, starPoints: 40, diamondPoints: 40, insurance: [20, 50], rental: [] as number[] },
      { days: 30, starPoints: 80, diamondPoints: 80, insurance: [10, 20, 30, 50, 100], rental: [20] },
    ],
    couponValidDays: 365,
    missions: [
      { id: 'devices', target: 5, starPoints: 50, title: '浏览 5 台租赁设备', route: '/pages/home/index' },
      { id: 'inventory', target: 10, starPoints: 20, title: '查看 10 个库存点位', route: '/pages/cabinets/index' },
      { id: 'guide', target: 3, starPoints: 6, title: '阅读 3 条租赁指南', route: '/pages/info-guide/index' },
    ],
    reminderEnabled: false,
    servicePrices: { contract: { 1: 123, 5: 550, 12: 1200 }, face: { 1: 123, 5: 550, 12: 1200 }, risk: { 1: 123, 5: 550, 12: 1200 }, bundle: { 1: 299, 5: 1299, 12: 2999 } },
    serviceUnits: { contract: 1, face: 1, risk: 1 },
  };
}
