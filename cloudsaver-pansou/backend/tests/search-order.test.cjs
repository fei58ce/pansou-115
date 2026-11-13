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
const { Searcher } = require('../dist/services/Searcher');
const { PansouSearcher } = require('../dist/services/PansouSearcher');
const { config } = require('../dist/config');
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

const tgPage = (channel) => `<div class="tgme_header_link"><img src="https://cdn4.telesco.pe/${channel}.jpg"></div>
<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="${channel}/42"><div class="tgme_widget_message_text js-message_text">${channel} 资源<br><a href="https://115cdn.com/s/${channel}">https://115cdn.com/s/${channel}</a></div><time datetime="2026-11-12T00:00:00+00:00"></time></div></div>`;

test('TG 频道按配置顺序返回，同一关键词短时间内不重复请求，失败的不缓存', async () => {
  config.telegram.channels = [{ id: 'slow', name: '慢频道' }, { id: 'fast', name: '快频道' }, { id: 'down', name: '连不上的频道' }];
  const searcher = new Searcher();
  const calls = [];
  searcher.api = {
    get: async (url) => {
      calls.push(url);
      const channel = url.split('?')[0].slice(1);
      if (channel === 'down') throw new Error('ECONNRESET');
      await new Promise((resolve) => setTimeout(resolve, channel === 'slow' ? 30 : 0));
      return { data: tgPage(channel) };
    },
  };
  const first = await searcher.searchAll('繁花');
  assert.deepEqual(first.data.map((group) => group.id), ['slow', 'fast']);
  assert.deepEqual(first.data[0].list[0].cloudLinks, ['https://115cdn.com/s/slow']);
  assert.equal(calls.length, 3);
  const second = await searcher.searchAll('繁花');
  assert.deepEqual(second.data.map((group) => group.id), ['slow', 'fast']);
  assert.deepEqual(calls.slice(3), ['/down?q=%E7%B9%81%E8%8A%B1&']);
  await searcher.searchAll('繁花', 'slow', '42');
  assert.deepEqual(calls.slice(4), ['/slow?q=%E7%B9%81%E8%8A%B1&before=42']);
});

const noPoster = { searchPoster: async () => '' };
const pansouLinks = (urls) => ({
  data: { data: { merged_by_type: { '115': urls.map((url, i) => ({ url, note: `资源 ${i}`, images: [`https://img.example/${i}.jpg`] })) } } },
});
const checkReply = (body, state) => ({ data: { results: body.items.map(({ url }) => ({ url, state: state(url) })) } });

test('115 探活结果按链接缓存：坏链直接过滤，只把没缓存的链接发去探活', async () => {
  const searcher = new PansouSearcher(noPoster, noPoster);
  const urls = ['https://115cdn.com/s/ok', 'https://115cdn.com/s/bad', 'https://115cdn.com/s/unsure'];
  const states = { ok: 'ok', bad: 'bad', unsure: 'uncertain' };
  const checked = [];
  searcher.api = {
    get: async () => pansouLinks(urls),
    post: async (_path, body) => {
      checked.push(body.items.map((item) => item.url));
      return checkReply(body, (url) => states[url.split('/').pop()]);
    },
  };
  const statuses = async () => (await searcher.search('繁花', '115')).map((item) => [item.cloudLinks[0], item.linkStatus]).sort();
  const alive = [[urls[0], 'ok'], [urls[2], 'uncertain']];
  assert.deepEqual(await statuses(), alive);
  assert.deepEqual(await statuses(), alive);
  assert.deepEqual(checked, [urls, [urls[2]]]);
});

test('探活超过 30 秒先返回结果，后台探完写进缓存，再搜直接过滤坏链', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const searcher = new PansouSearcher(noPoster, noPoster);
  const urls = ['https://115cdn.com/s/ok', 'https://115cdn.com/s/bad'];
  let release;
  let posts = 0;
  searcher.api = {
    get: async () => pansouLinks(urls),
    post: (_path, body) => {
      posts++;
      return new Promise((resolve) => {
        release = () => resolve(checkReply(body, (url) => (url.endsWith('bad') ? 'bad' : 'ok')));
      });
    },
  };
  const first = searcher.search('繁花', '115');
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(30000);
  assert.equal((await first).length, 2);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual((await searcher.search('繁花', '115')).map((item) => item.cloudLinks[0]), [urls[0]]);
  assert.equal(posts, 1);
});

test('补海报前把资源名洗成片名：去掉分类前缀、括号和发布信息，有中文名只取中文名', () => {
  const searcher = new PansouSearcher(noPoster, noPoster);
  const cases = [
    ['庆余年.全46集.4K.国语中字.60.25GB【国产剧】', '庆余年'],
    ['庆余年第一季][2019][4K][全46集][60.2GB][WEB-DL][H.265][国语][57.69GB]', '庆余年'],
    ['📺 电视剧｜庆余年 (2019) S01-S02 4K 普码', '庆余年'],
    ['流浪地球.2019.BD1080P.国英双语.中英双字【17.38GB】【纯净版】【国内电影】', '流浪地球'],
    ['流浪地球.V2版.2019.BD1080P.国语中英字【28.49GB】【纯净版】【国内电影】', '流浪地球'],
    ['🎬 电影｜流浪地球2 (2023) 2160P.Ultra HD BluRay Remux.DoVi', '流浪地球2'],
    ['流浪地球2：再次冒险 (2024) WEB-DL 2160p 2.11G', '流浪地球2'],
    ['繁花(2023)【30集全】【4K.高码率】【杜比视界】【国沪双语】【胡歌/马伊琍】', '繁花'],
    ['【庆余年】全46集', '庆余年'],
    ['【4K】【国产剧】庆余年 更新至36集', '庆余年'],
    ['庆余年 Joy of Life S01', '庆余年'],
    ['名称：繁花 4K', '繁花'],
    ['The.Wandering.Earth.II.2023.2160p.WEB-DL.DDP5.1.Atmos.H.265', 'The Wandering Earth II'],
    ['Inferno.2016.1080p.BluRay', 'Inferno'],
    ['1917.2019.2160p.BluRay', '1917'],
    ['🎞️ 动画电影｜哪吒之魔童降世 (2019) [美版4K原盘REMUX 双格式', '哪吒之魔童降世'],
    ['名称: 哪吒之魔童降世➕哪吒之魔童闹海 美版4K原盘REMUX 杜比视界', '哪吒之魔童降世'],
    ['名称: 哪吒2各版本合集', '哪吒2'],
    ['哪吒之魔童降世.字幕修复.1080P&2160P 国语中英双字【29.51GB】【纯净版】', '哪吒之魔童降世'],
    ['🎬 电影：西部世界 (1973)', '西部世界'],
    ['日本动漫 葬送的芙莉莲 全28集', '葬送的芙莉莲'],
    ['沙丘 (2021)原盘', '沙丘'],
    ['网盘分享 abc123', ''],
  ];
  assert.deepEqual(cases.map(([raw]) => [raw, searcher.extractMediaTitle(raw)]), cases);
});

test('没图的 115 条目拿洗过的片名查一次海报，没有说明的分享链接不去查', async () => {
  const asked = [];
  const tmdb = { searchPoster: async (title) => { asked.push(title); return `https://image.tmdb.org/t/p/w500/${title}.jpg`; } };
  const searcher = new PansouSearcher(tmdb, noPoster);
  const notes = ['庆余年.全46集.4K.国语中字.60.25GB【国产剧】', '📺 电视剧｜庆余年 (2019) S01-S02 4K 普码', ''];
  searcher.api = {
    get: async () => ({ data: { data: { merged_by_type: { '115': notes.map((note, i) => ({ url: `https://115cdn.com/s/p${i}`, note })) } } } }),
    post: async (_path, body) => checkReply(body, () => 'ok'),
  };
  const items = await searcher.search('庆余年', '115');
  assert.deepEqual(asked, ['庆余年']);
  const poster = 'https://image.tmdb.org/t/p/w500/庆余年.jpg';
  assert.deepEqual(items.map((item) => [item.cloudLinks[0].split('/').pop(), item.image]).sort(), [['p0', poster], ['p1', poster], ['p2', '']]);
});
