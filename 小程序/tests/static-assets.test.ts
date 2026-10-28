import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
test('static asset gate rejects changed bytes, foreign URLs and stale package references', () => {
 const root=mkdtempSync(join(tmpdir(),'xy-static-assets-'));
 try {
  for(const dir of ['scripts','config','miniprogram','static-assets/assets/icons']) mkdirSync(join(root,dir),{recursive:true});
  copyFileSync('scripts/check-package-assets.mjs',join(root,'scripts/check-package-assets.mjs'));
  const body='<svg xmlns="http://www.w3.org/2000/svg"/>';const sha=createHash('sha256').update(body).digest('hex');
  const origin='https://xyuprj.oss-cn-hangzhou.aliyuncs.com'; const prefix='miniprogram-static/v1.0.1.3/';
  const asset={path:'assets/icons/test.svg',sha256:sha,bytes:Buffer.byteLength(body),key:prefix+sha+'/assets/icons/test.svg',url:origin+'/'+prefix+sha+'/assets/icons/test.svg',mime:'image/svg+xml'};
  const manifest={schema_version:1,base_url:origin,prefix,assets:[asset]};
  const save=()=>writeFileSync(join(root,'config/static-assets.json'),JSON.stringify(manifest));save();
  const source=join(root,'static-assets',asset.path);writeFileSync(source,body);
  const run=()=>spawnSync(process.execPath,[join(root,'scripts/check-package-assets.mjs')],{encoding:'utf8'});
  expect(run().status).toBe(0);
  writeFileSync(source,body+' ');expect(run().stderr).toContain('source bytes/hash drift');writeFileSync(source,body);
  asset.url='https://unapproved.example/test.svg';save();expect(run().stderr).toContain('asset URL/key drift');asset.url=origin+'/'+asset.key;save();
  writeFileSync(join(root,'miniprogram/test.wxml'),'<image src="/assets/icons/test.svg"/>');expect(run().stderr).toContain('stale local reference');
  // Relative paths previously bypassed the root-only reference check.
  for (const reference of ['../../assets/login-mark.svg', './icons/login.svg', 'icons/login.svg']) {
   writeFileSync(join(root,'miniprogram/test.wxml'),`<image src="${reference}"/>`);expect(run().stderr).toContain('stale local reference');
  }
  writeFileSync(join(root,'miniprogram/test.wxml'),`<image src="${asset.url}"/><image src="{{uploadedFilePath}}"/>`);expect(run().status).toBe(0);
  for (const name of ['orphan.PNG', 'clip.mp4', 'font.woff2', 'empty.svg']) {
   const bundled=join(root,'miniprogram',name);writeFileSync(bundled,name==='empty.svg'?'':'media');expect(run().stderr).toContain('runtime media must be hosted on OSS');rmSync(bundled);
  }
  writeFileSync(join(root,'miniprogram/test.wxss'),'.logo { background: url(icons/login.svg); }');expect(run().stderr).toContain('stale local reference');
  writeFileSync(join(root,'miniprogram/test.wxss'),'.logo { background: url(data:image/svg+xml;base64,PHN2Zy8+); }');expect(run().stderr).toContain('embedded media is forbidden');
  writeFileSync(join(root,'miniprogram/test.wxss'),`@font-face { src: url("data:font/woff2;base64,AA=="); }`);expect(run().stderr).toContain('embedded media is forbidden');
  rmSync(join(root,'miniprogram/test.wxss'));expect(run().status).toBe(0);
 } finally {rmSync(root,{recursive:true,force:true});}
});
