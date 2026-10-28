import { designAssets } from '../design/assets';

const references: Record<string, string> = {
  'sony-a7c': designAssets.homeSonyA7C,
  'sony-a7c-personal': designAssets.homeSonyA7C,
  'canon-eos-r8-cabinet': designAssets.homeCanonEOSR8,
  'fujifilm-x100-cabinet': designAssets.discoveryReferenceFuji,
  'sigma-24-70-store': designAssets.discoveryReferenceSigma,
  'nikon-zf-store': designAssets.discoveryReferenceNikon,
  'cab-xuhui-ricoh-gr3x': designAssets.discoveryReferenceRicoh,
  'cab-xuhui-panasonic-s5ii': designAssets.discoveryReferencePanasonic,
  'cab-xuhui-om5': designAssets.discoveryReferenceOlympus,
  'cab-xuhui-gopro13': designAssets.discoveryReferenceGopro,
};
const referencePaths = new Set(Object.values(references));

export function supplyMedia(device: { id: string; image?: string }): { src: string; kind: 'real' | 'reference' | 'empty' } {
  const src = (device.image ?? '').trim();
  if (src && src !== designAssets.deviceMark) return { src, kind: referencePaths.has(src) ? 'reference' : 'real' };
  const reference = references[device.id];
  return reference ? { src: reference, kind: 'reference' } : { src: '', kind: 'empty' };
}

export function storeListMedia(id: string): string {
  const images: Record<string, string> = {
    'store-xuhui-service': designAssets.storeList1,
    'store-xuhui-center': designAssets.storeList2,
    'store-jingan-image': designAssets.storeList1,
'store-xuhui-west': designAssets.storeList2,
'store-jingan-camera': designAssets.storeList1,
'store-pudong-photo': designAssets.storeList2,
  };
  return images[id] ?? '';
}
