import { designAssets } from '../../shared/design/assets';
import type { ReturnEvidenceTile } from '../../shared/presentation/return-evidence';
Component({
  options: { styleIsolation: 'isolated' },
  properties: { focusKey: { type: String, value: '' }, tiles: { type: Array, value: [] as ReturnEvidenceTile[] }, busy: { type: Boolean, value: false }, readOnly: { type: Boolean, value: false }, single: { type: Boolean, value: false }, albumOnly: { type: Boolean, value: false } },
  data: { icons: designAssets },
  methods: {
    select(event: WechatMiniprogram.TouchEvent) { if (!this.data.busy && !this.data.readOnly) this.triggerEvent('select', { key: event.currentTarget.dataset['key'] }); },
    preview(event: WechatMiniprogram.TouchEvent) { this.triggerEvent('preview', { key: event.currentTarget.dataset['key'] }); },
    example(event: WechatMiniprogram.TouchEvent) { if (!this.data.readOnly) this.triggerEvent('example', { key: event.currentTarget.dataset['key'] }); },
    recover(event: WechatMiniprogram.TouchEvent) { if (!this.data.busy && !this.data.readOnly) this.triggerEvent('recover', { key: event.currentTarget.dataset['key'] }); },
  },
});
