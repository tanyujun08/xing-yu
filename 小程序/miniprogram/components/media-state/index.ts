import type { MediaDensity, MediaState } from '../../shared/model/media';
import { normalizeMediaDensity, normalizeMediaState } from '../../shared/presentation/media-state';

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    state: { type: String, value: 'idle', observer() { this.syncView(); } },
    src: { type: String, value: '', observer() { this.syncView(); } },
    mode: { type: String, value: 'aspectFill' },
    density: { type: String, value: 'card', observer() { this.syncView(); } },
    alt: { type: String, value: '', observer() { this.syncView(); } },
    errorText: { type: String, value: '', observer() { this.syncView(); } },
    // Compatibility-only aliases for 1.0.0.13 consumers.
    placeholderSrc: { type: String, value: '' },
    emptyLabel: { type: String, value: '暂无图片' },
    failureLabel: { type: String, value: '', observer() { this.syncView(); } },
    retryLabel: { type: String, value: '重试' },
    ariaLabel: { type: String, value: '', observer() { this.syncView(); } },
  },
  data: {
    renderState: 'idle' as MediaState,
    renderDensity: 'card' as MediaDensity,
    resolvedAlt: '图片',
    resolvedErrorText: '图片暂时无法加载',
  },
  lifetimes: {
    attached() { this.syncView(); },
  },
  methods: {
    syncView() {
      const source = String(this.data.src ?? '');
      const renderState = normalizeMediaState(String(this.data.state ?? 'idle'), source);
      const renderDensity = normalizeMediaDensity(String(this.data.density ?? 'card'));
      const alt = String(this.data.alt ?? '').trim() || String(this.data.ariaLabel ?? '').trim() || '图片';
      const errorText = String(this.data.errorText ?? '').trim() || String(this.data.failureLabel ?? '').trim() || '图片暂时无法加载';
      this.setData({ renderState, renderDensity, resolvedAlt: alt, resolvedErrorText: errorText });
    },
    onLoad() {
      this.setData({ renderState: 'ready' });
      this.triggerEvent('load');
    },
    onError() {
      this.setData({ renderState: 'error' });
      this.triggerEvent('error');
    },
    retry() {
      const source = String(this.data.src ?? '').trim();
      this.setData({ renderState: source ? 'loading' : 'idle' });
      this.triggerEvent('retry');
    },
  },
});
