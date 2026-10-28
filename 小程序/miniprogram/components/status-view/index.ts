import { createBusyVisibility, type BusyVisibility } from '../../shared/interaction/busy-visibility';

type StatusState = 'loading' | 'empty' | 'error' | 'end';
type StatusDensity = 'page' | 'compact-footer';

interface StatusBusyRuntime {
  visibility: BusyVisibility;
  end: (() => void) | null;
}

interface StatusComponentRuntimeHost {
  setData(patch: { spinnerVisible: boolean }): void;
}

const statusBusyRuntimeByComponent = new WeakMap<object, StatusBusyRuntime>();

function statusBusyRuntime(component: object & StatusComponentRuntimeHost): StatusBusyRuntime {
  const current = statusBusyRuntimeByComponent.get(component);
  if (current) return current;
  const created: StatusBusyRuntime = {
    end: null,
    visibility: createBusyVisibility((spinnerVisible) => component.setData({ spinnerVisible })),
  };
  statusBusyRuntimeByComponent.set(component, created);
  return created;
}

const defaultLabels: Record<StatusState, string> = {
  loading: '正在加载',
  empty: '暂无内容',
  error: '加载失败',
  end: '没有更多内容',
};

function normalizeState(value: string): StatusState {
  return value === 'loading' || value === 'error' || value === 'end' ? value : 'empty';
}

function normalizeDensity(value: string): StatusDensity {
  return value === 'compact-footer' ? value : 'page';
}

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    state: { type: String, value: 'empty', observer() { this.syncView(); } },
    density: { type: String, value: 'page', observer() { this.syncView(); } },
    title: { type: String, value: '', observer() { this.syncView(); } },
    description: { type: String, value: '' },
    actionText: { type: String, value: '' },
    busy: { type: Boolean, value: false },
    illustrationSrc: { type: String, value: '', observer() { this.setData({ illustrationFailed: false }); } },
  },
  data: {
    renderState: 'empty' as StatusState,
    renderDensity: 'page' as StatusDensity,
    accessibleLabel: defaultLabels.empty,
    spinnerVisible: false,
    illustrationFailed: false,
  },
  lifetimes: {
    attached() { this.syncView(); },
    detached() {
      const runtime = statusBusyRuntimeByComponent.get(this);
      runtime?.end?.();
      runtime?.visibility.dispose();
      statusBusyRuntimeByComponent.delete(this);
    },
  },
  methods: {
    onIllustrationError(event: WechatMiniprogram.CustomEvent) {
      if (event.currentTarget.dataset['src'] === this.data.illustrationSrc) this.setData({ illustrationFailed: true });
    },
    syncView() {
      const renderState = normalizeState(String(this.data.state ?? 'empty'));
      const renderDensity = renderState === 'end' ? 'compact-footer' : normalizeDensity(String(this.data.density ?? 'page'));
      const title = String(this.data.title ?? '').trim();
      this.setData({ renderState, renderDensity, accessibleLabel: title || defaultLabels[renderState] });
      const runtime = statusBusyRuntime(this);
      if (renderState === 'loading' && !runtime.end) runtime.end = runtime.visibility.begin();
      if (renderState !== 'loading' && runtime.end) {
        runtime.end();
        runtime.end = null;
      }
    },
    onAction() {
      if (this.data.busy) return;
      this.triggerEvent('action');
    },
  },
});
