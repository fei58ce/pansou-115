// UI-only mock backend. No real accounts, 115 writes, or scheduler are used.
const express = require('express');
const path = require('node:path');
const app = express(); app.use(express.json());
let records=[];
app.post('/api/user/login',(_,res)=>res.json({code:0,data:{token:'ui-test-only'}}));
app.get('/api/setting/get',(_,res)=>res.json({code:0,data:{globalSetting:null,userSettings:{cloud115Cookie:'',quarkCookie:''}}}));
app.get('/api/cloud115/folders',(req,res)=>res.json({code:0,data:req.query.parentCid==='0'?[{cid:'100',name:'测试剧',path:[{cid:'0',name:'根目录'}]}]:req.query.parentCid==='100'?[{cid:'101',name:'Season 01',path:[{cid:'0',name:'根目录'},{cid:'100',name:'测试剧'}]}]:[]}));
app.get('/api/subscriptions',(_,res)=>res.json({code:0,data:records}));
app.post('/api/subscriptions/save',(req,res)=>{const c=req.body; records=[{id:'ui-sub',config:{...c,shareCode:'abc'},enabled:true,initialized:false,lastChecked:'',nextCheck:'2026-11-13T10:00:00Z',confirmed:0,uncertain:0,latestRun:null}];res.json({code:0,data:records[0]});});
app.post('/api/subscriptions/:id/check',(_,res)=>{records[0].initialized=true;records[0].latestRun={id:'ui-run',state:'done',report:['模拟数据：基线已建立，本次不转存'],startedAt:new Date().toISOString()};res.json({code:0,data:records[0].latestRun});});
app.get('/api/subscriptions/:id/history',(_,res)=>res.json({code:0,data:{runs:records[0]?.latestRun?[records[0].latestRun]:[],entries:[]}}));
app.post('/api/subscriptions/:id/state',(req,res)=>{records[0].enabled=req.body.enabled;res.json({code:0,data:true});});
app.use(express.static(path.resolve(__dirname,'../dist')));
app.get('*',(_,res)=>res.sendFile(path.resolve(__dirname,'../dist/index.html')));
app.listen(18088,'127.0.0.1',()=>console.log('UI-only preview on http://127.0.0.1:18088'));
