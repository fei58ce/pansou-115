<template>
  <div class="lixian-page">
    <div class="page-header">
      <div>
        <div class="title">115 离线任务</div>
        <div class="subtitle">仅显示本站提交记录</div>
      </div>
      <van-button size="small" :loading="loading" @click="loadTasks">刷新</van-button>
    </div>

    <van-notice-bar v-if="error" type="danger" :text="error" />
    <van-empty v-if="!loading && history.length === 0" description="暂无本站提交记录" />

    <van-cell-group v-else inset>
      <van-cell v-for="record in history" :key="record.id" :title="record.name || '未命名任务'">
        <template #label>
          <div class="record-meta">
            <div>{{ formatTime(record.createdAt) }}</div>
            <div v-if="record.lastError" class="record-error">{{ record.lastError }}</div>
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
          </div>
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { cloud115QrcodeApi, type LixianHistoryRecord } from "@/api/cloud115Qrcode";
import { onMounted, ref } from "vue";
import { showToast } from "vant";

const history = ref<LixianHistoryRecord[]>([]);
const loading = ref(false);
const error = ref("");

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

const loadTasks = async () => {
  loading.value = true;
  error.value = "";
  try {
    history.value = await cloud115QrcodeApi.getLixianHistory();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取本站提交记录失败";
  } finally {
    loading.value = false;
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
