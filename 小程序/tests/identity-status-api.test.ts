import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { identityInput } from '../miniprogram/shared/presentation/identity-input';
const api = vi.hoisted(() => ({ owner: 'mini-a' as string | null, identity: vi.fn(), saveIdentity: vi.fn(), newIntent: vi.fn(() => 'identity-original-key') }));
vi.mock('../miniprogram/shared/api/account-api', () => ({ accountApi: { sessionIdentity: () => api.owner, identity: api.identity, saveIdentity: api.saveIdentity, newIntent: api.newIntent } }));
interface Harness { data: Record<string, unknown>; setData(v: Record<string, unknown>): void; [key: string]: unknown }
let definition: Harness, page: Harness;
const verified = { overall_status: 'REAL_NAME_VERIFIED', real_name: { status: 'VERIFIED' }, face: { status: 'NOT_VERIFIED' } };
const unverified = { ...verified, overall_status: 'NOT_VERIFIED', real_name: { status: 'NOT_VERIFIED' } };
const handle = (v: unknown) => ({ promise: Promise.resolve(v), abort: vi.fn() });
function call(name: string, ...args: unknown[]) { return (page[name] as (...v: unknown[]) => unknown).apply(page, args); }
async function tick() { for (let n=0;n<12;n++) await Promise.resolve(); }
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); api.owner='mini-a';
  api.identity.mockReturnValue(handle(unverified)); api.saveIdentity.mockReturnValue(handle({ status:'VERIFIED', check_kind:'REAL_NAME' }));
  vi.stubGlobal('Page', (v: Harness) => definition=v);
  vi.stubGlobal('getCurrentPages', () => [{ route: 'pages/confirm/index' }, { route: 'pages/identity/index' }]);
  vi.stubGlobal('wx', { navigateTo:vi.fn(),navigateBack:vi.fn(),switchTab:vi.fn() });
  await import('../miniprogram/pages/identity/index');
  page={...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v)}};
  call('onShow'); await tick();
});
afterEach(() => { call('onUnload'); vi.unstubAllGlobals(); });
test('self declared identity validates name date and checksum and normalizes lowercase X', () => {
  expect(identityInput(' 张三 ', '11010519491231002x')).toEqual({real_name:'张三',identity_number:'11010519491231002X'});
  for(const [name,id] of [['单','11010519491231002X'],['张三','11010519491331002X'],['张三','110105194912310021'],['张三','00110519491231002X']]) expect(()=>identityInput(name!,id!)).toThrow();
});
test('saving identity is single flight reads server status and returns without keeping raw identity data', async () => {
  call('inputName',{detail:{value:' 张三 '}});call('inputIdentity',{detail:{value:'11010519491231002x'}});
  api.identity.mockReturnValue(handle(verified));
  await Promise.all([call('saveIdentity'),call('saveIdentity')]);
  expect(api.saveIdentity).toHaveBeenCalledTimes(1);
  expect(api.saveIdentity).toHaveBeenCalledWith({real_name:'张三',identity_number:'11010519491231002X'},'identity-original-key');
  expect(page.data).toMatchObject({completed:true,realName:'',identityNumber:'',busy:false,overallText:'实名信息已填写'});
  expect(wx.navigateBack).toHaveBeenCalled();
});
test('invalid identity never writes and successful transport alone cannot mark identity completed', async () => {
  await call('saveIdentity'); expect(api.saveIdentity).not.toHaveBeenCalled();expect(page.data.errorText).toContain('姓名');
  expect(page.data.errorField).toBe('realName');
  call('inputName',{detail:{value:'张三'}}); await call('saveIdentity');
  expect(page.data.errorField).toBe('identityNumber'); expect(api.saveIdentity).not.toHaveBeenCalled();
  call('inputName',{detail:{value:'张三'}});call('inputIdentity',{detail:{value:'11010519491231002X'}});
  await call('saveIdentity');expect(page.data.completed).toBe(false);expect(wx.navigateBack).not.toHaveBeenCalled();
});
test('later entry returns without saving and is unavailable during an in-flight save', async () => {
  page.setData({busy:true}); call('onSecondaryNavigationBack'); expect(wx.navigateBack).not.toHaveBeenCalled();
  page.setData({busy:false}); call('onSecondaryNavigationBack'); expect(wx.navigateBack).toHaveBeenCalled(); expect(api.saveIdentity).not.toHaveBeenCalled();
});
test.each(['hide','switch'])('late identity save after %s cannot repaint or return under another account', async (boundary) => {
  call('inputName',{detail:{value:'张三'}});call('inputIdentity',{detail:{value:'11010519491231002X'}});
  let done!:(v:unknown)=>void;api.saveIdentity.mockReturnValue({promise:new Promise(resolve=>done=resolve),abort:vi.fn()});
  const saving=call('saveIdentity');await tick();call('onHide');
  if(boundary==='switch'){api.owner='mini-b';call('onShow');await tick();}
  done({status:'VERIFIED',check_kind:'REAL_NAME'});await saving;
  expect(page.data.identityNumber).toBe('');expect(page.data.realName).toBe('');expect(page.data.completed).toBe(false);expect(wx.navigateBack).not.toHaveBeenCalled();
});
test('failed identity save preserves input only on the active page and explicit retry retains its key', async () => {
  call('inputName',{detail:{value:'张三'}});call('inputIdentity',{detail:{value:'11010519491231002X'}});
  api.saveIdentity.mockReturnValueOnce({promise:Promise.reject(new Error('结果待核实')),abort:vi.fn()});
  await call('saveIdentity');expect(page.data.identityNumber).toBe('11010519491231002X');expect(page.data.errorText).toContain('待核实');
  api.identity.mockReturnValue(handle(verified));await call('saveIdentity');
  expect(api.saveIdentity.mock.calls.map(row=>row[1])).toEqual(['identity-original-key','identity-original-key']);
});
test('identity form uses visible idcard input and never binds native focus to validation state', () => {
  const markup=readFileSync('miniprogram/pages/identity/index.wxml','utf8');
  expect(markup).toContain('真实姓名');expect(markup).toContain('身份证号');
  const inputs=markup.match(/<input\b[^>]*\/>/g)!;
  expect(inputs).toHaveLength(2);
  for(const input of inputs) expect(input).not.toMatch(/\s(?:focus|password)=/);
  expect(inputs.find(input=>input.includes('bindinput="inputIdentity"'))).toMatch(/type="idcard".*maxlength="18"/);
  expect(markup).toContain('本期不进行第三方身份核验');expect(markup).not.toMatch(/服务尚未接通|startFaceAuthentication|submitDocuments|upload/);
});

test('correcting validation allows continuous native input without rewriting the value before submit', async () => {
  call('inputName',{detail:{value:'张三'}});
  await call('saveIdentity');
  expect(page.data.errorField).toBe('identityNumber');
  const input='11010519491231002x';
  for(let n=1;n<=input.length;n++) {
    call('inputIdentity',{detail:{value:input.slice(0,n)}});
    expect(page.data).toMatchObject({identityNumber:input.slice(0,n),errorField:'',errorText:'',busy:false,loaded:true,completed:false});
  }
  expect(api.saveIdentity).not.toHaveBeenCalled();
  api.identity.mockReturnValue(handle(verified));
  await call('saveIdentity');
  expect(api.saveIdentity).toHaveBeenCalledWith({real_name:'张三',identity_number:input.toUpperCase()},'identity-original-key');
  expect(page.data.identityNumber).toBe('');
});
