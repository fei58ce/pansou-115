import assert from "node:assert/strict";
import { test } from "node:test";
import type { Resource, ResourceItem } from "../src/types/index.ts";
import {
  SUMMARY_115_ID,
  appendToSummary115,
  resourceStats,
  tagLabel,
  withSummary115,
} from "../src/utils/resource.ts";

const item = (title: string, links: string[], extra: Partial<ResourceItem> = {}): ResourceItem => ({
  id: "",
  title,
  channel: "",
  cloudLinks: links,
  cloudType: "pan115",
  pubDate: "2026-11-01T00:00:00Z",
  ...extra,
});

const group = (id: string, name: string, list: ResourceItem[]): Resource => ({
  id,
  channelInfo: { channelId: id, name, channelLogo: "" },
  list,
});

const sample = () => [
  group("pansou_115", "PanSou · 115网盘", [
    item("P1", ["https://115cdn.com/s/swAAA?password=ab12"], {
      id: "pansou-115-0",
      linkStatus: "ok",
    }),
  ]),
  group("chA", "频道A", [
    item("A-old", ["https://115.com/s/swBBB"], { messageId: "10" }),
    item("A-quark", ["https://pan.quark.cn/s/xyz"], { messageId: "11", cloudType: "quark" }),
  ]),
  group("chB", "频道B", [
    item("B-new", ["https://pan.quark.cn/s/q", "https://anxia.com/s/swCCC"], {
      messageId: "10",
      cloudType: "quark",
      pubDate: "2026-11-05T00:00:00Z",
    }),
    item("B-dup", ["https://115.com/s/SWAAA"], {
      messageId: "12",
      pubDate: "2026-11-06T00:00:00Z",
    }),
  ]),
  group("pansou_magnet", "PanSou · 磁力链接", [
    item("M", ["magnet:?xt=urn:btih:abc"], { cloudType: "magnet" }),
  ]),
];

test("汇总放最前：PanSou 在前，频道条目新到旧，同一分享码只留一条", () => {
  const groups = sample();
  const result = withSummary115(groups);
  assert.deepEqual(
    result.map((g) => g.id),
    [SUMMARY_115_ID, "chA", "chB", "pansou_magnet"]
  );
  const [summary] = result;
  assert.equal(summary.displayList, true);
  assert.deepEqual(
    summary.list.map((i) => [i.title, i.sourceName]),
    [
      ["P1", "PanSou"],
      ["B-new", "频道B"],
      ["A-old", "频道A"],
    ]
  );
  assert.equal(summary.list[0].linkStatus, "ok");

  const bNew = summary.list[1];
  assert.equal(bNew.cloudType, "pan115");
  assert.equal(bNew.cloudLinks[0], "https://anxia.com/s/swCCC");
  assert.equal(bNew.isSupportSave, true);
  assert.notEqual(bNew.id, summary.list[2].id, "不同频道的同号消息 key 不能撞");

  const chB = result.find((g) => g.id === "chB");
  assert.equal(chB?.list[0].cloudType, "quark", "频道里的原条目不动");
  assert.equal(chB?.list.length, 2);
});

test("对已带汇总的列表再调用结果不变，PanSou 条目不丢", () => {
  const once = withSummary115(sample());
  once[0].displayList = false;
  assert.deepEqual(withSummary115(once), once);
});

test("没有 115 链接就不加汇总", () => {
  const groups = [group("chQ", "夸克频道", [item("Q", ["https://pan.quark.cn/s/1"])])];
  assert.deepEqual(
    withSummary115(groups).map((g) => g.id),
    ["chQ"]
  );
});

test("翻页拿到的 115 条目接到汇总末尾，原地修改", () => {
  const groups = withSummary115([sample()[1]]);
  appendToSummary115(groups, groups[1], [
    item("A-newer", ["https://115.com/s/swDDD"], {
      messageId: "9",
      pubDate: "2026-12-01T00:00:00Z",
    }),
    item("A-dup", ["https://115.com/s/swBBB"], { messageId: "8" }),
    item("A-q", ["https://pan.quark.cn/s/z"], { messageId: "7" }),
  ]);
  assert.deepEqual(
    groups[0].list.map((i) => i.title),
    ["A-old", "A-newer"]
  );

  const noSummary = [group("chQ", "夸克频道", [item("Q", ["https://pan.quark.cn/s/1"])])];
  appendToSummary115(noSummary, noSummary[0], [item("Q-115", ["https://115.com/s/swEEE"])]);
  assert.deepEqual(
    noSummary.map((g) => g.id),
    [SUMMARY_115_ID, "chQ"]
  );
});

test("统计不重复算频道条目，PanSou 仍算一个来源", () => {
  assert.deepEqual(resourceStats(withSummary115(sample())), {
    sources: 4,
    total: 6,
    count115: 3,
  });
});

test("频道标签自带 # 时不再重复", () => {
  assert.equal(tagLabel("#电视剧"), "#电视剧");
  assert.equal(tagLabel("电影"), "#电影");
});
