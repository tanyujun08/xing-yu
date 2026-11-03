// 自动量页面：用微信开发者工具官方自动化接口打开页面，量每个 class 的位置/尺寸/字号并截图。
// 用法（在“小程序”目录下）：node scripts/auto-measure.mjs [页面名 ...]
// 前提：开发者工具里已开启 设置 → 安全设置 → 服务端口。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import automator from 'miniprogram-automator';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'measure-out');
const cliPath = process.env.WX_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';

// 页面名 → 打开方式。参数用演示数据里固定存在的 id。
const routes = {
  home: { open: 'reLaunch', url: '/pages/home/index' },
  orders: { open: 'switchTab', url: '/pages/orders/index' },
  profile: { open: 'switchTab', url: '/pages/profile/index' },
  detail: { open: 'navigateTo', url: '/pages/detail/index?id=asset-1', dir: 'detail' },
  'cabinet-detail': { open: 'navigateTo', url: '/pages/cabinet-detail/index?id=cabinet-1' },
  'cabinet-code': { open: 'navigateTo', url: '/pages/cabinet-code/index?scene=cab_demo1234567890123456' },
  'store-detail': { open: 'navigateTo', url: '/pages/store-detail/index?id=store-1' },
  confirm: { open: 'navigateTo', url: '/pages/confirm/index?deviceId=asset-1' },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(routes);
fs.mkdirSync(outDir, { recursive: true });

function classesOf(name) {
  const dir = routes[name].dir || name;
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages', dir, 'index.wxml'), 'utf8');
  const set = new Set();
  for (const m of wxml.matchAll(/class="([^"]*)"/g)) {
    const text = m[1].replace(/\{\{[^}]*\}\}/g, ' ');
    for (const token of text.split(/\s+/)) if (/^[a-zA-Z][\w-]*$/.test(token) && !token.startsWith('xy-')) set.add(token);
  }
  return [...set];
}

process.on('uncaughtException', (error) => console.log('忽略自动化接口的内部报错：', error.message));
const mp = await automator.launch({ cliPath, projectPath: root });
mp.on('exception', (e) => console.log('页面异常：', (e && e.message || '').slice(0, 300)));
mp.on('console', (e) => { if (e.type === 'error' || e.type === 'warn') console.log('控制台', e.type, JSON.stringify(e.args).slice(0, 300)); });
const result = {};
try {
  for (const name of names) {
    const route = routes[name];
    if (!route) { console.log('未知页面', name); continue; }
    console.log('打开', name);
    await mp.evaluate((how, url) => { globalThis.__nav = ''; wx[how]({ url, success: () => { globalThis.__nav = 'ok'; }, fail: (e) => { globalThis.__nav = 'fail:' + (e && e.errMsg); } }); return 1; }, route.open, route.url);
    console.log('已发出跳转');
    const want = route.url.split('?')[0].slice(1);
    let page;
    for (let i = 0; i < 60; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (i > 0 && i % 8 === 0 && !(page && page.path === want)) await mp.evaluate((how, url) => { wx[how]({ url }); return 1; }, route.open, route.url);
      try { page = await mp.currentPage(); } catch { page = undefined; }
      if (page && page.path === want) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
    console.log('当前页', page && page.path, '跳转结果', await mp.evaluate(() => (globalThis.__nav || '') + ' 页面栈=' + getCurrentPages().map((x) => x.route).join(',') + ' 存储=' + wx.getStorageInfoSync().keys.join(',').slice(0, 300)));
    await page.waitFor(1000);
    const classes = classesOf(name);
    console.log('class 数', classes.length);
    const rows = {};
    for (const c of classes) {
      let els = [];
      try { els = await page.$$('.' + c); } catch { continue; }
      if (!els.length) continue;
      rows[c] = [];
      for (const el of els.slice(0, 6)) {
        try {
          const [size, offset, fs, lh, fw, color, bg] = await Promise.all([el.size(), el.offset(), el.style('font-size'), el.style('line-height'), el.style('font-weight'), el.style('color'), el.style('background-color')]);
          rows[c].push([Math.round(offset.left), Math.round(offset.top), Math.round(size.width), Math.round(size.height), `${fs}/${lh}/${fw}`, color, bg].join('|'));
        } catch { /* 个别元素读不到就跳过 */ }
      }
    }
    console.log('量完', Object.keys(rows).length);
    result[name] = rows;
    let bottom = 0;
    for (const list of Object.values(rows)) for (const row of list) { const p = row.split('|'); bottom = Math.max(bottom, Number(p[1]) + Number(p[3])); }
    // 分屏截图：每 600px 一张
    for (let y = 0, i = 0; y < Math.max(bottom - 400, 1) && i < 8; y += 600, i += 1) {
      await mp.pageScrollTo(y);
      await page.waitFor(500);
      await mp.screenshot({ path: path.join(outDir, `${name}-${i}.png`) });
    }
    await mp.pageScrollTo(99999);
    await page.waitFor(600);
    await mp.screenshot({ path: path.join(outDir, `${name}-end.png`) });
    await mp.pageScrollTo(0);
    console.log('完成', name, Object.keys(rows).length, '个 class');
  }
} finally {
  fs.writeFileSync(path.join(outDir, 'sim.json'), JSON.stringify(result, null, 1));
  await mp.disconnect();
}
console.log('结果已写入', outDir);
