import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';

// This local adapter reuses the mini program's existing offline rules. It does
// not contact the product API or any payment, identity, or hardware provider.
export function linkedMock() {
  return {
    name: 'xingyu-local-linked-mock',
    configureServer(server) {
      const root = server.config.root;
      const miniRoot = path.resolve(root, '../小程序/miniprogram');
      const stateDir = process.env.XINGYU_MOCK_STATE_DIR || path.join(root, '.linked-mock');
      const stateFile = path.join(stateDir, 'state.json');
      const key = 'xingyu.offline-v102.xingyu.offline-demo.v1';
      const storage = new Map();
      let initialized = fs.existsSync(stateFile);
      let stateVersion = 0;
      let loading;
      function persist(value) {
        fs.mkdirSync(stateDir, { recursive: true });
        const tmp = path.join(stateDir, `.state-${process.pid}.tmp`);
        stateVersion += 1;
        fs.writeFileSync(tmp, JSON.stringify({ format:1, stateVersion, state:value }), { mode: 0o600 });
        fs.renameSync(tmp, stateFile);
        initialized = true;
      }
      async function engine() {
        if (!loading) loading = (async () => {
          if (initialized) {
            const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            if (parsed?.format !== 1 || parsed.state?.revision !== 1 || !Array.isArray(parsed.state.orders) || !Array.isArray(parsed.state.supplies) || !Number.isSafeInteger(parsed.stateVersion)) throw new Error('本机共享数据格式无效，请保留原文件并检查');
            stateVersion=parsed.stateVersion; storage.set(key, parsed.state);
          }
          globalThis.wx = {
            getStorageSync: (name) => storage.get(name),
            setStorageSync: (name, value) => { if (name === key) persist(value); storage.set(name, globalThis.structuredClone(value)); },
            removeStorageSync: (name) => storage.delete(name),
            getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
          };
          return server.ssrLoadModule('/@fs/' + path.join(miniRoot, 'preview/engine.ts'));
        })();
        return loading;
      }
      async function jsonBody(req) {
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) throw new Error('请求数据超过本机演示限制'); chunks.push(chunk); }
        return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      }
      const send = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
      server.middlewares.use('/__mock-link', async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        if (url.pathname.startsWith('/assets/')) {
          const relative = decodeURIComponent(url.pathname.slice('/assets/'.length));
          const assetRoot = path.resolve(miniRoot, 'assets');
          const filename = path.resolve(assetRoot, relative);
          if (!filename.startsWith(assetRoot + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.statusCode=404; res.end(); return; }
          const ext=path.extname(filename).toLowerCase();
          res.setHeader('Content-Type', ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf'})[ext] || 'application/octet-stream');
          fs.createReadStream(filename).pipe(res); return;
        }
        try {
          const e = await engine();
          if (req.method === 'GET' && url.pathname === '/state') { send(res, 200, { state: e.readDemo(), initialized, stateVersion }); return; }
          if (req.method === 'GET' && /^\/materials\/local-material-[A-Za-z0-9-]+$/.test(url.pathname)) {
            const id=url.pathname.slice('/materials/'.length), material=e.readDemo().materials[id];
            const ext=({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'})[material?.mime_type];
            const filename=ext && path.join(stateDir,'materials',id+ext);
            if(!filename||!['preview-admin','demo-tenant'].includes(material.owner_account_id)||material.material_class!=='EVIDENCE_IMAGE'||!fs.existsSync(filename)){res.statusCode=404;res.end();return;}
            res.setHeader('Content-Type',material.mime_type);res.setHeader('Cache-Control','no-store');fs.createReadStream(filename).pipe(res);return;
          }
          if (req.method !== 'POST') { next(); return; }
          const body = await jsonBody(req);
          if (url.pathname === '/init') {
            if (!initialized && body.snapshot?.revision === 1 && Array.isArray(body.snapshot.orders) && Array.isArray(body.snapshot.supplies)) {
              storage.set(key, globalThis.structuredClone(body.snapshot)); persist(body.snapshot); e.dropDemoMemory();
            }
            send(res, 200, { state: e.readDemo(), initialized, stateVersion }); return;
          }
          if (url.pathname === '/request') {
            const method = String(body.method || 'GET').toUpperCase(), requested = String(body.path || '');
            if (!['GET','POST','PUT','PATCH','DELETE'].includes(method) || !requested.startsWith('/v1/') || requested.includes('://')) throw new Error('只允许调用本机演示接口');
            try {
              const result = e.handleDemo(method, requested, body.body || {}, body.headers || {});
              send(res, 200, { ...result, state: e.readDemo(), stateVersion });
            } catch (error) {
              send(res, 200, { status: error.status || 500, data: { code:error.code || 'DEMO_ERROR', message:error.message || '模拟操作失败', request_id:'linked-demo' }, headers:{}, state:e.readDemo(), stateVersion });
            }
            return;
          }
          if (url.pathname === '/action') {
            let result;
            switch (body.action) {
              case 'payment': result=e.recordDemoPayment(String(body.id),String(body.outcome)); break;
              case 'event': result=e.runDemoEvent(String(body.id),String(body.event)); break;
              case 'adminPreview': result=e.previewAdminReview(String(body.id),body.body || {},String(body.expectedVersion || '')); break;
              case 'extra': {
                try { result=e.runDemoExtra(String(body.kind),body.values || {},String(body.key || '')); }
                catch (error) {
                  if(error instanceof e.DemoProblem) {send(res,error.status || 422,{message:error.message,code:error.code,outcomeKnown:true});return;}
                  throw error;
                }
                break;
              }
              case 'adminReceipt': {
                const id=String(body.id), intentKey=String(body.key||''), input=body.body||{}, state=e.readDemo(), receiptKey='linked-admin-receipt:'+intentKey;
                const fingerprint=JSON.stringify({id,input}), old=state.receipts[receiptKey];
                if(!intentKey)throw new Error('缺少收回操作的幂等键');
                if(old) {if(old.fingerprint!==fingerprint)throw new Error('同一收回键不能用于不同内容');result=old.result;break;}
                const order=state.orders.find(v=>v.order.order_id===id), ret=state.returns[id];
                if(!order||!ret||String(ret.version)!==String(body.expectedVersion))throw new Error('共享归还记录已变化，请刷新后再操作');
                const received=Date.parse(input.received_at), delivered=order.delivery.delivered_at?Date.parse(order.delivery.delivered_at):null, simulatedNow=Date.now()+Number(state.rules?.dayOffset??0)*86400000;
                if(!Number.isFinite(received)||received>simulatedNow||(delivered!==null&&received<delivered))throw new Error('收回时间不在可用范围内');
                e.runDemoEvent(id,'RECEIVE');
                const updated=e.readDemo().returns[id]; updated.received_at=new Date(received).toISOString();updated.receipt_note=input.note??null;updated.receipt_recorded_at=new Date(simulatedNow).toISOString();updated.version=String(Number(updated.version||0)+1);
                e.readDemo().receipts[receiptKey]={fingerprint,result:updated};e.saveDemo();result=updated;break;
              }
              case 'adminReview': result=e.saveAdminReview(String(body.id),body.body || {},String(body.expectedVersion || ''),String(body.key || '')); break;
              case 'adminCatalog': result=e.syncAdminCatalog(body.item || {},String(body.previousName || ''),body.command || {},String(body.key || '')); break;
              case 'advanceDay': result=e.advanceDemoDay(); break;
              case 'review': result=e.advanceDemoReview(); break;
              case 'reset': result=e.resetDemo(); break;
              case 'role': e.readDemo().role=String(body.role); e.saveDemo(); break;
              case 'scenario': e.readDemo().scenario=String(body.scenario); e.saveDemo(); break;
              case 'material': result=e.registerMaterial(String(body.file),String(body.materialClass),String(body.id)); break;
              case 'miniMaterial': {
                const intent=String(body.key||'');if(!/^[!-~]{1,64}$/.test(intent)||typeof body.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))throw new e.DemoProblem('VALIDATION_FAILED','归还凭证格式或上传标识无效',422);
                const bytes=Buffer.from(body.base64,'base64');
                const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
                if(!mime||bytes.length>5*1024*1024)throw new e.DemoProblem('VALIDATION_FAILED','归还凭证须为不超过 5 MB 的 PNG、JPEG 或 WebP 图片',422);
                const id='local-material-tenant-'+createHash('sha256').update(intent).digest('hex').slice(0,24),ext=({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'})[mime],dir=path.join(stateDir,'materials'),filename=path.join(dir,id+ext),previous=e.readDemo().materials[id];
                if(previous){if(previous.owner_account_id!=='demo-tenant'||previous.mime_type!==mime||previous.size_bytes!==bytes.length||!fs.existsSync(filename)||!fs.readFileSync(filename).equals(bytes))throw new e.DemoProblem('IDEMPOTENCY_CONFLICT','同一上传标识不能更换文件',409);result=previous;break;}
                fs.mkdirSync(dir,{recursive:true,mode:0o700});fs.writeFileSync(filename,bytes,{mode:0o600,flag:'wx'});
                try {result=e.registerTenantEvidence(id,'http://127.0.0.1:5190/__mock-link/materials/'+id,mime,bytes.length);}catch(error){fs.unlinkSync(filename);throw error;}
                break;
              }
              case 'adminMaterial': {
                const id=String(body.id||''),mime=String(body.mime||''),ext=({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'})[mime];
                if(!/^local-material-[A-Za-z0-9-]+$/.test(id)||!ext||typeof body.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))throw new e.DemoProblem('VALIDATION_FAILED','演示凭证格式无效',422);
                const bytes=Buffer.from(body.base64,'base64');
                const valid=mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
                if(!valid||bytes.length>5*1024*1024)throw new e.DemoProblem('VALIDATION_FAILED','演示凭证须为不超过 5 MB 的有效图片',422);
                const dir=path.join(stateDir,'materials');fs.mkdirSync(dir,{recursive:true,mode:0o700});const filename=path.join(dir,id+ext);
                const previous=e.readDemo().materials[id];
                if(previous){if(previous.owner_account_id!=='preview-admin'||previous.mime_type!==mime||previous.size_bytes!==bytes.length||!fs.existsSync(filename)||!fs.readFileSync(filename).equals(bytes))throw new e.DemoProblem('IDEMPOTENCY_CONFLICT','同一上传标识不能更换文件',409);result=previous;break;}
                fs.writeFileSync(filename,bytes,{mode:0o600,flag:'wx'});
                try {result=e.registerAdminMaterial(id,'http://127.0.0.1:5190/__mock-link/materials/'+id,mime,bytes.length);}
                catch(error){fs.unlinkSync(filename);throw error;}
                break;
              }
              case 'support': e.readDemo().receipts['support-messages']={items:body.messages}; e.saveDemo(); break;
              default: throw new Error('未配置的联动操作');
            }
            send(res, 200, { result:result ?? null, state:e.readDemo(), stateVersion }); return;
          }
          next();
        } catch (error) {
          const code=typeof error?.code==='string'?error.code:undefined;
          const status=code==='PREVIEW_UNMAPPED'?422:Number.isInteger(error?.status)&&error.status>=400&&error.status<500?error.status:500;
          send(res,status,{message:error instanceof Error?error.message:'本机 Mock 服务失败',code,outcomeKnown:status<500});
        }
      });
    },
  };
}
