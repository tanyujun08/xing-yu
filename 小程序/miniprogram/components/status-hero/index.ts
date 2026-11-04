// 订单流程状态头：很浅的同色渐变 + 右侧 3D 插画。标题前不放图标，说明最多两行。
const ART: Record<string, string> = {
  contract: '/assets/status-3d/contract.png',
  clock: '/assets/status-3d/clock.png',
  check: '/assets/status-3d/check.png',
  calendar: '/assets/status-3d/calendar.png',
  wallet: '/assets/status-3d/wallet.png',
  shield: '/assets/status-3d/shield.png',
  'shield-green': '/assets/status-3d/shield-green.png',
};

const TONES = ['green', 'orange', 'red', 'blue', 'purple', 'neutral'];

Component({
  options: { multipleSlots: true, styleIsolation: 'isolated' },
  properties: {
    tone: { type: String, value: 'green', observer() { this.sync(); } },
    art: { type: String, value: '', observer() { this.sync(); } },
    title: { type: String, value: '' },
    description: { type: String, value: '' },
  },
  data: { toneClass: 'green', artSrc: '' },
  lifetimes: { attached() { this.sync(); } },
  methods: {
    sync() {
      const tone = String(this.data.tone || 'green');
      this.setData({
        toneClass: TONES.indexOf(tone) >= 0 ? tone : 'green',
        artSrc: ART[String(this.data.art || '')] || '',
      });
    },
  },
});
