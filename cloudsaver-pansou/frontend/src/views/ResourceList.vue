<template>
  <div class="pc-resources">
    <!-- 结果概览和视图切换 -->
    <div v-if="hasResults && !resourceStore.loading" class="pc-resources__toolbar">
      <div class="toolbar__summary">
        <template v-if="resourceStore.keyword">
          <h2 class="summary__title">「{{ resourceStore.keyword }}」的搜索结果</h2>
          <span class="summary__meta">
            {{ resourceStore.resources.length }} 个来源 · 共 {{ totalCount }} 条
          </span>
        </template>
        <template v-else>
          <h2 class="summary__title">最新资源</h2>
          <span v-if="resourceStore.lastUpdateTime" class="summary__meta">
            更新于 {{ resourceStore.lastUpdateTime }}
          </span>
          <el-button text size="small" :icon="Refresh" @click="refreshResources">刷新</el-button>
        </template>
      </div>

      <div class="toolbar__actions">
        <el-tooltip
          effect="dark"
          :content="
            userStore.imagesSource === 'proxy'
              ? '海报经服务器代理加载，点击改为直连'
              : '海报直连加载，点击改为经服务器代理'
          "
          placement="bottom"
        >
          <el-button text size="small" :icon="Picture" @click="toggleImagesSource">
            海报：{{ userStore.imagesSource === "proxy" ? "代理" : "直连" }}
          </el-button>
        </el-tooltip>
        <div class="segmented" role="group" aria-label="显示方式">
          <button
            type="button"
            :class="{ 'is-active': userStore.displayStyle === 'card' }"
            @click="setDisplayStyle('card')"
          >
            卡片
          </button>
          <button
            type="button"
            :class="{ 'is-active': userStore.displayStyle === 'table' }"
            @click="setDisplayStyle('table')"
          >
            列表
          </button>
        </div>
      </div>
    </div>

    <!-- 资源列表（返回顶部按钮绑定在这个滚动容器上，容器要一直在） -->
    <div id="pc-resources-content" class="pc-resources__content">
      <!-- 搜索中：骨架屏 -->
      <div v-if="resourceStore.loading" class="pc-resources__skeleton" aria-busy="true">
        <p class="skeleton__hint">
          <el-icon class="is-loading"><Loading /></el-icon>
          {{
            resourceStore.keyword ? `正在搜索「${resourceStore.keyword}」` : "正在加载"
          }}，会顺带检查 115 链接是否有效，最长约半分钟
        </p>
        <div class="skeleton__grid">
          <div v-for="n in 6" :key="n" class="skeleton__card">
            <span class="sk sk--cover" />
            <div class="skeleton__body">
              <span class="sk sk--pill" />
              <span class="sk sk--line" />
              <span class="sk sk--line sk--short" />
              <span class="sk sk--line sk--tiny" />
            </div>
          </div>
        </div>
      </div>

      <component
        :is="userStore.displayStyle === 'table' ? ResourceTable : ResourceCard"
        v-else-if="hasResults"
        @load-more="handleLoadMore"
        @jump="handleJump"
        @search-moviefor-tag="searchMovieforTag"
        @save="handleSave"
        @lixian="handleLixian"
      />

      <!-- 空状态 -->
      <div v-else class="pc-resources__empty">
        <div class="empty__icon">
          <el-icon><Search /></el-icon>
        </div>
        <h2 class="empty__title">
          {{
            resourceStore.keyword ? `没有找到「${resourceStore.keyword}」的资源` : "搜索影视资源"
          }}
        </h2>
        <p class="empty__desc">
          {{
            resourceStore.keyword
              ? "换个关键词试试，比如去掉年份、季数，只留片名。"
              : "在上方输入片名回车，搜索 115 网盘和磁力资源；粘贴 115 / 夸克分享链接可以直接解析转存。"
          }}
        </p>

        <div v-if="resourceStore.recentKeywords.length" class="empty__recent">
          <div class="recent__head">
            <span>最近搜索</span>
            <button type="button" class="link-btn" @click="resourceStore.clearRecentKeywords()">
              清空
            </button>
          </div>
          <div class="recent__list">
            <button
              v-for="word in resourceStore.recentKeywords"
              :key="word"
              type="button"
              class="chip"
              @click="searchKeyword(word)"
            >
              {{ word }}
            </button>
          </div>
        </div>

        <div class="empty__actions">
          <el-button @click="router.push('/douban?type=movie')">逛逛豆瓣热门</el-button>
          <el-button text @click="refreshResources">刷新频道最新资源</el-button>
        </div>
      </div>
    </div>

    <!-- 返回顶部 -->
    <el-backtop :bottom="40" :right="40" target=".pc-resources__content">
      <div class="pc-resources__backtop">
        <el-icon><ArrowUp /></el-icon>
      </div>
    </el-backtop>

    <!-- 保存对话框 -->
    <el-dialog
      v-if="currentResource"
      v-model="saveDialogVisible"
      :title="saveDialogMap[saveDialogStep].title"
      width="580px"
      destroy-on-close
    >
      <template #header="{ titleId }">
        <div class="dialog-header">
          <h3 :id="titleId">
            <div class="title-main">
              <el-tag
                :type="resourceStore.tagColor[currentResource.cloudType as keyof TagColor]"
                effect="light"
                round
              >
                {{ cloudTypeLabel(currentResource.cloudType) }}
              </el-tag>
              {{ saveDialogMap[saveDialogStep].title }}
            </div>
            <div class="title-sub">
              <span class="resource-title" :title="currentResource.title">
                {{ currentResource.title }}
              </span>
              <span
                v-if="resourceStore.shareInfo.fileSize && saveDialogStep === 1"
                class="file-size"
              >
                ({{ formattedFileSize(resourceStore.shareInfo.fileSize) }})
              </span>
            </div>
          </h3>
        </div>
      </template>

      <div v-loading="resourceStore.loadTree">
        <resource-select
          v-if="saveDialogVisible && saveDialogStep === 1 && resourceStore.resourceSelect.length"
          :cloud-type="currentResource.cloudType"
        />
        <div v-if="saveDialogVisible && saveDialogStep === 2" class="rename-field">
          <label>保存名称（可修改广告名）</label>
          <el-input v-model="saveNewName" placeholder="留空则使用原文件名" clearable />
        </div>
        <folder-select
          v-if="saveDialogVisible && saveDialogStep === 2"
          :cloud-type="currentResource.cloudType"
          @select="handleFolderSelect"
          @close="saveDialogVisible = false"
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="saveDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleConfirmClick">
            {{ saveDialogMap[saveDialogStep].buttonText }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 115 离线下载：选择保存目录 -->
    <el-dialog
      v-model="lixianDialogVisible"
      title="115 离线下载 · 选择保存目录"
      width="580px"
      destroy-on-close
    >
      <div v-if="lixianResource" class="dialog-header" style="margin-bottom: 12px">
        <div class="title-sub">
          <span class="resource-title" :title="lixianResource.title">{{
            lixianResource.title
          }}</span>
        </div>
        <div class="file-size" style="font-size: 12px; word-break: break-all; margin-top: 4px">
          {{ resourceStore.extractMagnets(lixianResource)[0]?.slice(0, 80) }}...
        </div>
      </div>
      <div class="rename-field">
        <label>保存名称（可修改广告名）</label>
        <el-input
          v-model="lixianNewName"
          placeholder="留空则使用原文件名，完成后也可再改"
          clearable
        />
      </div>
      <folder-select
        v-if="lixianDialogVisible"
        cloud-type="pan115"
        @select="handleLixianFolderSelect"
        @close="lixianDialogVisible = false"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="lixianDialogVisible = false">取消</el-button>
          <el-button type="warning" plain :loading="lixianSubmitting" @click="submitLixian('0')">
            保存到根目录
          </el-button>
          <el-button
            type="warning"
            :disabled="!lixianFolderId"
            :loading="lixianSubmitting"
            @click="submitLixian()"
          >
            保存到此目录
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useResourceStore } from "@/stores/resource";
import { useUserSettingStore } from "@/stores/userSetting";
import FolderSelect from "@/components/Home/FolderSelect.vue";
import ResourceSelect from "@/components/Home/ResourceSelect.vue";
import ResourceTable from "@/components/Home/ResourceTable.vue";
import { formattedFileSize } from "@/utils/index";
import type { ResourceItem, TagColor } from "@/types";
import { onMounted, onBeforeUnmount } from "vue";
import ResourceCard from "@/components/Home/ResourceCard.vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowUp, Loading, Picture, Refresh, Search } from "@element-plus/icons-vue";
import { add115Lixian } from "@/utils/magnet";
import { cloudTypeLabel, primaryLink } from "@/utils/resource";
const router = useRouter();

const resourceStore = useResourceStore();
const userStore = useUserSettingStore();
const saveDialogVisible = ref(false);
const currentResource = ref<ResourceItem | null>(null);
const currentFolderId = ref<string | null>(null);
const saveNewName = ref("");
const saveDialogStep = ref<1 | 2>(1);

// 115 离线下载选目录
const lixianDialogVisible = ref(false);
const lixianResource = ref<ResourceItem | null>(null);
const lixianFolderId = ref<string | null>(null);
const lixianSubmitting = ref(false);
const lixianNewName = ref("");

const hasResults = computed(() => resourceStore.resources.length > 0);
const totalCount = computed(() =>
  resourceStore.resources.reduce((sum, group) => sum + group.list.length, 0)
);

const refreshResources = async () => {
  resourceStore.searchResources("", false);
};

const searchKeyword = (word: string) => {
  resourceStore.searchResources(word);
};

const toggleImagesSource = () => {
  userStore.setImagesSource(userStore.imagesSource === "proxy" ? "local" : "proxy");
};

const saveDialogMap = {
  1: {
    title: "选择资源",
    buttonText: "下一步",
  },
  2: {
    title: "选择保存目录",
    buttonText: "保存到此目录",
  },
};

const handleSave = async (resource: ResourceItem) => {
  currentResource.value = resource;
  saveDialogVisible.value = true;
  saveDialogStep.value = 1;
  if (!(await resourceStore.getResourceListAndSelect(currentResource.value))) {
    saveDialogVisible.value = false;
  }
};

const handleFolderSelect = async (folderId: string) => {
  if (!currentResource.value) return;
  currentFolderId.value = folderId;
};

const handleConfirmClick = async () => {
  if (saveDialogStep.value === 1) {
    const selectedFiles = resourceStore.resourceSelect.filter((x) => x.isChecked);
    if (selectedFiles.length === 0) {
      ElMessage.warning("请选择要保存的资源");
      return;
    }
    const selected = resourceStore.resourceSelect.find((x) => x.isChecked);
    saveNewName.value = selected?.fileName || currentResource.value?.title || "";
    saveDialogStep.value = 2;
  } else {
    handleSaveBtnClick();
  }
};

const handleSaveBtnClick = async () => {
  if (!currentResource.value || !currentFolderId.value) return;
  saveDialogVisible.value = false;
  await resourceStore.saveResource(currentResource.value, currentFolderId.value, saveNewName.value);
};
const setDisplayStyle = (style: string) => {
  userStore.setDisplayStyle(style as "card" | "table");
};
// 添加加载更多处理函数
const handleLoadMore = (channelId: string) => {
  resourceStore.searchResources("", true, channelId);
};

const handleJump = (resource: ResourceItem) => {
  const link = primaryLink(resource);
  if (!link) {
    ElMessage.warning("没有可跳转的链接");
    return;
  }
  // 磁力链交给系统默认客户端处理
  if (/^magnet:/i.test(link)) {
    window.location.href = link;
    return;
  }
  window.open(link, "_blank");
};

/** 打开 115 离线下载选目录弹窗 */
const handleLixian = (resource: ResourceItem) => {
  const magnet = resourceStore.extractMagnets(resource)[0];
  if (!magnet) {
    ElMessage.warning("没有可下载的磁力链");
    return;
  }
  lixianResource.value = resource;
  lixianFolderId.value = null;
  lixianNewName.value = resource.title || "";
  lixianDialogVisible.value = true;
};

const handleLixianFolderSelect = (folderId: string) => {
  lixianFolderId.value = folderId;
};

/** 提交 115 离线任务；cid 不传则用已选目录 */
const submitLixian = async (cid?: string) => {
  if (!lixianResource.value) return;
  const magnet = resourceStore.extractMagnets(lixianResource.value)[0];
  if (!magnet) {
    ElMessage.warning("没有可下载的磁力链");
    return;
  }
  const targetCid = cid ?? lixianFolderId.value ?? "0";
  lixianSubmitting.value = true;
  try {
    const ok = await add115Lixian(magnet, targetCid, lixianNewName.value);
    if (ok) {
      lixianDialogVisible.value = false;
      lixianResource.value = null;
      lixianFolderId.value = null;
      lixianNewName.value = "";
    }
  } finally {
    lixianSubmitting.value = false;
  }
};

const searchMovieforTag = (tag: string) => {
  router.push({ path: "/resource", query: { keyword: tag } });
};
// 页面进入 设置缓存的数据源；从别的页面发起的搜索已经在进行或已有结果时不覆盖
onMounted(() => {
  if (resourceStore.loading || resourceStore.keyword) return;
  const lastResourceList = localStorage.getItem("last_resource_list");
  if (lastResourceList) {
    resourceStore.resources = JSON.parse(lastResourceList).list;
  }
});

// 页面销毁 清除搜索词
onBeforeUnmount(() => {
  resourceStore.keyword = "";
});
</script>

<style lang="scss" scoped>
.pc-resources {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex: none;
    margin-bottom: var(--space-4);

    .toolbar__summary {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: var(--space-2) var(--space-3);
      min-width: 0;
    }

    .summary__title {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      color: var(--text-primary);
      line-height: var(--leading-tight);
    }

    .summary__meta {
      color: var(--text-tertiary);
      font-size: var(--text-sm);
    }

    .toolbar__actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex: none;
    }
  }

  &__content {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  &__backtop {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--primary-600);
    background: var(--surface-raised);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-3);

    .el-icon {
      font-size: 18px;
    }
  }
}

// 卡片 / 列表切换
.segmented {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--radius);
  background: var(--grey-200);

  button {
    height: 28px;
    padding: 0 var(--space-3);
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--theme-transition);

    &.is-active {
      background: var(--surface-raised);
      color: var(--text-primary);
      font-weight: var(--weight-medium);
      box-shadow: var(--shadow-1);
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
  }
}

// 骨架屏
.pc-resources__skeleton {
  .skeleton__hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }

  .skeleton__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: var(--space-4);
  }

  .skeleton__card {
    display: flex;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }

  .skeleton__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
    padding-top: var(--space-1);
  }

  .sk {
    display: block;
    border-radius: var(--radius-sm);
    background: linear-gradient(
      90deg,
      var(--grey-100) 25%,
      var(--grey-200) 37%,
      var(--grey-100) 63%
    );
    background-size: 400% 100%;
    animation: shimmer 1.4s ease infinite;

    &--cover {
      flex: none;
      width: 96px;
      height: 136px;
      border-radius: var(--radius);
    }

    &--pill {
      width: 96px;
      height: 20px;
      border-radius: var(--radius-full);
    }

    &--line {
      width: 92%;
      height: 16px;
    }

    &--short {
      width: 64%;
    }

    &--tiny {
      width: 40%;
      margin-top: auto;
    }
  }
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

// 空状态
.pc-resources__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 560px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4) var(--space-6);
  text-align: center;

  .empty__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    margin-bottom: var(--space-4);
    border-radius: var(--radius-full);
    background: var(--primary-100);
    color: var(--primary-500);
    font-size: 28px;
  }

  .empty__title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-2xl);
    font-weight: var(--weight-bold);
    color: var(--text-primary);
    line-height: var(--leading-tight);
  }

  .empty__desc {
    margin: 0;
    text-wrap: balance;
    color: var(--text-tertiary);
    font-size: var(--text-base);
    line-height: var(--leading-normal);
  }

  .empty__recent {
    width: 100%;
    margin-top: var(--space-6);
    padding: var(--space-4);
    text-align: left;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);

    .recent__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
    }

    .recent__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  }

  .empty__actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-5);

    .el-button {
      margin: 0;
    }
  }
}

.chip {
  height: 30px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--grey-50);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: var(--theme-transition);

  &:hover {
    border-color: var(--primary-200);
    background: var(--primary-50);
    color: var(--primary-700);
  }
}

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: var(--text-xs);
  cursor: pointer;

  &:hover {
    color: var(--red-500);
  }
}

// 对话框样式
.dialog-header {
  h3 {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    font-weight: var(--weight-bold);
    color: var(--text-primary);

    .title-main {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-md);
    }

    .title-sub {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-base);
      color: var(--text-tertiary);
      font-weight: normal;
    }
  }

  .resource-title {
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    color: var(--text-tertiary);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);

  .el-button {
    margin: 0;
  }
}

:deep(.el-dialog) {
  border-radius: var(--radius-lg);
  overflow: hidden;

  .el-dialog__header {
    margin: 0;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border);
  }

  .el-dialog__body {
    padding: var(--space-5);
  }

  .el-dialog__footer {
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border);
  }
}

.rename-field {
  margin-bottom: var(--space-3);

  label {
    display: block;
    margin-bottom: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }
}
</style>
