<template>
  <div class="lixian-page">
    <div class="page-header">
      <div>
        <div class="title">115 离线任务</div>
        <div class="subtitle">仅显示本站提交记录，并关联 STRM 状态</div>
      </div>
      <van-button size="small" :loading="loading || strmLoading" @click="loadTasks">
        刷新
      </van-button>
    </div>

    <van-notice-bar v-if="error" type="danger" :text="error" />

    <div class="strm-card">
      <div class="strm-header">
        <span>OneStrm STRM 状态</span>
        <van-tag v-if="strmStatus" :type="strmStatus.connected ? 'success' : 'default'">
          {{ strmStatus.connected ? "已连接" : "未连接" }}
        </van-tag>
      </div>
      <div v-if="strmError" class="strm-error">{{ strmError }}</div>
      <template v-else-if="strmStatus">
        <div class="strm-summary">{{ strmStatus.message }}</div>
        <div v-if="strmStatus.lastScanAt" class="strm-line">
          最近扫描：{{ strmStatus.lastScanAt }}
        </div>
        <div v-if="strmStatus.lastTaskResult" class="strm-line">
          {{ strmStatus.lastTaskResult }}
        </div>
        <div v-if="strmStatus.recentFiles.length === 0" class="strm-empty">暂无 STRM 生成记录</div>
        <div v-for="file in strmStatus.recentFiles.slice(0, 5)" :key="file.path" class="strm-file">
          <div class="strm-file-name">{{ file.fileName }}</div>
          <div class="strm-file-meta">{{ file.createdAt }}</div>
        </div>
        <van-button size="mini" plain type="primary" :loading="strmLoading" @click="loadStrmStatus">
          刷新状态
        </van-button>
      </template>
    </div>

    <van-empty v-if="!loading && history.length === 0" description="暂无本站提交记录" />

    <van-cell-group v-else inset>
      <van-cell v-for="record in history" :key="record.id" :title="displayName(record)">
        <template #label>
          <div class="record-meta">
            <div>{{ formatTime(record.createdAt) }}</div>
            <div v-if="record.lastError" class="record-error">{{ record.lastError }}</div>
            <div class="record-strm">
              STRM：
              <van-tag :type="record.strm ? 'success' : 'default'">
                {{ record.strm ? "已生成" : "待生成" }}
              </van-tag>
            </div>
            <div v-if="record.strm" class="record-strm-path">
              {{ record.strm.fileName }}
            </div>
            <div class="record-url">{{ record.url }}</div>
          </div>
        </template>
        <template #value>
          <div class="task-value">
            <van-tag :type="statusType(record.status)">{{ record.statusText }}</van-tag>
            <van-progress :percentage="Math.round(record.percent || 0)" :show-pivot="false" />
            <van-button
              v-if="record.status === 3"
              size="mini"
              type="primary"
              plain
              @click.stop="retry(record.id)"
            >
              重试
            </van-button>
            <van-button size="mini" type="primary" plain @click.stop="openRename(record)">
              改名
            </van-button>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <van-dialog
      v-model:show="renameDialogVisible"
      title="重命名 115 文件/文件夹"
      show-cancel-button
      @confirm="confirmRename"
    >
      <van-field v-model="renameValue" label="新名称" placeholder="请输入新的文件名" />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { showToast } from "vant";
import { cloud115QrcodeApi, type LixianHistoryRecord } from "@/api/cloud115Qrcode";
import { oneStrmApi, type OneStrmStrmFile, type OneStrmStrmStatus } from "@/api/oneStrm";

interface LocalHistoryRecord extends LixianHistoryRecord {
  strm?: OneStrmStrmFile;
}

const rawHistory = ref<LixianHistoryRecord[]>([]);
const loading = ref(false);
const error = ref("");
const strmStatus = ref<OneStrmStrmStatus | null>(null);
const strmLoading = ref(false);
const strmError = ref("");
const renameDialogVisible = ref(false);
const renameValue = ref("");
const renameRecordId = ref("");

const statusType = (status: number): "success" | "warning" | "danger" | "primary" => {
  if (status === 2) return "success";
  if (status === 3) return "danger";
  if (status === 1 || status === 5) return "warning";
  return "primary";
};

const formatTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const displayName = (record: LixianHistoryRecord) => {
  const raw = (record.name || "").replace(/^已添加[:：]\s*/, "");
  const cleaned = raw
    .replace(/magnet:\?[^\s]+/gi, "")
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "未命名任务";
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\[\]【】()（）{}<>《》.,，。:：;；!_\-—\s]+/g, "")
    .trim();

const matchStrm = (
  record: LixianHistoryRecord,
  files: OneStrmStrmFile[]
): OneStrmStrmFile | undefined => {
  const target = normalizeText(displayName(record));
  if (target.length < 2) return undefined;

  const probes = [
    target,
    target.slice(0, Math.min(12, target.length)),
    target.slice(0, Math.min(8, target.length)),
  ].filter((item) => item.length >= 4);

  for (const file of files) {
    const path = normalizeText(file.path);
    const name = normalizeText(file.fileName);
    if (probes.some((probe) => path.includes(probe) || name.includes(probe))) {
      return file;
    }
  }
  return undefined;
};

const history = computed<LocalHistoryRecord[]>(() =>
  rawHistory.value.map((record) => ({
    ...record,
    strm: matchStrm(record, strmStatus.value?.recentFiles || []),
  }))
);

const loadStrmStatus = async () => {
  strmLoading.value = true;
  strmError.value = "";
  try {
    strmStatus.value = await oneStrmApi.getStatus();
  } catch (e) {
    strmError.value = e instanceof Error ? e.message : "获取 OneStrm STRM 状态失败";
  } finally {
    strmLoading.value = false;
  }
};

const loadTasks = async () => {
  loading.value = true;
  error.value = "";
  try {
    rawHistory.value = await cloud115QrcodeApi.getLixianHistory();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取本站提交记录失败";
  } finally {
    loading.value = false;
  }
  await loadStrmStatus();
};

const openRename = (record: LocalHistoryRecord) => {
  renameRecordId.value = record.id;
  renameValue.value = record.renameTo || displayName(record);
  renameDialogVisible.value = true;
};

const confirmRename = async () => {
  const value = renameValue.value.trim();
  if (!value) {
    showToast("名称不能为空");
    return;
  }
  if (/[\\/]/.test(value)) {
    showToast("名称不能包含斜杠");
    return;
  }
  try {
    await cloud115QrcodeApi.renameLixianTask(renameRecordId.value, value);
    showToast("重命名成功");
    await loadTasks();
  } catch (e) {
    showToast(e instanceof Error ? e.message : "重命名失败");
  }
};

const retry = async (recordId: string) => {
  try {
    await cloud115QrcodeApi.retryLixianTask(recordId);
    showToast("已重新提交离线任务");
    await loadTasks();
  } catch (e) {
    showToast(e instanceof Error ? e.message : "重试失败");
  }
};

onMounted(loadTasks);
</script>

<style lang="scss" scoped>
.lixian-page {
  min-height: 100vh;
  padding: var(--spacing-base);
  padding-bottom: 90px;
  background: var(--theme-background);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-base);

  .title {
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-color);
  }

  .subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: var(--theme-text-secondary);
  }
}

.strm-card {
  margin-bottom: var(--spacing-base);
  padding: 12px;
  border-radius: 12px;
  background: var(--theme-card-background, #fff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.strm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--theme-text-primary);
}

.strm-summary,
.strm-line,
.strm-file-meta {
  color: var(--theme-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.strm-error {
  color: #ee0a24;
  font-size: 12px;
  line-height: 1.6;
}

.strm-empty {
  padding: 8px 0;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.strm-file {
  padding: 6px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.strm-file-name {
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-meta {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--theme-text-secondary);
}

.record-error {
  color: #ee0a24;
  word-break: break-all;
}

.record-strm {
  margin-top: 2px;
}

.record-strm-path {
  overflow: hidden;
  color: #67c23a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-url {
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  width: 110px;
}
</style>
