// 订单流程状态头：很浅的同色渐变 + 右侧 3D 插画。标题前不放图标，说明最多两行。
// variant="band"（方向 A）：通栏纯色带，step>=0 时在下方画「签约 取件 使用 归还 结算」五段进度，stepNote 写在当前段下面。
const ART: Record<string, string> = {
  contract: '/assets/status-3d/contract.png',
  clock: '/assets/status-3d/clock.png',
  check: '/assets/status-3d/check.png',
  calendar: '/assets/status-3d/calendar.png',
  wallet: '/assets/status-3d/wallet.png',
  shield: '/assets/status-3d/shield.png',
  'shield-green': '/assets/status-3d/shield-green.png',
  cabinet: '/assets/status-3d/cabinet.png',
  parcel: '/assets/status-3d/parcel.png',
  magnifier: '/assets/status-3d/magnifier.png',
  bill: '/assets/status-3d/bill.png',
  'cabinet-wait': '/assets/status-3d/cabinet-wait.png',
  archive: '/assets/status-3d/archive.png',
};

const TONES = ['green', 'orange', 'red', 'blue', 'purple', 'neutral'];
const STEPS = ['签约', '取件', '使用', '归还', '结算'];

Component({
  options: { multipleSlots: true, styleIsolation: 'isolated' },
  properties: {
    tone: { type: String, value: 'green', observer() { this.sync(); } },
    art: { type: String, value: '', observer() { this.sync(); } },
    title: { type: String, value: '' },
    description: { type: String, value: '' },
    variant: { type: String, value: 'card', observer() { this.sync(); } },
    step: { type: Number, value: -1, observer() { this.sync(); } },
    stepNote: { type: String, value: '' },
  },
  data: { toneClass: 'green', artSrc: '', variantClass: 'card', steps: [] as { key: string; label: string; state: string }[] },
  lifetimes: { attached() { this.sync(); } },
  methods: {
    sync() {
      const tone = String(this.data.tone || 'green');
      this.setData({
        toneClass: TONES.indexOf(tone) >= 0 ? tone : 'green',
        artSrc: ART[String(this.data.art || '')] || '',
        variantClass: this.data.variant === 'band' ? 'band' : 'card',
        steps: this.data.variant === 'band' && this.data.step >= 0
          ? STEPS.map((label, index) => ({ key: label, label, state: index < this.data.step ? 'is-done' : index === this.data.step ? 'is-current' : '' }))
          : [],
      });
    },
  },
});
