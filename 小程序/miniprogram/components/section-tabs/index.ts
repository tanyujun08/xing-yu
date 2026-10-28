type SectionTab = { id: string; label: string; disabled?: boolean };
export {};

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    title: { type: String, value: '' },
    tabs: { type: Array, value: [] },
    value: { type: String, value: '' },
    divider: { type: Boolean, value: false },
    ariaLabel: { type: String, value: '内容筛选' },
  },
  methods: {
    onSelect(event: WechatMiniprogram.TouchEvent) {
      const value = String(event.currentTarget.dataset['value'] ?? '');
      const tab = (this.data.tabs as SectionTab[]).find((item) => item.id === value);
      if (!tab || tab.disabled || value === this.data.value) return;
      this.triggerEvent('change', { value });
    },
  },
});
