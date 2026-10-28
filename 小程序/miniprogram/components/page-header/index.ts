import { calculateNavigationMetrics, readNavigationMetrics } from '../../shared/presentation/navigation-metrics';

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    title: { type: String, value: '' },
    showBack: { type: Boolean, value: true },
    actionText: { type: String, value: '' },
    ariaLabel: { type: String, value: '' },
    variant: { type: String, value: '', observer: 'measure' },
    background: { type: String, value: '#ffffff' },
    inverse: { type: Boolean, value: false },
  },
  data: { statusBarHeight: 0, contentHeight: 44, totalHeight: 44 },
  lifetimes: {
    attached() { this.measure(); },
  },
  pageLifetimes: {
    show() { this.measure(); },
  },
  methods: {
    measure() {
      const minimum = ['order', 'order-primary'].includes(this.data.variant) ? 52 : 44;
      let metrics = calculateNavigationMetrics({}, {}, minimum);
      try { metrics = readNavigationMetrics(minimum); } catch { /* Use the selected design's deterministic minimum. */ }
      this.setData(metrics);
    },
    onBack() { this.triggerEvent('back'); },
    onAction() { this.triggerEvent('action'); },
  },
});
