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
  orders: { open: 'reLaunch', url: '/pages/orders/index' },
  profile: { open: 'reLaunch', url: '/pages/profile/index' },
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

const mp = await automator.launch({ cliPath, projectPath: root });
const result = {};
try {
  for (const name of names) {
    const route = routes[name];
    if (!route) { console.log('未知页面', name); continue; }
    await mp[route.open](route.url);
    const page = await mp.currentPage();
    await page.waitFor(2500);
    const classes = classesOf(name);
    const rows = await mp.evaluate((cls) => new Promise((resolve) => {
      const pg = getCurrentPages().slice(-1)[0];
      const q = wx.createSelectorQuery().in(pg);
      cls.forEach((c) => q.selectAll('.' + c).fields({ rect: true, size: true, computedStyle: ['font-size', 'line-height', 'font-weight', 'color', 'background-color'] }));
      q.selectViewport().scrollOffset();
      q.exec((r) => {
        const top = r[cls.length].scrollTop || 0;
        const o = {};
        cls.forEach((c, i) => {
          if (!r[i] || !r[i].length) return;
          o[c] = r[i].slice(0, 6).map((e) => [Math.round(e.left), Math.round(e.top + top), Math.round(e.width), Math.round(e.height), e['font-size'] + '/' + e['line-height'] + '/' + e['font-weight'], e.color, e['background-color']].join('|'));
        });
        resolve(o);
      });
    }), classes);
    result[name] = rows;
    let bottom = 0;
    for (const list of Object.values(rows)) for (const row of list) { const p = row.split('|'); bottom = Math.max(bottom, Number(p[1]) + Number(p[3])); }
    // 分屏截图：每 600px 一张
    for (let y = 0, i = 0; y < Math.max(bottom - 400, 1) && i < 8; y += 600, i += 1) {
      await mp.pageScrollTo(y);
      await page.waitFor(500);
      await mp.screenshot({ path: path.join(outDir, `${name}-${i}.png`) });
    }
    await mp.pageScrollTo(0);
    console.log('完成', name, Object.keys(rows).length, '个 class');
  }
} finally {
  fs.writeFileSync(path.join(outDir, 'sim.json'), JSON.stringify(result, null, 1));
  await mp.disconnect();
}
console.log('结果已写入', outDir);
