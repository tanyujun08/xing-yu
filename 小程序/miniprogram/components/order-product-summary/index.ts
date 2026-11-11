export {};

const measurements = new WeakMap<object, { ready: boolean; epoch: number }>();
function measurement(component: object) {
  let state = measurements.get(component);
  if (!state) { state = { ready: false, epoch: 0 }; measurements.set(component, state); }
  return state;
}

Component({
  options: { multipleSlots: true, styleIsolation: 'isolated' },
  properties: {
    title: { type: String, value: '' },
    secondary: { type: String, value: '' },
    mediaSrc: { type: String, value: '' },
    mediaState: { type: String, value: 'idle' },
    variant: { type: String, value: 'detail' },
    clickable: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
  },
  data: { titleOverflow: false, titleExpanded: false },
  observers: {
    'title, variant'() {
      this.setData({ titleOverflow: false, titleExpanded: false });
      this.measureTitle();
    },
  },
  lifetimes: {
    ready() { measurement(this).ready = true; this.measureTitle(); },
    detached() { const state = measurement(this); state.ready = false; state.epoch++; },
  },
  pageLifetimes: { resize() { this.measureTitle(); } },
  methods: {
    measureTitle() {
      const state = measurement(this), epoch = ++state.epoch;
      if (!state.ready || this.data.variant !== 'order-list' || !this.data.title) return;
      const title = this.data.title;
      wx.nextTick(() => {
        if (!state.ready || state.epoch !== epoch) return;
        this.createSelectorQuery().select('.summary__title-measure')
          .fields({ size: true, computedStyle: ['line-height'] })
          .exec((nodes: Array<{ height?: number; 'line-height'?: string } | null>) => {
            if (!state.ready || state.epoch !== epoch || this.data.title !== title || this.data.variant !== 'order-list') return;
            const node = nodes[0], lineHeight = Number.parseFloat(node?.['line-height'] ?? '');
            // An unavailable measurement must not hide the user's full title.
            if (!node || !Number.isFinite(lineHeight) || lineHeight <= 0 || !Number.isFinite(node.height) || (node.height ?? 0) <= 0) {
              this.setData({ titleOverflow: false, titleExpanded: true });
              return;
            }
            const overflow = (node.height ?? 0) > lineHeight * 2 + 1;
            this.setData({ titleOverflow: overflow, titleExpanded: overflow && this.data.titleExpanded });
          });
      });
    },
    toggleTitle() {
      if (measurement(this).ready && this.data.variant === 'order-list' && this.data.titleOverflow)
        this.setData({ titleExpanded: !this.data.titleExpanded });
    },
    open() { if (this.data.clickable) this.triggerEvent('open'); },
    retry() { this.triggerEvent('retry'); },
  },
});
