Component({
  options: { multipleSlots: true, styleIsolation: 'isolated' },
  properties: {
    open: { type: Boolean, value: false },
    title: { type: String, value: '' },
    busy: { type: Boolean, value: false },
    showFooter: { type: Boolean, value: true },
    fullHeight: { type: Boolean, value: false },
  },
  data: { bodyHeight: 280 },
  observers: {
    'open, showFooter, fullHeight'() { if (this.data.open) wx.nextTick(() => this.measureBody()); },
  },
  lifetimes: { ready() { if (this.data.open) this.measureBody(); } },
  pageLifetimes: { resize() { if (this.data.open) wx.nextTick(() => this.measureBody()); } },
  methods: {
    measureBody() {
      if (!this.data.open) return;
      const system = wx.getWindowInfo();
      const safeBottom = Math.max(0, system.screenHeight - (system.safeArea?.bottom ?? system.screenHeight));
      const query = this.createSelectorQuery();
      for (const selector of ['.sheet__header', '.sheet__content', '.sheet__summary', '.sheet__footer']) query.select(selector).boundingClientRect();
      query.exec((rects: Array<WechatMiniprogram.BoundingClientRectCallbackResult | null>) => {
        if (!this.data.open) return;
        const [header, content, summary, footer] = rects;
        const sheetHeight = this.data.fullHeight ? system.windowHeight : Math.min(system.windowHeight * 0.75, 640);
        const available = Math.max(80, sheetHeight - safeBottom - (header?.height ?? 52) - (summary?.height ?? 0) - (footer?.height ?? 0));
        this.setData({ bodyHeight: this.data.fullHeight ? available : Math.min(content?.height ?? available, available) });
      });
    },
    close() { if (!this.data.busy) this.triggerEvent('close'); },
    stop() { wx.nextTick(() => this.measureBody()); },
  },
});
