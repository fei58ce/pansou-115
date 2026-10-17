<template>
  <div class="lixian-page">
    <div class="page-header">
      <div>
        <div class="title">115 离线任务</div>
        <div class="subtitle">查看提交后的下载状态</div>
      </div>
      <van-button size="small" :loading="loading" @click="loadTasks">刷新</van-button>
    </div>

    <van-notice-bar v-if="error" type="danger" :text="error" />
    <van-empty v-if="!loading && tasks.length === 0" description="暂无离线任务" />

    <van-cell-group v-else inset>
      <van-cell v-for="task in tasks" :key="task.hash" :title="task.name || '未命名任务'" :label="task.addTime">
        <template #value>
          <div class="task-value">
            <van-tag :type="statusType(task.status)">{{ task.statusText }}</van-tag>
            <van-progress :percentage="Math.round(task.percent || 0)" :show-pivot="false" />
          </div>
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { cloud115QrcodeApi, type LixianTask } from "@/api/cloud115Qrcode";
import { onMounted, ref } from "vue";

const tasks = ref<LixianTask[]>([]);
const loading = ref(false);
const error = ref("");

const statusType = (status: number): "success" | "warning" | "danger" | "primary" => {
  if (status === 2) return "success";
  if (status === 3) return "danger";
  if (status === 1 || status === 5) return "warning";
  return "primary";
};

const loadTasks = async () => {
  loading.value = true;
  error.value = "";
  try {
    tasks.value = await cloud115QrcodeApi.getLixianTasks();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "获取离线任务失败";
  } finally {
    loading.value = false;
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

.task-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  width: 110px;
}
</style>
