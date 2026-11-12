const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pansou-order-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tmp, 'test.sqlite');
process.env.PANSOU_CLOUD_TYPES = '115,magnet';
require('reflect-metadata');
const { ResourceController } = require('../dist/controllers/resource');
const db = require('../dist/config/database').default;
after(async()=>{ await db.close(); fs.rmSync(tmp,{recursive:true,force:true}); });

const group = (id) => ({ id, channelInfo: { channelId: id, name: id, channelLogo: '' }, list: [{ title: id }] });
const searchGroups = async (pansou) => {
  const searcher = { searchAll: async () => ({ data: [group('tg_a'), group('tg_b')] }) };
  const pansouSearcher = { search: async (_keyword, type) => pansou[type] || [] };
  let body;
  const res = { status() { return res; }, json(value) { body = value; } };
  await new ResourceController(searcher, pansouSearcher).search({ query: { keyword: '庆余年' } }, res);
  assert.ok(Array.isArray(body?.data), JSON.stringify(body));
  return body.data.map((item) => [item.id, item.channelInfo.name]);
};

test('115 网盘排在最前、磁力链接排在最后，TG 频道保持原顺序', async () => {
  assert.deepEqual(await searchGroups({ '115': [{ title: '115' }], magnet: [{ title: 'magnet' }] }), [
    ['pansou_115', 'PanSou · 115网盘'],
    ['tg_a', 'tg_a'],
    ['tg_b', 'tg_b'],
    ['pansou_magnet', 'PanSou · 磁力链接'],
  ]);
});

test('没有 115 结果时 TG 频道在前，磁力链接仍在最后', async () => {
  assert.deepEqual((await searchGroups({ magnet: [{ title: 'magnet' }] })).map(([id]) => id), ['tg_a', 'tg_b', 'pansou_magnet']);
});

test('加载更多只翻对应 TG 频道，不再重复查 PanSou', async () => {
  const calls = [];
  const searcher = { searchAll: async (...args) => { calls.push(['tg', ...args]); return { data: [group('tg_a')] }; } };
  const pansouSearcher = { search: async (_keyword, type) => { calls.push(['pansou', type]); return [{ title: type }]; } };
  let body;
  const res = { status() { return res; }, json(value) { body = value; } };
  const query = { keyword: '庆余年', channelId: 'tg_a', lastMessageId: '42' };
  await new ResourceController(searcher, pansouSearcher).search({ query }, res);
  assert.deepEqual(body.data.map((item) => item.id), ['tg_a']);
  assert.deepEqual(calls, [['tg', '庆余年', 'tg_a', '42']]);
});
