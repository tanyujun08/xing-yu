import { addressRegions, type AddressRegionNode } from '../model/address-regions';
export function formatRegion(path: AddressRegionNode[]): string {
  return path.filter((node, index) => !['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划'].includes(node.name) && node.name !== path[index - 1]?.name).map((node) => node.name).join('');
}
export function findRegionPath(region: string): AddressRegionNode[] {
  function visit(nodes: AddressRegionNode[], path: AddressRegionNode[]): AddressRegionNode[] {
    for (const node of nodes) {
      const next = [...path, node];
      if (!node.children?.length && formatRegion(next) === region) return next;
      const found = node.children ? visit(node.children, next) : [];
      if (found.length) return found;
    }
    return [];
  }
  return visit(addressRegions, []);
}
export function regionOptions(path: AddressRegionNode[], level: number): AddressRegionNode[] {
  return level === 0 ? addressRegions : path[level - 1]?.children ?? [];
}
export function regionTabs(path: AddressRegionNode[], level: number) {
  const count = Math.min(3, path.length + (path[path.length - 1]?.children?.length || !path.length ? 1 : 0));
  return Array.from({ length: count }, (_, index) => ({ level: index, name: path[index]?.name ?? '请选择', active: index === level }));
}
