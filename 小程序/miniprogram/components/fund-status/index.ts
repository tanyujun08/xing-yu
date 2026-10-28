export {};

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    state: { type: String, value: 'processing' },
    label: { type: String, value: '提现处理中' },
  },
});
