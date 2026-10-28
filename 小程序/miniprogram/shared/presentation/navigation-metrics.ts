export interface WindowMetricsInput {
  statusBarHeight?: number | null;
}

export interface CapsuleMetricsInput {
  top?: number | null;
  height?: number | null;
  bottom?: number | null;
}

export interface NavigationMetrics {
  statusBarHeight: number;
  contentHeight: number;
  totalHeight: number;
}

function nonNegative(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function calculateNavigationMetrics(
  windowInfo: WindowMetricsInput,
  capsule: CapsuleMetricsInput,
  minimumContentHeight = 44,
): NavigationMetrics {
  const statusBarHeight = nonNegative(windowInfo.statusBarHeight);
  const capsuleTop = nonNegative(capsule.top);
  const capsuleHeight = nonNegative(capsule.height);
  const capsuleBottom = nonNegative(capsule.bottom);
  const capsuleValid = capsuleHeight > 0 && capsuleBottom > capsuleTop;
  const minimum = Math.max(44, nonNegative(minimumContentHeight));
  const contentHeight = capsuleValid
    ? Math.max(minimum, capsuleHeight + (2 * Math.max(0, capsuleTop - statusBarHeight)))
    : minimum;
  return { statusBarHeight, contentHeight, totalHeight: statusBarHeight + contentHeight };
}

export function readNavigationMetrics(minimumContentHeight = 44): NavigationMetrics {
  return calculateNavigationMetrics(
    wx.getWindowInfo(),
    wx.getMenuButtonBoundingClientRect(),
    minimumContentHeight,
  );
}
