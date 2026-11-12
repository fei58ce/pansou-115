const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pansou-sub-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tmp, 'test.sqlite');
const rules = require('../dist/subscriptions/rules');
const { HttpSubscriptionDrive, normalizeFile } = require('../dist/subscriptions/drive');
const { SubscriptionEngine } = require('../dist/subscriptions/engine');
const { Subscription, SubscriptionRun, SubscriptionEntry, SubscriptionLease, initSubscriptionTables } = require('../dist/subscriptions/models');
const db = require('../dist/config/database').default;
const c = { title: '测试剧', aliases: [], year: '', season: 1, quality: '', requiredText: '', shareCode:'abc', receiveCode:'', sourceCid:'0', targetCid:'123', targetPath:'/emby/测试剧/Season 01', accountId:'99', mode:'backfill', searchFallback:false };
const file = (ep) => ({id:'35431139504449138'+ep, name:'测试剧.S01E'+String(ep).padStart(2,'0')+'.mkv', size:'10000',sha1:'hash'+ep,folder:false,context:''});
before(initSubscriptionTables);
after(async()=>{ await db.close(); fs.rmSync(tmp,{recursive:true,force:true}); });

test('北京时间18点和UTC跨日，不依赖系统时区',()=>{
 assert.equal(rules.nextDaily(new Date('2026-11-12T09:59:59Z')).toISOString(),'2026-11-12T10:00:00.000Z');
 assert.equal(rules.nextDaily(new Date('2026-11-12T10:00:00Z')).toISOString(),'2026-11-13T10:00:00.000Z');
 assert.equal(rules.chinaDate(new Date('2026-11-12T17:00:00Z')),'2026-11-13');
});
test('大整数ID无损，不改变字符串中的数字',()=>{
 const o=rules.parse115Json('{"fid":3543113950444913826,"n":"3543113950444913826","s":12}');
 assert.equal(o.fid,'3543113950444913826'); assert.equal(o.n,o.fid); assert.equal(o.s,12);
 assert.equal(normalizeFile({cid:'parent',fid:'123',n:'film'},'').folder,false);
 assert.throws(()=>normalizeFile({fid:3543113950444913826},''));
});
test('拒绝伪造分享域名及路径',()=>{
 assert.deepEqual(rules.parseShare('https://115cdn.com/s/abc?password=1234'),{shareCode:'abc',receiveCode:'1234'});
 assert.throws(()=>rules.parseShare('https://115.com.evil.test/s/abc'));
 assert.throws(()=>rules.parseShare('http://127.0.0.1/s/abc'));
});
test('只识别明确单集，拒绝合集/跨季/不确定集数',()=>{
 assert.deepEqual(rules.episodeOf('片名.S01E02.mkv'),{season:1,episode:2});
 assert.deepEqual(rules.episodeOf('第23集.mp4','Season 01'),{season:1,episode:23});
 assert.equal(rules.episodeOf('S01E01-E02.mkv'),null);
 assert.equal(rules.episodeOf('S01E01E02.mkv'),null);
 assert.equal(rules.episodeOf('第1-2集.mp4','Season 01'),null);
 assert.equal(rules.episodeOf('S02E01.mkv','Season 01'),null);
 assert.equal(rules.episodeOf('01.mkv'),null);
 assert.equal(rules.matchFile(file(1),{...c,season:2}).episode,undefined);
 assert.equal(rules.matchFile(file(1),{...c,quality:'2160p'}).episode,undefined);
});

async function reset(){ await SubscriptionEntry.destroy({where:{}});await SubscriptionRun.destroy({where:{}});await Subscription.destroy({where:{}}); await SubscriptionLease.update({owner:'',expiresAt:0},{where:{id:'worker'}}); }
function fixture(options={}) {
 let source=[file(1)], target=[], writes=0, notices=0, targetError=false;
 const deps={ cookie:async()=>options.cookie||'UID=99_D3_1',
 drive:{ target:async()=>{if(targetError)throw new Error('115目标目录不存在');return {files:[...target],path:c.targetPath}},source:async()=>({files:[...source],path:''}),receive:async(_,__,f)=>{writes++;if(!options.noSave)target.push({...f,id:'saved'+writes});if(options.timeout)throw new Error('timeout');} },
 search:async()=>[],notify:async()=>{notices++;return {triggered:!options.notifyFail,message:''}} };
 return {engine:new SubscriptionEngine(deps),setSource:(v)=>source=v,setTarget:(v)=>target=v,setTargetError:()=>targetError=true,writes:()=>writes,notices:()=>notices};
}
async function sub(mode='backfill',userId='u') {return Subscription.create({userId,config:{...c,mode}});}
async function run(f,s){await f.engine.enqueue('u',s.get().id);await f.engine.drain();}
test('补齐缺集，重复手动检查不重复转存，OneStrm结果独立',async()=>{
 await reset();const f=fixture();const s=await sub();await run(f,s);await run(f,s);
 assert.equal(f.writes(),1);assert.equal(f.notices(),1); assert.equal(await SubscriptionEntry.count({where:{state:'confirmed'}}),1);
});
test('仅新增先建基线，新增第二集才转存',async()=>{
 await reset();const f=fixture();const s=await sub('future');await run(f,s);assert.equal(f.writes(),0);
 f.setSource([file(1),file(2)]);await run(f,s);assert.equal(f.writes(),1);
});
test('现有目录已包含同集则跳过；未知文件阻止误判缺集',async()=>{
 await reset();const f=fixture();const s=await sub();f.setTarget([file(1)]);await run(f,s);assert.equal(f.writes(),0);
 f.setTarget([{...file(3),name:'无法识别.mkv'}]);await run(f,s);assert.equal(f.writes(),0);
});
test('写入超时实际成功可核实，无结果不自动重发',async()=>{
 await reset();let f=fixture({timeout:true});let s=await sub();await run(f,s);await run(f,s);assert.equal(f.writes(),1);
 assert.equal(await SubscriptionEntry.count({where:{state:'confirmed'}}),1);
 await reset();f=fixture({timeout:true,noSave:true});s=await sub();await run(f,s);await run(f,s);assert.equal(f.writes(),1);
 assert.equal(await SubscriptionEntry.count({where:{state:'uncertain'}}),1);
});
test('同日自动任务唯一，手动自动冲突不重复入队',async()=>{
 await reset();const f=fixture();const s=await sub();const id=s.get().id;
 await f.engine.enqueue('u',id);await f.engine.daily('2026-11-12');await f.engine.daily('2026-11-12');
 assert.equal(await SubscriptionRun.count(),2);await f.engine.drain();assert.equal(f.writes(),1);
});
test('账号变更或目录不存在暂停，跨用户无权操作',async()=>{
 await reset();const f=fixture({cookie:'UID=100_D3_1'});const s=await sub();await run(f,s);assert.equal(f.writes(),0);
 assert.equal((await s.reload()).get().enabled,false);
 await assert.rejects(()=>f.engine.owned('other',s.get().id));
 await assert.rejects(()=>f.engine.toggle('other',s.get().id,false));
 const f2=fixture();await s.update({enabled:true});f2.setTargetError();await run(f2,s);assert.equal(f2.writes(),0);
});
test('崩溃账本先核实，不重复转存；通知失败不重存',async()=>{
 await reset();const f=fixture({notifyFail:true});const s=await sub();await run(f,s);await run(f,s);assert.equal(f.writes(),1);assert.equal(f.notices(),2);
 await SubscriptionRun.create({subscriptionId:s.get().id,userId:'u',slot:'crashed',state:'running'});
 await f.engine.drain();assert.equal(await SubscriptionRun.count({where:{state:'interrupted'}}),1);
});
test('持有其他实例租约时不运行队列',async()=>{
 await reset();const f=fixture();const s=await sub();await f.engine.enqueue('u',s.get().id);
 await SubscriptionLease.update({owner:'other',expiresAt:Date.now()+100000},{where:{id:'worker'}});
 await f.engine.drain();assert.equal(f.writes(),0);
});
test('分页包括超过100条的文件，正确识别fid和cid',async()=>{
 let pages=[];const api={get:async(_,opts)=>{pages.push(opts.params.offset);const offset=opts.params.offset;return {data:{state:true,path:[{cid:'123',name:'Season 01'}],count:101,data:offset===0?Array.from({length:100},(_,i)=>({fid:String(i+1),cid:'123',n:'S01E01.mkv'})):[{fid:'101',cid:'123',n:'S01E02.mkv'}]}}}};
 const result=await new HttpSubscriptionDrive(api).target('secret','123');assert.equal(result.files.length,101);assert.deepEqual(pages,[0,100]);
});
test('拒绝目标目录回退，重复分页及错误响应',async()=>{
 const api={get:async()=>({data:{state:true,path:[{cid:'0',name:'root'}],data:[]}})};
 await assert.rejects(()=>new HttpSubscriptionDrive(api).target('secret','123'),/其他目录/);
 const api2={get:async()=>({data:{state:true,path:[{cid:'123'}],data:[{fid:'1',n:'S01E01.mkv'}]}})};
 await assert.rejects(()=>new HttpSubscriptionDrive(api2).target('secret','123'),/分页重复/);
});

test('版本、季和同名续作边界',()=>{
 assert.deepEqual(rules.episodeOf('测试剧.S01E01.2160p.mkv'),{season:1,episode:1});
 assert.deepEqual(rules.episodeOf('测试剧 第二季 第23集.mkv'),{season:2,episode:23});
 assert.equal(rules.matchFile({...file(1),name:'另一部剧.S01E01.mkv'},c).episode,undefined);
 assert.equal(rules.identityMatches('测试剧2 S01E01',c),false);
 assert.equal(rules.matchFile({...file(1),name:'测试剧.S01E01.2160p.简中.mkv'},{...c,quality:'2160p',requiredText:'简中'}).episode,1);
 assert.equal(rules.matchFile(file(1),{...c,year:'2026'}).episode,undefined);
});
test('基线读取失败不初始化，暂停后不写盘',async()=>{
 await reset();const f=fixture();const s=await sub('future');f.setSource([]);
 f.engine.deps.drive.source=async()=>{throw new Error('115分享不可读取')};
 await run(f,s);assert.equal((await s.reload()).get().initialized,false);assert.equal(f.writes(),0);
 await f.engine.enqueue('u',s.get().id);await f.engine.toggle('u',s.get().id,false);await f.engine.drain();assert.equal(f.writes(),0);
});
test('单轮最多10集，下一轮补剩余，别名而非相似名称匹配',async()=>{
 await reset();const f=fixture();const s=await sub();f.setSource(Array.from({length:12},(_,i)=>file(i+1)));await run(f,s);assert.equal(f.writes(),10);await run(f,s);assert.equal(f.writes(),12);
 assert.equal(rules.identityMatches('The Test Show S01E01',{...c,title:'Test Show'}),true);
 assert.equal(rules.identityMatches('Test Showcase S01E01',{...c,title:'Test Show'}),false);
});
test('搜索补充只转严格匹配的单集，未知标题拒绝',async()=>{
 await reset();const f=fixture();const s=await sub();await s.update({initialized:true,config:{...c,searchFallback:true}});
 f.engine.deps.search=async()=>[{title:'测试剧 S01',cloudLinks:['https://115.com/s/new']}];
 f.engine.deps.drive.source=async(_,cfg)=>({files:cfg.shareCode==='new'?[file(2)]:[file(1)],path:''});
 await run(f,s);assert.equal(f.writes(),2);
});
test('编辑/恢复校验账号目录并拒绝其他用户',async()=>{
 await reset();const f=fixture();const input={...c,shareUrl:'https://115.com/s/abc'};
 const s=await f.engine.save('u',input);
 await assert.rejects(()=>f.engine.save('other',input,s.id),/订阅不存在/);
 await assert.rejects(()=>f.engine.save('u',input),/此目录/);
 await f.engine.enqueue('u',s.id);
 await assert.rejects(()=>f.engine.save('u',input,s.id),/检查结束/);
});

test('英文标题特殊字符按字面匹配，不作为正则',()=>{
 assert.equal(rules.identityMatches('A+B Show.S01E01',{...c,title:'A+B Show'}),true);
 assert.equal(rules.identityMatches('AAAB Show.S01E01',{...c,title:'A+B Show'}),false);
});
test('其他剧/季的高集数不污染仅新增水位',async()=>{
 await reset();const f=fixture();const s=await sub('future');
 f.setSource([file(1),{...file(99),name:'其他剧.S01E99.mkv'},{...file(98),name:'测试剧.S02E98.mkv'}]);
 await run(f,s); assert.equal((await s.reload()).get().watermark,1);
 f.setSource([file(1),file(2)]); await run(f,s); assert.equal(f.writes(),1);
});
test('仅新增搜索来源时间不明不能自动补旧集',async()=>{
 await reset();const f=fixture();const s=await sub('future');
 await s.update({initialized:true,watermark:1,config:{...c,mode:'future',searchFallback:true}});
 f.engine.deps.search=async()=>[{title:'测试剧 S01E02',cloudLinks:['https://115.com/s/new']}];
 f.engine.deps.drive.source=async(_,cfg)=>({files:cfg.shareCode==='new'?[file(2)]:[file(1)],path:''});
 await run(f,s); assert.equal(f.writes(),0);
});

const { RISK_CONTROL, parseBody } = require('../dist/subscriptions/drive');
test('115风控页（405/HTML/频繁）单独提示，请求之间保持间隔',async()=>{
 const html='<!doctype html><title>405</title>';
 const blocked={get:async()=>{const e=new Error('Request failed with status code 405');e.response={status:405,data:html};throw e;}};
 await assert.rejects(()=>new HttpSubscriptionDrive(blocked,0).target('secret','123'),/风控/);
 await assert.rejects(()=>new HttpSubscriptionDrive({get:async()=>({data:html})},0).source('secret',c),/风控/);
 await assert.rejects(()=>new HttpSubscriptionDrive({get:async()=>({data:{state:false,error:'操作过于频繁，请稍后再试'}})},0).target('secret','123'),/风控/);
 await assert.rejects(()=>new HttpSubscriptionDrive({post:async()=>({data:html})},0).receive('secret',c,file(1)),/风控/);
 assert.equal(parseBody(html),html); assert.equal(parseBody('{"fid":3543113950444913826}').fid,'3543113950444913826');
 const times=[];const api={get:async(_,opts)=>{times.push(Date.now());const o=opts.params.offset;return {data:{state:true,path:[{cid:'123'}],count:2,data:[{fid:String(o+1),cid:'123',n:'S01E0'+(o+1)+'.mkv'}]}}}};
 assert.equal((await new HttpSubscriptionDrive(api,200).target('secret','123')).files.length,2);
 assert.equal(times.length,2); assert.ok(times[1]-times[0]>=190);
});
test('风控时本轮停止且不暂停订阅，同批其余检查冷却后再跑',async()=>{
 await reset();const f=fixture();const s=await sub();await s.update({initialized:true});
 const s2=await Subscription.create({userId:'u',config:{...c,targetCid:'456'}});
 f.engine.deps.drive.source=async()=>{throw new Error(RISK_CONTROL)};
 await f.engine.enqueue('u',s.get().id);await new Promise((r)=>setTimeout(r,5));await f.engine.enqueue('u',s2.get().id);
 await f.engine.drain();
 await s.reload();assert.equal(s.get().enabled,true);assert.match(s.get().lastError,/风控/);
 assert.equal(await SubscriptionRun.count({where:{state:'failed'}}),1);
 assert.equal(await SubscriptionRun.count({where:{state:'queued'}}),1);
 await f.engine.drain();assert.equal(await SubscriptionRun.count({where:{state:'queued'}}),1);
 f.engine.cooldownUntil=0;f.engine.deps.drive.source=async()=>({files:[file(1)],path:''});
 await f.engine.drain();assert.equal(await SubscriptionRun.count({where:{state:'queued'}}),0);assert.equal(f.writes(),1);
});
test('转存遇到风控即停止，不继续发送后续集，账本保留待核实',async()=>{
 await reset();const f=fixture();const s=await sub();f.setSource([file(1),file(2),file(3)]);
 let sent=0;f.engine.deps.drive.receive=async()=>{sent++;throw new Error(RISK_CONTROL)};
 await run(f,s);
 assert.equal(sent,1);assert.equal(await SubscriptionEntry.count({where:{state:'uncertain'}}),1);
 await s.reload();assert.equal(s.get().enabled,true);assert.match(s.get().lastError,/风控/);
});
test('OneStrm仅明确拒绝才判失败，兼容无success字段的回应',async()=>{
 require('reflect-metadata');
 const { OneStrmService } = require('../dist/services/OneStrmService');
 const svc=new OneStrmService();
 svc.getConfig=async()=>({baseUrl:'http://onestrm.test',token:'t',username:'',password:'',path:'/emby',enabled:true});
 const reply=(r)=>{svc.api={post:async()=>{if(r instanceof Error)throw r;return {data:r};}};return svc.triggerConfiguredScan();};
 assert.equal((await reply({code:200,msg:'ok'})).triggered,true);
 assert.equal((await reply({success:true})).triggered,true);
 assert.equal((await reply({success:false,message:'token无效'})).triggered,false);
 assert.equal((await reply(new Error('ECONNREFUSED'))).triggered,false);
});
