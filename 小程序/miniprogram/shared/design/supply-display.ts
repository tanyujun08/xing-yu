type DisplayFields = {rentalMode?:string;hourlyRateFen?:number;pricePerDay:number;deposit:number;tags:string[]};

export type SupplyDeviceView<T extends DisplayFields = DisplayFields> = T & {
  displayImage: string;
  priceSymbol: '¥';
  priceValue: string;
  priceUnit: string;
  depositValue: string;
  priceLabel: string;
  depositLabel: string;
  priceLine: string;
  displayTags: string[];
};

function formatFen(fen: number): string {
  const yuan = fen / 100;
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function devicePriceLabel(device: DisplayFields): string {
  if (device.rentalMode === 'hourly' && typeof device.hourlyRateFen === 'number') return `¥${formatFen(device.hourlyRateFen)}/小时`;
  return `¥${device.pricePerDay}/天`;
}

function devicePriceParts(device: DisplayFields): { value: string; unit: string } {
  if (device.rentalMode === 'hourly' && typeof device.hourlyRateFen === 'number') {
    return { value: formatFen(device.hourlyRateFen), unit: '/小时' };
  }
  return { value: String(device.pricePerDay), unit: '/天' };
}

export function deviceDepositLabel(device: DisplayFields): string {
  return `押金¥${device.deposit}`;
}

export function devicePriceLine(device: DisplayFields): string {
  return `${devicePriceLabel(device)} · ${deviceDepositLabel(device)}`;
}

export function deviceView<T extends DisplayFields>(device: T, displayImage: string): SupplyDeviceView<T> {
  const price = devicePriceParts(device);
  return {
    ...device,
    displayImage,
    priceSymbol: '¥',
    priceValue: price.value,
    priceUnit: price.unit,
    depositValue: String(device.deposit),
    priceLabel: devicePriceLabel(device),
    depositLabel: deviceDepositLabel(device),
    priceLine: devicePriceLine(device),
    // Keep discovery rows scannable: tags are supporting metadata, not a
    // second title. The shared product pattern exposes at most two.
    displayTags: device.tags.slice(0, 2),
  };
}

export function deviceViews<T extends DisplayFields>(devices: T[], displayImage: string): SupplyDeviceView<T>[] {
  return devices.map((device) => deviceView(device, displayImage));
}
