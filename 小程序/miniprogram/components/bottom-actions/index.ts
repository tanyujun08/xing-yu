interface BusyTimers {
  show: ReturnType<typeof setTimeout> | undefined;
  hide: ReturnType<typeof setTimeout> | undefined;
  shownAt: number;
}

const busyTimers = new WeakMap<object, BusyTimers>();

function timersFor(instance: object): BusyTimers {
  const existing = busyTimers.get(instance);
  if (existing) return existing;
  const timers: BusyTimers = { show: undefined, hide: undefined, shownAt: 0 };
  busyTimers.set(instance, timers);
  return timers;
}

Component({
  options: { multipleSlots: true, styleIsolation: 'isolated' },
  properties: {
    primaryText: { type: String, value: '' },
    secondaryText: { type: String, value: '' },
    busyText: { type: String, value: '处理中…' },
    busy: { type: Boolean, value: false, observer() { this.syncBusy(); } },
    disabled: { type: Boolean, value: false },
    secondaryDisabled: { type: Boolean, value: false },
    primaryTone: { type: String, value: 'primary' },
    layout: { type: String, value: 'equal' },
  },
  data: { showSpinner: false },
  lifetimes: {
    attached() { this.syncBusy(); },
    detached() { this.clearBusyTimers(); },
  },
  methods: {
    syncBusy() {
      const timers = timersFor(this);
      if (timers.show !== undefined) clearTimeout(timers.show);
      if (timers.hide !== undefined) clearTimeout(timers.hide);
      timers.show = undefined;
      timers.hide = undefined;
      if (this.data.busy) {
        if (this.data.showSpinner) return;
        timers.show = setTimeout(() => {
          timers.show = undefined;
          if (!this.data.busy) return;
          timers.shownAt = Date.now();
          this.setData({ showSpinner: true });
        }, 100);
        return;
      }
      if (!this.data.showSpinner) return;
      const remaining = Math.max(0, 200 - (Date.now() - timers.shownAt));
      timers.hide = setTimeout(() => {
        timers.hide = undefined;
        if (!this.data.busy) this.setData({ showSpinner: false });
      }, remaining);
    },
    clearBusyTimers() {
      const timers = busyTimers.get(this);
      if (!timers) return;
      if (timers.show !== undefined) clearTimeout(timers.show);
      if (timers.hide !== undefined) clearTimeout(timers.hide);
      busyTimers.delete(this);
    },
    onPrimary() {
      if (this.data.busy || this.data.disabled) return;
      this.triggerEvent('primary');
    },
    onSecondary() {
      if (this.data.busy || this.data.secondaryDisabled) return;
      this.triggerEvent('secondary');
    },
  },
});
