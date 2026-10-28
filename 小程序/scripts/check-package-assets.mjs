import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniRoot = path.join(projectRoot, 'miniprogram');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'config/static-assets.json'), 'utf8'));
const errors = [];
function files(directory) { return fs.existsSync(directory) ? fs.readdirSync(directory,{withFileTypes:true}).flatMap((entry)=>entry.isDirectory()?files(path.join(directory,entry.name)):[path.join(directory,entry.name)]) : []; }
const urls = new Set(); const paths = new Set();
if(manifest.schema_version!==1 || manifest.base_url!=='https://xyuprj.oss-cn-hangzhou.aliyuncs.com' || manifest.prefix!=='miniprogram-static/v1.0.1.3/') errors.push('unapproved static asset target');
for(const asset of manifest.assets) {
  if(!/^assets\/[a-zA-Z0-9_/-]+\.(svg|jpg|png|webp)$/.test(asset.path)||asset.path.includes('..')||!/^[a-f0-9]{64}$/.test(asset.sha256)) {errors.push('invalid asset identity');continue;}
  if(paths.has(asset.path)||urls.has(asset.url)) errors.push('duplicate asset identity');
  paths.add(asset.path); urls.add(asset.url);
  if(asset.key!==manifest.prefix+asset.sha256+'/'+asset.path || asset.url!==manifest.base_url+'/'+asset.key) errors.push('asset URL/key drift: '+asset.path);
  const source=path.join(projectRoot,'static-assets',asset.path);
  if(!fs.existsSync(source)){errors.push('source missing: '+asset.path);continue;}
  const body=fs.readFileSync(source);
  if(body.length!==asset.bytes||crypto.createHash('sha256').update(body).digest('hex')!==asset.sha256) errors.push('source bytes/hash drift: '+asset.path);
  const mime={'.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[path.extname(source)];
  if(asset.mime!==mime) errors.push('MIME drift: '+asset.path);
}
for(const source of files(path.join(projectRoot,'static-assets'))) {if(!paths.has(path.relative(path.join(projectRoot,'static-assets'),source).split(path.sep).join('/'))) errors.push('unregistered source asset');}
const packageFiles=files(miniRoot);
const mediaExtension=/\.(?:svg|png|jpe?g|webp|gif|apng|avif|ico|bmp|tiff?|heic|mp4|mov|webm|m4v|mp3|wav|ogg|aac|m4a|flac|woff2?|ttf|otf|eot)$/i;
for(const file of packageFiles.filter((item)=>/\.(ts|wxml|wxss|json)$/.test(item))) {
  const content=fs.readFileSync(file,'utf8');
  const name=path.relative(miniRoot,file);
  if(/(?:['"`(])(?:\.{1,2}\/)*\/?assets\//.test(content)) errors.push('stale local reference: '+name);
  for(const match of content.matchAll(/(['"`])([^'"`\r\n]+)\1/g)) {
    const value=match[2];
    if(mediaExtension.test(value.split(/[?#]/)[0]) && !/^(?:https?:|wxfile:|cloud:|\/\/)/i.test(value) && !value.includes('{{') && !value.includes('${')) errors.push('stale local reference: '+name);
  }
  for(const match of content.matchAll(/url\(\s*([^'"\s)][^\s)]*)\s*\)/gi)) {
    if(mediaExtension.test(match[1].split(/[?#]/)[0]) && !/^https?:\/\//i.test(match[1])) errors.push('stale local reference: '+name);
  }
  if(/data:(?:image|audio|video|font)\/|data:application\/(?:font|x-font|vnd\.ms-fontobject)|<svg\b/i.test(content)) errors.push('embedded media is forbidden: '+name);
  for(const match of content.matchAll(/https:\/\/xyuprj\.oss-cn-hangzhou\.aliyuncs\.com\/[^'"\s)<>]+/g)) if(!urls.has(match[0])) errors.push('unknown or credential-bearing asset URL: '+path.relative(miniRoot,file));
}
const mediaFiles=packageFiles.filter((file)=>mediaExtension.test(file));
const mediaBytes=mediaFiles.reduce((n,file)=>n+fs.statSync(file).size,0);
const inputBytes=packageFiles.reduce((n,file)=>n+fs.statSync(file).size,0);
if(mediaFiles.length) errors.push('runtime media must be hosted on OSS: '+mediaFiles.map(file=>path.relative(miniRoot,file)).join(', '));
if(inputBytes>4*1024*1024) errors.push('package input budget exceeded');
if(errors.length){console.error('package asset check: FAIL\n'+errors.join('\n'));process.exitCode=1;}
else console.log(`package asset check: PASS (${paths.size} hash-bound OSS assets, media ${mediaBytes} bytes, source input ${(inputBytes/1048576).toFixed(2)} MiB)`);
