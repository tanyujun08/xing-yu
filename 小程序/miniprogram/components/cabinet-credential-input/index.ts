interface CredentialSlot {
  id: string;
  value: string;
  filled: boolean;
  active: boolean;
}

function normalize(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').substring(0, 6);
}

function slotsFor(value: string): CredentialSlot[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `digit-${index + 1}`,
    value: value[index] ?? '',
    filled: index < value.length,
    active: index === Math.min(value.length, 5),
  }));
}

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    label: { type: String, value: '取件码' },
    displayCode: { type: String, value: '' },
    showDisplayCode: { type: Boolean, value: true },
    value: { type: String, value: '', observer(value: string) { this.syncValue(value); } },
    error: { type: String, value: '' },
    focus: { type: Boolean, value: false },
  },
  data: { inputValue: '', slots: slotsFor('') },
  lifetimes: {
    attached() { this.syncValue(this.data.value); },
  },
  methods: {
    syncValue(value: string) {
      const inputValue = normalize(value);
      this.setData({ inputValue, slots: slotsFor(inputValue) });
    },
    onInput(event: WechatMiniprogram.Input) {
      const value = normalize(event.detail.value);
      this.setData({ inputValue: value, slots: slotsFor(value) });
      this.triggerEvent('input', { value });
    },
  },
});
