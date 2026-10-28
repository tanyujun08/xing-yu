import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');

describe('M1 token and component contracts', () => {
  test('keeps one token authority with the system font stack and loading values', () => {
    const appStyle = source('miniprogram/app.wxss');
    expect(appStyle).toContain('--xy-font-family-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;');
    expect(appStyle).not.toMatch(/Alibaba PuHuiTi|Noto Sans SC|SF Pro/);
    expect(appStyle).toContain('--xy-text-page-title-size: calc(10px + .5rem);');
    expect(appStyle).toContain('--xy-loading-size-inline: 16px;');
    expect(appStyle).toContain('--xy-loading-size-page: 32px;');
    expect(appStyle).toContain('--xy-loading-stroke: 2px;');
    expect(appStyle).toContain('--xy-loading-duration: 800ms;');
    const primitives = source('miniprogram/shared/design/components.wxss');
    expect(primitives).toContain('@keyframes xy-loading-spin');
    expect(primitives).toContain('.xy-bottom-actions {');
    expect(primitives).toContain('.xy-button-reset {');
    expect(primitives).toContain('.xy-button-reset::after { border: 0; }');
  });

  test('uses isolated components and preserves the media compatibility boundary', () => {
    for (const component of ['status-view', 'media-state', 'page-shell', 'page-header', 'bottom-actions']) {
      expect(source(`miniprogram/components/${component}/index.ts`), component).toContain("styleIsolation: 'isolated'");
    }
    const media = source('miniprogram/components/media-state/index.ts');
    expect(media).toContain('placeholderSrc');
    expect(media).toContain('failureLabel');
    expect(media).toContain("this.triggerEvent('retry')");
    const mediaMarkup = source('miniprogram/components/media-state/index.wxml');
    expect(mediaMarkup).toContain("renderDensity !== 'thumbnail'");
    expect(mediaMarkup).toContain('aria-label="{{retryLabel}}"');
    expect(mediaMarkup).toContain('catchtap="retry"');
    expect(mediaMarkup).not.toContain('bindtap="retry"');
  });

  test('locks status, shell, header and action events to presentation-only contracts', () => {
    const status = source('miniprogram/components/status-view/index.ts');
    expect(status).toContain("this.triggerEvent('action')");
    expect(status).not.toContain("triggerEvent('retry')");
    expect(source('miniprogram/components/status-view/index.wxml')).toContain('aria-label="{{actionText}}"');
    const shell = source('miniprogram/components/page-shell/index.wxml');
    expect(shell).toContain('lower-threshold="120"');
    expect(shell.indexOf('page-shell__footer')).toBeGreaterThan(shell.indexOf('</scroll-view>'));
    const header = source('miniprogram/components/page-header/index.ts');
    expect(header).toContain("this.triggerEvent('back')");
    expect(header).not.toMatch(/navigateTo|navigateBack|switchTab/);
    const actions = source('miniprogram/components/bottom-actions/index.ts');
    expect(actions).toContain("this.triggerEvent('primary')");
    expect(actions).toContain("this.triggerEvent('secondary')");
    expect(actions).toContain('this.data.secondaryDisabled');
    expect(actions).toContain('}, 100);');
    expect(actions).toContain('200 - (Date.now() - timers.shownAt)');
    const actionMarkup = source('miniprogram/components/bottom-actions/index.wxml');
    expect(actionMarkup).toContain('aria-label="{{secondaryText}}"');
    expect(actionMarkup).toContain('disabled="{{busy || secondaryDisabled}}"');
    expect(actionMarkup).toContain('aria-label="{{busy ? busyText : primaryText}}"');
    for (const component of ['status-view', 'media-state', 'page-header', 'bottom-actions']) {
      const markup = source(`miniprogram/components/${component}/index.wxml`);
      const buttons = markup.match(/<button\b[^>]*>/gu) ?? [];
      expect(buttons.length, component).toBeGreaterThan(0);
      expect(buttons.every((button) => button.includes('xy-button-reset')), component).toBe(true);
    }
  });
});

test('thumbnail media retry remounts the unchanged source and emits only its presentation event',async()=>{
 type RetryView={data:{src:string;renderState:string;renderDensity:'thumbnail'};setData(patch:{renderState:string}):void;triggerEvent(name:string):void};
 let definition:{methods:{retry(this:RetryView):void}}|undefined;
 vi.stubGlobal('Component',(value:typeof definition)=>{definition=value});
 try{
  await import('../miniprogram/components/media-state/index');expect(definition).toBeDefined();const triggerEvent=vi.fn();
  const view:RetryView={data:{src:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/original-image',renderState:'error',renderDensity:'thumbnail'},setData(patch){Object.assign(this.data,patch)},triggerEvent};
  definition!.methods.retry.call(view);expect(view.data).toEqual({src:'https://xyuprj.oss-cn-hangzhou.aliyuncs.com/original-image',renderState:'loading',renderDensity:'thumbnail'});expect(triggerEvent).toHaveBeenCalledTimes(1);expect(triggerEvent).toHaveBeenCalledWith('retry');
 }finally{vi.unstubAllGlobals()}
});

test('thumbnail errors expose the existing 44px retry target without stacking card error content',()=>{
 const markup=source('miniprogram/components/media-state/index.wxml');
 const errorMark=markup.match(/<view[^>]*class="xy-media-state__error-mark"[^>]*>/u)?.[0];
 expect(errorMark).toContain('wx:if="{{renderDensity !== \'thumbnail\'}}"');
 expect(markup).toContain('<text wx:if="{{renderDensity !== \'thumbnail\'}}">{{resolvedErrorText}}</text>');
 const retry=markup.match(/<button[^>]*class="xy-media-state__retry[^>]*>/u)?.[0];
 expect(retry).toContain('wx:if="{{retryLabel}}"');expect(retry).toContain('catchtap="retry"');expect(retry).not.toContain("renderDensity !== 'thumbnail'");
 expect(retry).toContain("renderDensity === 'thumbnail' ? 'min-width:var(--xy-size-touch-min,44px);min-height:var(--xy-size-touch-min,44px);padding:0;margin-top:0;' : ''");
 expect(source('miniprogram/app.wxss')).toContain('--xy-size-touch-min: 44px;');
 const style=source('miniprogram/components/media-state/index.wxss');expect(style).toContain('.xy-media-state--thumbnail .xy-media-state__failure { padding: var(--xy-space-1, 4px); }');
 expect(source('miniprogram/shared/design/components.wxss')).toContain('min-height: var(--xy-control-height, 44px);');
 expect(source('miniprogram/pages/publish/index.wxml')).toContain('class="product-media-item" style="display:inline-flex;overflow:hidden" density="thumbnail" state="real" src="{{item.url}}"');
 // 44px button + two 4px inset edges fits the unchanged 72px slot; native layout still requires observation.
});
