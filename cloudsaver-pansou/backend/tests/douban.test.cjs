const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DoubanService } = require('../dist/services/DoubanService');

const params = { type: 'tv', tag: '热门', page_limit: '20', page_start: '0' };
const subjects = (title) => ({ data: { subjects: [{ id: '1', title }] } });
const stalled = () => Object.assign(new Error('timeout of 8000ms exceeded'), { code: 'ECONNABORTED' });
const stub = (service, replies) => {
 const calls = [];
 service.api = { get: async (url, config) => { calls.push([url, config]); const next = replies.shift(); if (next instanceof Error) throw next; return next; } };
 return calls;
};
const settle = (service) => Promise.allSettled([...service.pendingHotLists.values()]);

test('豆瓣榜单：单次请求卡住就重试，成功后缓存',async()=>{
 const service=new DoubanService();
 const calls=stub(service,[stalled(),subjects('A')]);
 assert.deepEqual((await service.getHotList(params)).data,[{ id:'1', title:'A' }]);
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0],['/search_subjects',{ params, timeout:8000 }]);
 assert.deepEqual((await service.getHotList(params)).data,[{ id:'1', title:'A' }]);
 assert.equal(calls.length,2);
});

test('豆瓣榜单：最多请求 3 次，全部失败给出中文提示',async()=>{
 const service=new DoubanService();
 const calls=stub(service,[stalled(),stalled(),stalled(),subjects('never')]);
 await assert.rejects(service.getHotList(params),{ message:'豆瓣暂时连不上，请稍后重试' });
 assert.equal(calls.length,3);
});

test('豆瓣榜单：缓存过期先给旧数据并后台刷新，刷新失败继续用旧数据',async()=>{
 const service=new DoubanService();
 const calls=stub(service,[subjects('old'),stalled(),stalled(),stalled(),subjects('new')]);
 await service.getHotList(params);
 for (const entry of service.hotLists.values()) entry.at-=31*60*1000;
 assert.equal((await service.getHotList(params)).data[0].title,'old');
 await settle(service);
 assert.equal(calls.length,4);
 assert.equal((await service.getHotList(params)).data[0].title,'old');
 await settle(service);
 assert.equal((await service.getHotList(params)).data[0].title,'new');
 assert.equal(calls.length,5);
});

test('豆瓣榜单：同一榜单并发请求只请求豆瓣一次',async()=>{
 const service=new DoubanService();
 let release;
 let count=0;
 service.api={ get:()=>{ count++; return new Promise((resolve)=>{ release=()=>resolve(subjects('A')); }); } };
 const both=Promise.all([service.getHotList(params),service.getHotList(params)]);
 release();
 const [a,b]=await both;
 assert.equal(count,1);
 assert.deepEqual(a,b);
});

test('豆瓣榜单：缓存最多 100 个榜单，超出时先淘汰最早的',async()=>{
 const service=new DoubanService();
 let count=0;
 service.api={ get:async()=>{ count++; return subjects('x'); } };
 for (let i=0;i<=100;i++) await service.getHotList({ ...params, page_start:String(i*20) });
 assert.equal(count,101);
 await service.getHotList({ ...params, page_start:'2000' });
 assert.equal(count,101);
 await service.getHotList({ ...params, page_start:'0' });
 assert.equal(count,102);
});

test('豆瓣补图：单次最多等 6 秒，失败返回空',async()=>{
 const service=new DoubanService();
 const calls=stub(service,[stalled()]);
 assert.equal(await service.searchPoster('繁花'),'');
 assert.deepEqual(calls[0],['/subject_suggest',{ params:{ q:'繁花' }, timeout:6000 }]);
});
