Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    visible: { type: Boolean, value: false },
    orderStyle: { type: Boolean, value: false },
    stacked: { type: Boolean, value: false },
    tone: { type: String, value: 'confirm' },
    showCancel: { type: Boolean, value: true },
    title: { type: String, value: '请确认' },
    content: { type: String, value: '' },
    confirmText: { type: String, value: '确定' },
    cancelText: { type: String, value: '取消' },
    busy: { type: Boolean, value: false },
    symbol: { type: String, value: '' },
    eyebrow: { type: String, value: '' },
    hint: { type: String, value: '' },
    steps: { type: Array, value: [] },
    quietConfirm: { type: Boolean, value: false },
    showContact: { type: Boolean, value: false },
  },
  methods: {
    preventMove() {},
    onCancel() {
      if (this.data.visible && this.data.showCancel && !this.data.busy) this.triggerEvent('cancel');
    },
    onConfirm() {
      if (this.data.visible && !this.data.busy) this.triggerEvent('confirm');
    },
  },
});
