<template>
  <div class="lixian-page">
    <div class="page-header">
      <div>
        <h2>115 离线任务</h2>
        <p>查看提交后的下载状态与本站提交记录</p>
      </div>
      <el-button :loading="loading" @click="loadTasks">刷新</el-button>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />

    <el-card v-loading="loading" class="task-card">
      <template #header><span>115 远端任务</span></template>
      <el-empty v-if="!loading && tasks.length === 0" description="暂无离线任务" />
      <el-table v-else :data="tasks" stripe>
        <el-table-column prop="name" label="任务名称" min-width="300" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="scope">
            <el-tag :type="statusType(scope.row.status)" size="small">{{ scope.row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="180">
          <template #default="scope"><el-progress :percentage="Math.round(scope.row.percent || 0)" /></template>
        </el-table-column>
        <el-table-column prop="addTime" label="提交时间" width="190" />
      </el-table>
    </el-card>

    <el-card v-loading="loading" class="task-card history-card">
      <template #header><span>本站提交记录</span></template>
      <el-empty v-if="!loading && history.length === 0" description="暂无提交记录" />
      <el-table v-else :data="history" stripe>
        <el-table-column prop="name" label="任务" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态" width="120">
          <template #default="scope"><el-tag :type="statusType(scope.row.status)" size="small">{{ scope.row.statusText }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="lastError" label="失败原因" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button v-if="scope.row.status === 3" link type="primary" @click="retry(scope.row.id)">重试</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { cloud115QrcodeApi, type LixianTask } from "@/api/cloud115Qrcode";
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";

interface LixianHistoryRecord {
  id: string;
  name: string;
  status: number;
  statusText: string;
  percent: number;
  lastError: string;
}

const tasks = ref<LixianTask[]>([]);
const history = ref<LixianHistoryRecord[]>([]);
const loading = ref(false);
const error = ref("");

const statusType = (status: number): "success" | "warning" | "danger" | "info" => {
  if (status === 2) return "success";
  if (status === 3) return "danger";
  if (status === 1 || status === 5) return "warning";
  return "info";
};

const loadTasks = async () => {
  loading.value = true;
  error.value = "";
  try {
    const [remote, local] = await Promise.all([
      cloud115QrcodeApi.getLixianTasks(),
      cloud115QrcodeApi.getLixianHistory(),
    ]);
    tasks.value = remote;
    history.value = local as LixianHistoryRecord[];
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取离线任务失败";
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
.lixian-page { height: calc(100vh - 180px); overflow-y: auto; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; h2 { margin: 0 0 6px; color: var(--theme-text-primary); } p { margin: 0; color: var(--theme-text-secondary); font-size: 13px; } }
.task-card { margin-bottom: 16px; border-radius: var(--theme-radius); }
</style>
