import type { SupplyDeviceView } from '../design/supply-display';
import { supplyMedia } from './supply-media';
import { readDisplayWindowMetrics } from './window-metrics';

type DiscoveryDisplayFields = { id: string; image?: string; supplyType: string; description: string };

export function discoveryMedia<T extends SupplyDeviceView & DiscoveryDisplayFields>(devices: T[]) {
  const system = readDisplayWindowMetrics();
  return devices.map((device) => {
    const media = supplyMedia(device);
    const omitted = new Set(device.supplyType === 'cabinet' ? ['共享柜', '柜机设备'] : device.supplyType === 'store' ? ['门店', '门店设备'] : ['个人出租']);
    (device.rentalMode === 'hourly' ? ['小时租', '时租'] : ['天租', '日租']).forEach((word) => omitted.add(word));
    const displayTags = Array.from(new Set(device.tags.map((tag) => tag.trim()).filter((tag) => tag && !omitted.has(tag)))).slice(0, 2);
    const repeated = new Set<string>();
    if (device.rentalMode === 'daily' && device.supplyType === 'cabinet') ['共享柜天租', '柜机天租'].forEach((word) => repeated.add(word));
    if (device.rentalMode === 'daily' && device.supplyType === 'store') repeated.add('门店天租');
    if (displayTags.includes('面交')) repeated.add('门店面交');
    return { ...device, displayImage: media.src, mediaReference: media.kind === 'reference', displayTags,
      displayDescription: device.description.split('·').map((part) => part.trim()).filter((part) => part && !repeated.has(part)).join(' · '),
      compact: (system.fontSizeSetting || 16) > 20,
      longAmount: device.priceValue.length > 7 || device.depositValue.length > 9 || (system.fontSizeSetting || 16) > 24,
    };
  });
}
