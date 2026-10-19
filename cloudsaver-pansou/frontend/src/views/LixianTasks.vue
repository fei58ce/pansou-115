<template>
  <div class="lixian-page">
    <div class="page-header">
      <div>
        <h2>115 离线任务</h2>
        <p>仅显示本站提交的离线下载记录，支持失败重试</p>
      </div>
      <el-button :loading="loading" @click="loadTasks">刷新</el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

    <el-card v-loading="loading" class="task-card">
      <template #header>
        <div class="card-header">
          <span>本站提交记录</span>
          <span class="record-count">共 {{ history.length }} 条</span>
        </div>
      </template>

      <el-empty v-if="!loading && history.length === 0" description="暂无本站提交记录" />
      <el-table v-else :data="history" stripe>
        <el-table-column prop="name" label="任务" min-width="280" show-overflow-tooltip>
          <template #default="scope">
            <div class="task-name">{{ scope.row.name || "未命名任务" }}</div>
            <div class="task-url">{{ scope.row.url }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="scope">
            <el-tag :type="statusType(scope.row.status)" size="small">
              {{ scope.row.statusText }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="160">
          <template #default="scope">
            <el-progress :percentage="Math.round(scope.row.percent || 0)" />
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="180">
          <template #default="scope">{{ formatTime(scope.row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="lastError" label="失败原因" min-width="220" show-overflow-tooltip />
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
import { cloud115QrcodeApi, type LixianHistoryRecord } from "@/api/cloud115Qrcode";
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";

const history = ref<LixianHistoryRecord[]>([]);
const loading = ref(false);
const error = ref("");

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
