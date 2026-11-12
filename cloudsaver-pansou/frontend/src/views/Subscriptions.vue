<template>
  <section class="follow-page">
    <header class="follow-header">
      <div>
        <h2>我的追更</h2>
        <p>每天北京时间18:00检查一次 · 仅补缺集 · 不删除或覆盖旧文件</p>
      </div>
      <button @click="create">＋ 关注影片</button>
    </header>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <div class="tools">
      <button :disabled="busy" @click="load">刷新状态</button
      ><span>关闭网页后，服务器仍会检查已启用的订阅。</span>
    </div>
    <p v-if="!items.length && !busy" class="empty">
      还没有订阅。可从115搜索结果点击“关注追更”，再绑定具体季目录。
    </p>
    <article v-for="item in items" :key="item.id" class="follow-card">
      <div class="follow-title">
        <h3>{{ item.config.title }} · 第{{ item.config.season }}季</h3>
        <strong>{{ item.enabled ? "追更中" : "已暂停" }}</strong>
      </div>
      <p>
        保存至：{{ item.config.targetPath }} <small>（ID: {{ item.config.targetCid }}）</small>
      </p>
      <p>下次：{{ time(item.nextCheck) }} · 最近检查：{{ time(item.lastChecked) }}</p>
      <p>
        本站确认转存 {{ item.confirmed }} 集 · 结果待核实 {{ item.uncertain }} 项 ·
        {{ item.initialized ? "基线已建立" : "待首次检查建立基线" }}
      </p>
      <p v-if="item.latestRun">最近任务：{{ stateLabel(item.latestRun.state) }}</p>
      <p v-if="item.lastError" class="error">{{ item.lastError }}</p>
      <div class="actions">
        <button :disabled="busy || !item.enabled" @click="check(item)">立即检查</button>
        <button :disabled="busy" @click="toggle(item)">{{ item.enabled ? "暂停" : "恢复" }}</button>
        <button :disabled="busy" @click="edit(item)">编辑</button>
        <button :disabled="busy" @click="showHistory(item)">查看记录</button>
        <button :disabled="busy" @click="remove(item)">移除关注</button>
      </div>
    </article>
    <div
      v-if="editing"
      class="follow-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="关注追更设置"
    >
      <form class="follow-form" @submit.prevent="save">
        <header>
          <h3>{{ form.id ? "编辑追更" : "关注追更" }}</h3>
          <button type="button" :disabled="busy" @click="editing = false">关闭</button>
        </header>
        <p>
          只追同作品同季的新集；含多个剧集的分享请选择具体源目录。首次检查在18:00进行，也可保存后立即检查。
        </p>
        <label
          >作品准确名称<input
            v-model="form.title"
            required
            minlength="2"
            maxlength="100"
            placeholder="删除广告、清晰度及集数，只留片名"
        /></label>
        <label>别名（英文逗号分隔，可选）<input v-model="form.aliasText" /></label>
        <div class="two">
          <label
            >季数<input
              v-model.number="form.season"
              type="number"
              min="1"
              max="99"
              required /></label
          ><label>年份（可选）<input v-model="form.year" placeholder="2026" maxlength="4" /></label>
        </div>
        <label
          >115分享链接<input v-model="form.shareUrl" required placeholder="https://115.com/s/..."
        /></label>
        <div class="two">
          <label>提取码<input v-model="form.receiveCode" maxlength="32" /></label
          ><label
            >分享内源目录ID<input
              v-model="form.sourceCid"
              required
              pattern="[0-9]+"
              placeholder="0表示分享根目录"
          /></label>
        </div>
        <label>目标目录（必须是该剧的具体季目录）</label>
        <div class="folder-picker">
          <div class="crumbs">
            <button type="button" :disabled="folderLoading" @click="foldersAt('0')">根目录</button
            ><button
              v-for="p in ancestors"
              :key="p.cid"
              type="button"
              :disabled="folderLoading"
              @click="foldersAt(p.cid)"
            >
              {{ p.name }}
            </button>
          </div>
          <p v-if="folderError" class="error">{{ folderError }}</p>
          <p v-if="folderLoading">正在读取115目录…</p>
          <div class="folder-list">
            <button
              v-for="f in folders"
              :key="f.cid"
              type="button"
              :disabled="folderLoading"
              @click="enterFolder(f)"
            >
              📁 {{ f.name }}
            </button>
          </div>
          <button
            type="button"
            :disabled="folderLoading || currentCid === '0' || !!folderError"
            @click="chooseFolder"
          >
            使用当前目录
          </button>
          <p>已选：{{ form.targetPath || "未选择" }}</p>
        </div>
        <div class="two">
          <label
            >清晰度<select v-model="form.quality">
              <option value="">不限</option>
              <option value="1080p">1080p</option>
              <option value="2160p">4K / 2160p</option>
            </select></label
          ><label
            >字幕/版本必含文字<input
              v-model="form.requiredText"
              placeholder="如：简中（可留空）"
              maxlength="80"
          /></label>
        </div>
        <label
          >首次检查<select v-model="form.mode">
            <option value="future">仅后续新增（先建立基线）</option>
            <option value="backfill">补齐缺集</option>
          </select></label
        >
        <label class="checkbox"
          ><input
            v-model="form.searchFallback"
            type="checkbox"
          />启用搜索补充来源（严格匹配，不确定项只记录）</label
        >
        <p v-if="form.id">修改配置会重新建立基线。存在运行任务或待核实转存时禁止修改。</p>
        <p v-if="formError" role="alert" class="error">{{ formError }}</p>
        <button type="submit" :disabled="busy || !form.targetCid">
          {{ busy ? "校验目录中…" : "保存订阅" }}
        </button>
      </form>
    </div>
    <div
      v-if="history"
      class="follow-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="追更记录"
    >
      <div class="follow-form">
        <header>
          <h3>追更记录</h3>
          <button @click="history = null">关闭</button>
        </header>
        <p>“已通知OneStrm”不代表STRM已生成；此处不使用模糊标题日志判定成功。</p>
        <div v-for="entry in history.entries" :key="entry.key" class="entry">
          第{{ entry.episode }}集 ·
          {{ entry.state === "confirmed" ? "转存已确认" : "结果待核实（不会重发）" }}<br />{{
            entry.file.name
          }}<br />{{ entry.notified ? "OneStrm已通知，STRM待核实" : "尚未确认通知OneStrm" }}
        </div>
        <article v-for="run in history.runs" :key="run.id">
          <h4>{{ stateLabel(run.state) }} · {{ time(run.startedAt) }}</h4>
          <ul>
            <li v-for="(line, index) in run.report" :key="index">{{ line }}</li>
          </ul>
        </article>
        <p v-if="!history.runs.length">暂无检查记录</p>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  subscriptionsApi,
  type Follow,
  type FollowRun,
  type FollowEntry,
} from "@/api/subscriptions";
import { cloud115Api } from "@/api/cloud115";
import type { Folder } from "@/types";
const route = useRoute();
const router = useRouter();
const items = ref<Follow[]>([]),
  busy = ref(false),
  editing = ref(false);
const error = ref(""),
  message = ref(""),
  formError = ref("");
const history = ref<{ runs: FollowRun[]; entries: FollowEntry[] } | null>(null);
const fresh = () => ({
  id: "",
  title: "",
  aliasText: "",
  year: "",
  season: 1,
  quality: "",
  requiredText: "",
  shareUrl: "",
  receiveCode: "",
  sourceCid: "0",
  targetCid: "",
  targetPath: "",
  mode: "future",
  searchFallback: true,
});
const form = reactive(fresh());
const folders = ref<Folder[]>([]),
  ancestors = ref<Folder[]>([]),
  currentCid = ref("0");
const folderLoading = ref(false),
  folderError = ref("");
let folderGeneration = 0;
const time = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) +
      " 北京时间"
    : "—";
const stateLabel = (s: string) =>
  ({
    queued: "排队中",
    running: "检查中",
    done: "检查完成",
    failed: "检查失败",
    canceled: "已取消",
    interrupted: "运行中断，待核实",
    skipped: "本日已有任务",
  })[s] || s;
async function load() {
  try {
    items.value = await subscriptionsApi.list();
    error.value = "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}
async function foldersAt(cid: string, known?: Folder[]) {
  const gen = ++folderGeneration;
  folderLoading.value = true;
  folderError.value = "";
  try {
    const result = await cloud115Api.getFolderList(cid);
    if (gen !== folderGeneration) return;
    if (result.code !== 0) throw new Error(result.message || "目录读取失败");
    folders.value = result.data || [];
    currentCid.value = cid;
    ancestors.value =
      known ||
      folders.value[0]?.path?.filter((p) => p.cid !== "0") ||
      (cid === "0"
        ? []
        : ancestors.value.slice(0, ancestors.value.findIndex((p) => p.cid === cid) + 1));
  } catch (e) {
    folderError.value = e instanceof Error ? e.message : "目录读取失败";
  } finally {
    if (gen === folderGeneration) folderLoading.value = false;
  }
}
function enterFolder(f: Folder) {
  void foldersAt(f.cid, [...ancestors.value, { cid: f.cid, name: f.name }]);
}
function chooseFolder() {
  form.targetCid = currentCid.value;
  form.targetPath = "/" + ancestors.value.map((p) => p.name).join("/");
}
function create() {
  Object.assign(form, fresh());
  formError.value = "";
  editing.value = true;
  void foldersAt("0");
}
function edit(item: Follow) {
  Object.assign(form, fresh(), item.config, {
    id: item.id,
    aliasText: item.config.aliases.join(","),
    shareUrl: "https://115.com/s/" + item.config.shareCode,
  });
  formError.value = "";
  editing.value = true;
  void foldersAt("0");
}
async function save() {
  busy.value = true;
  formError.value = "";
  try {
    await subscriptionsApi.save({
      ...form,
      aliases: form.aliasText
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
    editing.value = false;
    message.value = "订阅已保存；每天18:00检查，也可点击立即检查。";
    await router.replace("/subscriptions");
    await load();
  } catch (e) {
    formError.value = e instanceof Error ? e.message : "保存失败";
  } finally {
    busy.value = false;
  }
}
async function action(fn: () => Promise<unknown>) {
  busy.value = true;
  try {
    await fn();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "操作失败";
  } finally {
    busy.value = false;
  }
}
const check = (item: Follow) =>
  action(async () => {
    await subscriptionsApi.check(item.id);
    message.value = "检查已排队，可关闭页面。稍后查看记录。";
  });
const toggle = (item: Follow) => action(() => subscriptionsApi.state(item.id, !item.enabled));
const remove = (item: Follow) => {
  if (window.confirm("移除关注？不会删除115视频。"))
    void action(() => subscriptionsApi.state(item.id, false, true));
};
const showHistory = (item: Follow) =>
  action(async () => {
    history.value = await subscriptionsApi.history(item.id);
  });
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  void load();
  if (typeof route.query.share === "string") {
    create();
    form.shareUrl = route.query.share;
    form.title =
      typeof route.query.title === "string"
        ? route.query.title.replace(/^名称\s*[:：]\s*/, "").slice(0, 100)
        : "";
  }
  timer = setInterval(() => {
    if (!document.hidden && !busy.value && !editing.value) void load();
  }, 15000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
  folderGeneration++;
});
</script>
<style scoped>
.follow-page {
  box-sizing: border-box;
  padding: 1rem;
  width: 100%;
  height: 100%;
  overflow: auto;
  color: #263445;
  background: #f6f8fb;
}
.follow-header,
.follow-title,
.follow-form header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
h2,
h3 {
  margin: 0.4em 0;
}
p {
  line-height: 1.6;
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}
button {
  border: 1px solid #cbd5e1;
  background: #fff;
  padding: 0.6em 0.9em;
  border-radius: 0.45em;
  cursor: pointer;
  color: #1853a0;
  font: inherit;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.tools,
.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}
.tools {
  margin-bottom: 1rem;
  font-size: 0.85rem;
}
.follow-card {
  padding: 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.8rem;
  margin-bottom: 1rem;
}
strong {
  color: #197346;
}
.error {
  color: #b42318;
}
.empty {
  padding: 2rem;
  text-align: center;
}
.follow-overlay {
  position: fixed;
  inset: 0;
  background: #12213899;
  z-index: 4000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
  padding: 2vh 1rem;
  box-sizing: border-box;
}
.follow-form {
  box-sizing: border-box;
  background: white;
  border-radius: 0.8rem;
  padding: 1.3rem;
  width: min(42rem, 100%);
  max-height: 94dvh;
  overflow: auto;
}
label {
  display: block;
  margin: 0.6rem 0;
  font-size: 0.9rem;
}
input,
select {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: 0.65em;
  border: 1px solid #b8c4d3;
  border-radius: 0.4em;
  font: inherit;
  margin-top: 0.35em;
}
.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
}
.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5em;
}
.checkbox input {
  width: auto;
}
.folder-picker {
  border: 1px solid #dce3eb;
  padding: 0.7rem;
  border-radius: 0.5rem;
}
.crumbs,
.folder-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.folder-list {
  max-height: 10rem;
  overflow: auto;
  margin: 0.5rem 0;
}
.entry {
  border-bottom: 1px solid #ddd;
  padding: 0.7rem 0;
  overflow-wrap: anywhere;
}
@media (max-width: 768px) {
  .follow-page {
    font-size: 14px;
    padding: 12px;
    padding-bottom: 80px;
  }
  .follow-form {
    font-size: 14px;
    padding: 16px;
  }
  p,
  label,
  .tools {
    font-size: inherit;
  }
  .two {
    grid-template-columns: 1fr;
    gap: 0;
  }
  h2 {
    font-size: 20px;
  }
  h3 {
    font-size: 18px;
  }
  .follow-overlay {
    padding: 8px;
  }
  .follow-card {
    padding: 12px;
  }
  .actions {
    gap: 6px;
  }
  .folder-list {
    max-height: 160px;
  }
}
@media (max-width: 768px) {
  .follow-header,
  .follow-title,
  .follow-form header {
    gap: 12px;
  }
  .follow-card {
    margin-bottom: 12px;
  }
  .follow-form label {
    margin: 10px 0;
  }
  .follow-form input,
  .follow-form select {
    margin-top: 5px;
  }
  .folder-picker {
    padding: 10px;
  }
  .crumbs,
  .folder-list {
    gap: 6px;
  }
  .folder-list {
    margin: 8px 0;
  }
}
</style>
