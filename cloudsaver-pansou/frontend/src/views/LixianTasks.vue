<template>
  <div class="lixian-page">
    <div class="page-header">
      <div>
        <h2>115 离线任务</h2>
        <p>仅显示本站提交的离线下载记录，并关联 OneStrm STRM 生成状态</p>
      </div>
      <el-button :loading="loading || strmLoading" @click="loadTasks">刷新</el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

    <el-card v-loading="strmLoading" class="task-card strm-card">
      <template #header>
        <div class="card-header">
          <span>OneStrm STRM 状态</span>
          <div class="strm-header-actions">
            <el-tag
              v-if="strmStatus"
              :type="strmStatus.connected ? 'success' : 'info'"
              size="small"
            >
              {{ strmStatus.connected ? "已连接" : "未连接" }}
            </el-tag>
            <el-button size="small" :loading="strmLoading" @click="loadStrmStatus">
              刷新状态
            </el-button>
          </div>
        </div>
      </template>

      <el-alert v-if="strmError" :title="strmError" type="warning" show-icon :closable="false" />
      <template v-else-if="strmStatus">
        <div class="strm-summary">
          <span>{{ strmStatus.message }}</span>
          <span v-if="strmStatus.lastScanAt">最近扫描：{{ strmStatus.lastScanAt }}</span>
          <span v-if="strmStatus.lastTaskResult">{{ strmStatus.lastTaskResult }}</span>
        </div>
        <el-empty
          v-if="strmStatus.recentFiles.length === 0"
          description="暂无 STRM 生成记录"
          :image-size="60"
        />
        <el-table v-else :data="strmStatus.recentFiles" size="small" max-height="260">
          <el-table-column prop="createdAt" label="生成时间" width="170" />
          <el-table-column
            prop="fileName"
            label="STRM 文件"
            min-width="320"
            show-overflow-tooltip
          />
          <el-table-column prop="path" label="路径" min-width="420" show-overflow-tooltip />
        </el-table>
      </template>
    </el-card>

    <el-card v-loading="loading" class="task-card">
      <template #header>
        <div class="card-header">
          <span>本站提交记录</span>
          <span class="record-count">共 {{ history.length }} 条</span>
        </div>
      </template>

      <el-empty v-if="!loading && history.length === 0" description="暂无本站提交记录" />
      <el-table v-else :data="history" stripe>
        <el-table-column prop="name" label="任务" min-width="260" show-overflow-tooltip>
          <template #default="scope">
            <div class="task-name">{{ displayName(scope.row) }}</div>
            <div class="task-url">{{ scope.row.url }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="statusType(scope.row.status)" size="small">
              {{ scope.row.statusText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="STRM" width="110">
          <template #default="scope">
            <el-tooltip v-if="scope.row.strm" :content="scope.row.strm.path" placement="top">
              <el-tag type="success" size="small">已生成</el-tag>
            </el-tooltip>
            <el-tag v-else type="info" size="small">待生成</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="140">
          <template #default="scope">
            <el-progress :percentage="Math.round(scope.row.percent || 0)" />
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="170">
          <template #default="scope">{{ formatTime(scope.row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="lastError" label="失败原因" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 3"
              link
              type="primary"
              @click="retry(scope.row.id)"
            >
              重试
            </el-button>
            <span v-else class="no-action">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
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

const statusType = (status: number): "success" | "warning" | "danger" | "info" => {
  if (status === 2) return "success";
  if (status === 3) return "danger";
  if (status === 1 || status === 5) return "warning";
  return "info";
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

const retry = async (recordId: string) => {
  try {
    await cloud115QrcodeApi.retryLixianTask(recordId);
    ElMessage.success("已重新提交离线任务");
    await loadTasks();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "重试失败");
  }
};

onMounted(loadTasks);
</script>

<style lang="scss" scoped>
@import "@/styles/common.scss";

.lixian-page {
  height: calc(100vh - 180px);
  overflow-y: auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;

  h2 {
    margin: 0 0 6px;
    color: var(--theme-text-primary);
  }

  p {
    margin: 0;
    color: var(--theme-text-secondary);
    font-size: 13px;
  }
}

.task-card {
  margin-bottom: 16px;
  border-radius: var(--theme-radius);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.strm-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strm-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-bottom: 12px;
  color: var(--theme-text-secondary);
  font-size: 12px;
}

.record-count {
  font-size: 12px;
  color: var(--theme-text-secondary);
}

.task-name {
  font-weight: 500;
  color: var(--theme-text-primary);
}

.task-url {
  margin-top: 4px;
  overflow: hidden;
  color: var(--theme-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-action {
  color: var(--theme-text-secondary);
}
</style>
