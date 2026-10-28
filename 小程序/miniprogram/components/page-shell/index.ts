Component({
  options: { multipleSlots: true, styleIsolation: 'isolated' },
  properties: {
    scrollMode: { type: String, value: 'document' },
    surface: { type: String, value: 'page' },
    footerSurface: { type: String, value: 'surface' },
    ariaBusy: { type: Boolean, value: false },
    fixedHeader: { type: Boolean, value: false },
    hasFooter: { type: Boolean, value: true },
  },
  methods: {
    onLower() {
      if (this.data.scrollMode === 'viewport') this.triggerEvent('lower');
    },
  },
});
