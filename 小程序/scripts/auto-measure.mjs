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
  // 第 1 批「我的」子页
  'profile-edit': { open: 'navigateTo', url: '/pages/profile-edit/index' },
  'account-security': { open: 'navigateTo', url: '/pages/account-security/index' },
  about: { open: 'navigateTo', url: '/pages/about/index' },
  addresses: { open: 'navigateTo', url: '/pages/addresses/index' },
  'address-edit': { open: 'navigateTo', url: '/pages/address-edit/index' },
  coupons: { open: 'navigateTo', url: '/pages/coupons/index' },
  'coupon-detail': { open: 'navigateTo', url: '/pages/coupon-detail/index?coupon_id=coupon-1' },
  wallet: { open: 'reLaunch', url: '/pages/wallet/index' },
  // call：页面打开后再调用页面方法（如打开弹窗）再截图
  'wallet-withdraw': { open: 'reLaunch', url: '/pages/wallet/index', dir: 'wallet', call: 'openWithdrawal' },
  // set：页面打开后直接改页面数据，用来看空状态 / 失败 / 未登录
  'wallet-empty': { open: 'reLaunch', url: '/pages/wallet/index', dir: 'wallet', set: { loading: false, items: [], hasMore: false, errorText: '' } },
  'wallet-error': { open: 'reLaunch', url: '/pages/wallet/index', dir: 'wallet', set: { loading: false, errorText: '网络异常，收益读取失败' } },
  'wallet-withdraw-done': { open: 'reLaunch', url: '/pages/wallet/index', dir: 'wallet', set: { withdrawOpen: true, wDone: true, wDoneAmount: '¥500.00' } },
  'wallet-guest': { open: 'reLaunch', url: '/pages/wallet/index', dir: 'wallet', set: { guest: true, loading: false, items: [], hasMore: false, booked: '—', estimated: '—', estimatedCount: 0, errorText: '请重新登录后查看本人租赁收益' } },
  withdrawal: { open: 'navigateTo', url: '/pages/withdrawal/index' },
  identity: { open: 'navigateTo', url: '/pages/identity/index' },
  'wechat-waiver': { open: 'navigateTo', url: '/pages/wechat-waiver/index' },
  'no-deposit': { open: 'navigateTo', url: '/pages/no-deposit/index' },
  login: { open: 'navigateTo', url: '/pages/login/index' },
  region: { open: 'navigateTo', url: '/pages/region/index' },
  // 第 2 批 订单流程
  contract: { open: 'navigateTo', url: '/pages/contract/index?orderId=order-1' },
  'contract-sign': { open: 'navigateTo', url: '/pages/contract-sign/index?orderId=order-1' },
  'order-detail': { open: 'navigateTo', url: '/pages/order-detail/index?orderId=order-4' },
  'order-detail-pay': { open: 'navigateTo', url: '/pages/order-detail/index?orderId=order-2', dir: 'order-detail' },
  'order-detail-return': { open: 'navigateTo', url: '/pages/order-detail/index?orderId=order-5', dir: 'order-detail' },
  'order-detail-supplement': { open: 'navigateTo', url: '/pages/order-detail/index?orderId=order-7', dir: 'order-detail' },
  'order-detail-done': { open: 'navigateTo', url: '/pages/order-detail/index?orderId=order-9', dir: 'order-detail' },
  'order-fees': { open: 'navigateTo', url: '/pages/order-fees/index?orderId=order-7' },
  'service-detail': { open: 'navigateTo', url: '/pages/service-detail/index?mode=preview&service=guard' },
  'device-orders': { open: 'navigateTo', url: '/pages/device-orders/index?mode=rent' },
  'cabinet-open': { open: 'navigateTo', url: '/pages/cabinet-open/index?taskId=task-demo' },
  'return-submit': { open: 'navigateTo', url: '/pages/return-submit/index?orderId=order-5' },
  'cabinet-return': { open: 'navigateTo', url: '/pages/cabinet-return/index?orderId=order-4' },
  dispute: { open: 'navigateTo', url: '/pages/dispute/index?orderId=order-6' },
  // 手写签名：旧上传卡住后可重新签写的状态
  'contract-sign-restart': { open: 'navigateTo', url: '/pages/contract-sign/index?orderId=order-1', dir: 'contract-sign', set: { loading: false, ready: false, hasDraft: true, rejected: false, canRestart: true, name: '林沐 · 演示', progressText: '', errorText: '签名图片上传没有成功，请重新签写' } },
  'contract-sign-ready': { open: 'navigateTo', url: '/pages/contract-sign/index?orderId=order-1', dir: 'contract-sign', set: { loading: false, ready: true, hasDraft: false, name: '林沐 · 演示', progressText: '', errorText: '' } },
  'contract-sign-draft': { open: 'navigateTo', url: '/pages/contract-sign/index?orderId=order-1', dir: 'contract-sign', set: { loading: false, ready: false, hasDraft: true, rejected: false, canRestart: false, name: '林沐 · 演示', progressText: '', errorText: '' } },
  // 第 3 批 发现与消息
  info: { open: 'switchTab', url: '/pages/info/index' },
  'order-messages': { open: 'navigateTo', url: '/pages/order-messages/index' },
  'order-messages-filled': { open: 'navigateTo', url: '/pages/order-messages/index', dir: 'order-messages', set: { loggedIn: true, messages: [{ id: 'm1', orderId: 'order-1', title: '订单已支付', deviceName: '大疆 Pocket 3', statusText: '待取件', content: '取件码 123456，请在 10-27 前到柜取件。', timeText: '10-26 19:58' }, { id: 'm2', orderId: 'order-2', title: '归还审核通过', deviceName: '索尼 A7M4', statusText: '退押处理中', content: '押金将在 1 个工作日内原路退回。', timeText: '10-25 14:20' }] } },
  'private-messages': { open: 'navigateTo', url: '/pages/private-messages/index' },
  'info-guide': { open: 'navigateTo', url: '/pages/info-guide/index' },
  'info-guide-flow': { open: 'navigateTo', url: '/pages/info-guide/index?id=rental-flow', dir: 'info-guide' },
  'info-guide-legal': { open: 'navigateTo', url: '/pages/info-guide/index?id=user-agreement', dir: 'info-guide' },
  chat: { open: 'navigateTo', url: '/pages/chat/index?mode=c2c&orderId=order-4' },
  'chat-support': { open: 'navigateTo', url: '/pages/chat/index?mode=support', dir: 'chat' },
  cabinets: { open: 'navigateTo', url: '/pages/cabinets/index' },
  'cabinets-return': { open: 'navigateTo', url: '/pages/cabinets/index?mode=return&orderId=order-4', dir: 'cabinets' },
  stores: { open: 'navigateTo', url: '/pages/stores/index' },
  'check-in': { open: 'navigateTo', url: '/pages/check-in/index' },
};
// 订单详情的 10 个演示状态：od-1（准备签约）… od-10（已关闭）
for (let n = 1; n <= 10; n += 1) routes['od-' + n] = { open: 'navigateTo', url: '/pages/order-detail/index?orderId=order-' + n, dir: 'order-detail' };

// 参数里可带 --shots（只截图不量尺寸，快）和 --prefix=before（截图文件名前缀，用于改前/改后对照）
const args = process.argv.slice(2);
const shotsOnly = args.includes('--shots');
const prefixArg = args.find((a) => a.startsWith('--prefix='));
const prefix = prefixArg ? prefixArg.slice('--prefix='.length) + '-' : '';
const pageArgs = args.filter((a) => !a.startsWith('--'));
const names = pageArgs.length ? pageArgs : Object.keys(routes);
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
// 先连已经开着的开发者工具（端口 9420），连不上才启动一次；之后每次截图都复用同一个窗口，不再重开、重编译
const port = Number(process.env.WX_AUTO_PORT || 9420);
let mp;
try { mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }); console.log('复用已打开的开发者工具'); }
catch { mp = await automator.launch({ cliPath, projectPath: root, port }); console.log('首次启动开发者工具（端口', port, '）'); }
// 连上了但不响应（比如重新打开过项目），就重新开启自动化端口再连
const ping = (ms) => Promise.race([mp.currentPage().then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), ms))]);
let alive = await ping(30000);
// 不响应时先重连同一端口（避免“端口被占用”），仍不行再换端口重新开启自动化
for (let i = 0; !alive && i < 3; i++) {
  console.log('开发者工具不响应，第', i + 1, '次重连');
  try { mp.disconnect(); } catch {}
  try { mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }); alive = await ping(30000); } catch {}
}
if (!alive) { console.log('改用端口', port + 1, '重新开启自动化'); try { mp.disconnect(); } catch {} mp = await automator.launch({ cliPath, projectPath: root, port: port + 1 }); alive = await ping(60000); console.log(alive ? '已重新连接' : '仍未响应'); }
mp.on('exception', (e) => console.log('页面异常：', (e && e.message || '').slice(0, 300)));
mp.on('console', (e) => { if (e.type === 'error' || e.type === 'warn') console.log('控制台', e.type, JSON.stringify(e.args).slice(0, 300)); });
const result = {};
try {
  for (const name of names) {
    const route = routes[name];
    if (!route) { console.log('未知页面', name); continue; }
    console.log('打开', name);
    // 页面栈最多 10 层：快满时先回到首页再打开，避免 navigateTo 失败
    await mp.evaluate((how, url) => { globalThis.__nav = ''; const go = () => wx[how]({ url, success: () => { globalThis.__nav = 'ok'; }, fail: (e) => { globalThis.__nav = 'fail:' + (e && e.errMsg); } }); if (how === 'navigateTo' && getCurrentPages().length >= 8) wx.reLaunch({ url: '/pages/home/index', success: () => setTimeout(go, 600) }); else go(); return 1; }, route.open, route.url);
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
    if (route.set) { await page.waitFor(2500); try { await mp.evaluate((d) => { const ps = getCurrentPages(); ps[ps.length - 1].setData(d); }, route.set); console.log('改数据', Object.keys(route.set).join(',')); } catch (e) { console.log('改数据失败', e && e.message); } await page.waitFor(800); }
    if (route.call) { try { const r = await mp.evaluate((m) => { const ps = getCurrentPages(); const top = ps[ps.length - 1]; if (typeof top[m] !== 'function') return 'no-method:' + Object.keys(top).filter((k) => typeof top[k] === 'function').slice(0, 40).join(','); top[m](); return 'ok'; }, route.call); console.log('调用', route.call, r); } catch (e) { console.log('调用失败', route.call, e && e.message); } await page.waitFor(1500); }
    const classes = shotsOnly ? [] : classesOf(name);
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
    if (shotsOnly) { try { const s = await page.size(); bottom = s.height; } catch { bottom = 1400; } }
    // 完整长图：先读页面总高，每次下滚 300px 截一张并记下实际滚动位置；之后按位置拼成一张长图
    const shots = []; let win = {};
    try { win = await mp.evaluate(() => { const w = wx.getWindowInfo(); return { width: w.windowWidth, height: w.windowHeight }; }); } catch { /* 取不到就不写 */ }
    const offset = () => Promise.race([
      mp.evaluate(() => new Promise((resolve) => { wx.createSelectorQuery().selectViewport().scrollOffset((r) => resolve(r ? { top: r.scrollTop, height: r.scrollHeight } : null)).exec(); })),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]).catch(() => null);
    for (let i = 0, last = -1; i < 30; i += 1) {
      await mp.pageScrollTo(i * 300);
      await page.waitFor(450);
      const at = await offset();
      const top = at ? Math.round(at.top) : Math.max(last, 0);
      if (top === last) break;
      const file = `${prefix}${name}-s${i}.png`;
      await mp.screenshot({ path: path.join(outDir, file) });
      shots.push({ file, top, pageHeight: at ? Math.round(at.height) : null }); last = top;
    }
    fs.writeFileSync(path.join(outDir, `${prefix}${name}.shots.json`), JSON.stringify({ name, window: win, shots }));
    console.log('截图', name, shots.length, '张，滚动到', shots.length ? shots[shots.length - 1].top : 0, '页面总高', shots.length ? shots[0].pageHeight : '?');
    await mp.pageScrollTo(0);
    console.log('完成', name, Object.keys(rows).length, '个 class');
  }
} finally {
  if (!shotsOnly) fs.writeFileSync(path.join(outDir, 'sim.json'), JSON.stringify(result, null, 1));
  await mp.disconnect();
}
console.log('结果已写入', outDir);
