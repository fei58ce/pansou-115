const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pansou-img-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tmp, 'test.sqlite');
require('reflect-metadata');
const axios = require('axios');
const { rememberImageUrls, isRememberedImageUrl, isPublicAddress, detectRasterImage } = require('../dist/utils/imageSources');
const { ImageService } = require('../dist/services/ImageService');
const { ImageController } = require('../dist/controllers/teleImages');
const db = require('../dist/config/database').default;
after(async()=>{ await db.close(); fs.rmSync(tmp,{recursive:true,force:true}); });

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452','hex');
const JPEG = Buffer.from('ffd8ffe000104a464946','hex');
const serve = (handler) => new Promise((resolve)=>{ const s=http.createServer(handler); s.listen(0,'127.0.0.1',()=>resolve(s)); });
const stop = (s) => { s.closeAllConnections(); s.close(); };
const call = async (controller, url) => {
 const res = { statusCode:200, headers:{}, status(c){ this.statusCode=c; return this; }, json(b){ this.body=b; return this; },
  setHeader(k,v){ this.headers[k.toLowerCase()]=v; }, send(b){ this.body=b; return this; }, end(){ return this; } };
 await controller.getImages({ query: url===undefined ? {} : { url }, headers:{} }, res);
 return res;
};

test('只把公网地址当作可连接的图床地址',()=>{
 for (const ip of ['127.0.0.1','10.1.2.3','172.20.0.5','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','198.18.0.1','224.0.0.1','255.255.255.255','::','::1','fd00::1','fe80::1','::ffff:127.0.0.1','::ffff:192.168.0.1','not-an-ip'])
  assert.equal(isPublicAddress(ip),false,ip);
 for (const ip of ['8.8.8.8','1.1.1.1','140.82.112.3','2606:4700:4700::1111'])
  assert.equal(isPublicAddress(ip),true,ip);
});

test('只记住搜索结果里的 http/https 图片地址',()=>{
 rememberImageUrls(['https://img.example.com/a.jpg','http://img.example.com/b.png','javascript:alert(1)','/relative.png',42,null,'']);
 assert.equal(isRememberedImageUrl('https://img.example.com/a.jpg'),true);
 assert.equal(isRememberedImageUrl('http://img.example.com/b.png'),true);
 for (const u of ['javascript:alert(1)','/relative.png','https://img.example.com/other.jpg']) assert.equal(isRememberedImageUrl(u),false,u);
});

test('按文件头识别常见位图，拒绝 SVG 和网页',()=>{
 assert.equal(detectRasterImage(PNG),'image/png');
 assert.equal(detectRasterImage(JPEG),'image/jpeg');
 assert.equal(detectRasterImage(Buffer.from('GIF89a....')),'image/gif');
 assert.equal(detectRasterImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 ','latin1')),'image/webp');
 assert.equal(detectRasterImage(Buffer.from('\0\0\0\x1cftypavif','latin1')),'image/avif');
 for (const t of ['<svg xmlns="http://www.w3.org/2000/svg"></svg>','<!doctype html><script>alert(1)</script>',''])
  assert.equal(detectRasterImage(Buffer.from(t)),'',t);
});

test('图片代理：白名单照常代理，其他图床只放行搜索结果返回过的地址',async()=>{
 const calls=[];
 const controller=new ImageController({ getImageBuffer: async(url,untrusted)=>{ calls.push([url,untrusted]); return { buffer:PNG, contentType:'image/png', fromCache:false }; } });
 let res=await call(controller,'https://cdn4.telesco.pe/file/a.jpg');
 assert.equal(res.statusCode,200); assert.equal(res.headers['x-content-type-options'],'nosniff');
 assert.deepEqual(calls.pop(),['https://cdn4.telesco.pe/file/a.jpg',false]);
 res=await call(controller,encodeURIComponent('https://cdn5.telesco.pe/file/b.jpg'));
 assert.deepEqual(calls.pop(),['https://cdn5.telesco.pe/file/b.jpg',false]);
 const listed='https://dl.pansearch.me/poster/x.jpg?src=a%2Fb';
 res=await call(controller,listed);
 assert.equal(res.statusCode,400); assert.equal(calls.length,0);
 rememberImageUrls([listed,'https://img.example.com:8443/p.jpg','https://user:pw@img.example.com/p.jpg']);
 res=await call(controller,listed);
 assert.equal(res.statusCode,200); assert.deepEqual(calls.pop(),[listed,true]);
 for (const bad of ['https://img.example.com:8443/p.jpg','https://user:pw@img.example.com/p.jpg','',undefined,['https://cdn4.telesco.pe/a.jpg','x']]) {
  res=await call(controller,bad);
  assert.equal(res.statusCode,400,String(bad));
 }
 assert.equal(calls.length,0);
});

test('其他图床拒绝连接内网：IP 直写和域名解析到内网都拦截',async()=>{
 const server=await serve((req,res)=>{ res.setHeader('Content-Type','image/png'); res.end(PNG); });
 const { port }=server.address();
 const service=new ImageService();
 try {
  for (const url of [`http://127.0.0.1:${port}/a.png`,`http://localhost:${port}/a.png`,`http://[::1]:${port}/a.png`])
   await assert.rejects(service.getImageBuffer(url,true),(e)=>e.code==='EIMAGEPRIVATE',url);
 } finally { stop(server); }
});

test('其他图床跳转到内网同样拦截：跳到内网 IP 或解析到内网的域名都拒绝',async()=>{
 let fetched=0, hits=0;
 const target=await serve((req,res)=>{ fetched++; res.setHeader('Content-Type','image/png'); res.end(PNG); });
 const port=target.address().port;
 const hops={ '/ip':`http://127.0.0.1:${port}/a.png`, '/v6':`http://[::1]:${port}/a.png`, '/name':`http://localhost:${port}/a.png` };
 const redirector=await serve((req,res)=>{ hits++; res.statusCode=302; res.setHeader('Location',hops[req.url]); res.end(); });
 const base=`http://127.0.0.1:${redirector.address().port}`;
 // 首跳只能指向本机测试服务，所以复制配置绕开首跳检查；跳转后用的仍是同一套 Agent 与 beforeRedirect。
 const client=axios.create(new ImageService().untrusted.defaults);
 const blocked=(e)=>{ for (let x=e; x; x=x.cause) if (x.code==='EIMAGEPRIVATE') return true; return false; };
 try {
  for (const p of Object.keys(hops)) await assert.rejects(client.get(base+p,{ responseType:'arraybuffer' }),blocked,p);
  assert.equal(hits,3); assert.equal(fetched,0);
 } finally { stop(redirector); stop(target); }
});

test('其他图床只转发真实位图，按文件头给类型，拒绝冒充图片的网页和 SVG',async()=>{
 const bodies={ '/a.png':['image/png',PNG], '/octet':['application/octet-stream',JPEG],
  '/page':['image/png',Buffer.from('<html><script>alert(1)</script></html>')], '/x.svg':['image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')] };
 const server=await serve((req,res)=>{ const [type,body]=bodies[req.url]; res.setHeader('Content-Type',type); res.end(body); });
 const base=`http://127.0.0.1:${server.address().port}`;
 const service=new ImageService();
 service.untrusted=axios.create({ proxy:false });
 try {
  const png=await service.getImageBuffer(base+'/a.png',true);
  assert.equal(png.contentType,'image/png'); assert.deepEqual(png.buffer,PNG);
  assert.equal((await service.getImageBuffer(base+'/octet',true)).contentType,'image/jpeg');
  for (const p of ['/page','/x.svg']) await assert.rejects(service.getImageBuffer(base+p,true),/常见图片格式/);
 } finally { stop(server); }
});
