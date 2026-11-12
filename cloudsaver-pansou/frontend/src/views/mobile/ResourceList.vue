<template>
  <div ref="listRef" class="resource-list">
    <!-- 搜索中：骨架屏 -->
    <div v-if="resourceStore.loading" class="resource-list__skeleton" aria-busy="true">
      <p class="skeleton__hint">
        <van-loading size="14px" />
        {{
          resourceStore.keyword ? `正在搜索「${resourceStore.keyword}」` : "正在加载"
        }}，会顺带检查 115 链接是否有效
      </p>
      <div v-for="n in 4" :key="n" class="skeleton__card">
        <span class="sk sk--cover" />
        <div class="skeleton__body">
          <span class="sk sk--pill" />
          <span class="sk sk--line" />
          <span class="sk sk--line sk--short" />
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!resourceStore.resources.length" class="resource-list__empty">
      <div class="empty__icon"><van-icon name="search" /></div>
      <h2 class="empty__title">
        {{ resourceStore.keyword ? `没有找到「${resourceStore.keyword}」` : "搜索影视资源" }}
      </h2>
      <p class="empty__desc">
        {{
          resourceStore.keyword
            ? "换个关键词试试，比如去掉年份、季数，只留片名。"
            : "在顶部输入片名搜索 115 网盘和磁力资源，也可以粘贴分享链接直接解析。"
        }}
      </p>
      <div v-if="resourceStore.recentKeywords.length" class="empty__recent">
        <div class="recent__head">
          <span>最近搜索</span>
          <span class="recent__clear" @click="resourceStore.clearRecentKeywords()">清空</span>
        </div>
        <div class="recent__list">
          <span
            v-for="word in resourceStore.recentKeywords"
            :key="word"
            class="chip"
            @click="resourceStore.searchResources(word)"
          >
            {{ word }}
          </span>
        </div>
      </div>
      <span class="empty__refresh" @click="refreshResources">刷新频道最新资源</span>
    </div>

    <template v-else>
      <!-- 结果概览 -->
      <div class="resource-list__summary">
        <template v-if="resourceStore.keyword">
          <span class="summary__title">「{{ resourceStore.keyword }}」</span>
          <span class="summary__meta">
            {{ resourceStore.resources.length }} 个来源 · 共 {{ totalCount }} 条
          </span>
        </template>
        <template v-else>
          <span class="summary__title">最新资源</span>
          <span v-if="resourceStore.lastUpdateTime" class="summary__meta">
            更新于 {{ resourceStore.lastUpdateTime }}
          </span>
          <van-icon name="replay" class="summary__refresh" @click="refreshResources" />
        </template>
      </div>

      <!-- 资源列表 -->
      <van-tabs
        v-model:active="currentTab"
        swipeable
        animated
        shrink
        class="resource-list__tabs"
        :border="false"
      >
        <van-tab v-for="item in resourceStore.resources" :key="item.id" :name="item.id">
          <template #title>
            <span class="tab-title">{{ item.channelInfo.name }}</span>
            <span class="tab-count">{{ item.list.length }}</span>
          </template>
          <ResourceCard
            :current-channel-id="currentTab"
            @save="handleSave"
            @jump="handleJump"
            @search-moviefor-tag="searchMovieforTag"
            @lixian="handleLixian"
          />
        </van-tab>
      </van-tabs>
    </template>

    <!-- 115 离线下载：选择保存目录 -->
    <van-popup
      v-model:show="lixianDialogVisible"
      round
      closeable
      position="bottom"
      :style="{ height: '80%', transform: 'translateZ(1px)' }"
      class="save-popup"
    >
      <div class="save-popup__container">
        <div class="save-popup__header">
          <van-tag color="#ff976a" round size="medium">magnet</van-tag>
          <span class="header__title">115离线 · 选择目录</span>
        </div>
        <div class="save-popup__content">
          <van-field
            v-model="lixianNewName"
            label="保存名称"
            placeholder="可修改广告文件名"
            clearable
          />
          <folder-select
            v-if="lixianDialogVisible"
            cloud-type="pan115"
            @select="handleLixianFolderSelect"
            @close="lixianDialogVisible = false"
          />
        </div>
        <div class="save-popup__footer">
          <van-cell class="footer__path" :border="false">
            <template #title>
              <div class="path__label">保存至：</div>
            </template>
            <template #value>
              <div class="path__value">
                <van-icon name="folder-o" class="value__icon" />
                <span
                  class="value__text"
                  :class="{ 'value__text--placeholder': !lixianFolderPath }"
                >
                  {{
                    lixianFolderPath
                      ? lixianFolderPath[lixianFolderPath.length - 1]?.name
                      : "待选择（或点下方根目录）"
                  }}
                </span>
              </div>
            </template>
          </van-cell>
          <div style="display: flex; gap: 8px">
            <van-button
              round
              block
              type="warning"
              plain
              size="large"
              :loading="lixianSubmitting"
              @click="submitLixian('0')"
            >
              根目录
            </van-button>
            <van-button
              round
              block
              type="warning"
              size="large"
              :loading="lixianSubmitting"
              :disabled="!lixianFolderId"
              @click="submitLixian()"
            >
              保存到此
            </van-button>
          </div>
        </div>
      </div>
    </van-popup>

    <!-- 保存弹窗 -->
    <van-popup
      v-model:show="saveDialogVisible"
      round
      closeable
      position="bottom"
      :style="{ height: '80%', transform: 'translateZ(1px)' }"
      class="save-popup"
    >
      <div class="save-popup__container">
        <!-- 弹窗头部 -->
        <div class="save-popup__header">
          <van-tag :color="getTagColor(currentResource?.cloudType)" round size="medium">
            {{ currentResource?.cloudType }}
          </van-tag>
          <span class="header__title">{{ saveDialogMap[saveDialogStep].title }}</span>
          <span
            v-if="resourceStore.shareInfo.fileSize && saveDialogStep === 1"
            class="header__size"
          >
            {{ formattedFileSize(resourceStore.shareInfo.fileSize) }}
          </span>
        </div>

        <!-- 弹窗内容 -->
        <div class="save-popup__content">
          <van-empty v-if="resourceStore.loadTree && saveDialogStep === 1" class="content__loading">
            <template #image>
              <van-loading size="24px" vertical>加载中...</van-loading>
            </template>
          </van-empty>

          <resource-select
            v-if="saveDialogVisible && saveDialogStep === 1 && resourceStore.resourceSelect.length"
            :cloud-type="currentResource?.cloudType"
          />

          <van-field
            v-if="saveDialogVisible && saveDialogStep === 2"
            v-model="saveNewName"
            label="保存名称"
            placeholder="可修改广告文件名"
            clearable
          />
          <folder-select
            v-if="saveDialogVisible && saveDialogStep === 2 && currentResource"
            :cloud-type="currentResource.cloudType"
            @select="handleFolderSelect"
            @close="saveDialogVisible = false"
          />
        </div>

        <!-- 弹窗底部 -->
        <div class="save-popup__footer">
          <van-cell class="footer__path" :border="false">
            <template #title>
              <div class="path__label">保存至：</div>
            </template>
            <template #value>
              <div class="path__value">
                <van-icon name="folder-o" class="value__icon" />
                <span
                  class="value__text"
                  :class="{ 'value__text--placeholder': !currentFolderPath }"
                >
                  {{ getCurrentFolderName }}
                </span>
              </div>
            </template>
          </van-cell>

          <van-button
            round
            block
            type="primary"
            size="large"
            :loading="isLoading"
            @click="handleConfirmClick"
          >
            {{ saveDialogMap[saveDialogStep].buttonText }}
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { showToast } from "vant";
import { useResourceStore } from "@/stores/resource";
import { formattedFileSize, throttle } from "@/utils/index";
import type { Folder, ResourceItem } from "@/types";
import FolderSelect from "@/components/mobile/FolderSelect.vue";
import ResourceSelect from "@/components/mobile/ResourceSelect.vue";
import ResourceCard from "@/components/mobile/ResourceCard.vue";
import { add115Lixian } from "@/utils/magnet";

// 状态管理
const router = useRouter();
const resourceStore = useResourceStore();

// 响应式数据
const saveDialogVisible = ref(false);
const currentResource = ref<ResourceItem | null>(null);
const currentFolderId = ref<string | null>(null);
const saveNewName = ref("");
const currentFolderPath = ref<Folder[] | null>(null);
const saveDialogStep = ref<1 | 2>(1);
const currentTab = ref<string>("");
const isLoading = ref(false);
const listRef = ref<HTMLElement | null>(null);

// 115 离线下载选目录
const lixianDialogVisible = ref(false);
const lixianResource = ref<ResourceItem | null>(null);
const lixianFolderId = ref<string | null>(null);
const lixianFolderPath = ref<Folder[] | null>(null);
const lixianSubmitting = ref(false);
const lixianNewName = ref("");

// 计算属性
const getCurrentFolderName = computed(() => {
  return currentFolderPath.value
    ? currentFolderPath.value[currentFolderPath.value.length - 1]?.name
    : "待选择";
});

const totalCount = computed(() =>
  resourceStore.resources.reduce((sum, group) => sum + group.list.length, 0)
);

// 常量定义
const saveDialogMap = {
  1: { title: "选择资源", buttonText: "下一步" },
  2: { title: "选择保存目录", buttonText: "保存" },
};

// 标签颜色映射
const getTagColor = (type?: string) => {
  const colorMap: Record<string, string> = {
    pan115: "#07c160",
    quark: "#1989fa",
    magnet: "#ff976a",
    ed2k: "#7232dd",
  };
  return colorMap[type || ""] || "#ff976a";
};

// 监听器
watch(
  () => resourceStore.resources,
  () => {
    if (resourceStore.resources.length > 0) {
      currentTab.value = resourceStore.resources[0].id;
    }
  }
);

// 方法定义
const refreshResources = () => {
  resourceStore.searchResources("", false);
};

const handleSave = async (resource: ResourceItem) => {
  currentResource.value = resource;
  saveDialogVisible.value = true;
  saveDialogStep.value = 1;

  if (!(await resourceStore.getResourceListAndSelect(resource))) {
    saveDialogVisible.value = false;
  }
};

const handleJump = (resource: ResourceItem) => {
  const link =
    resource.cloudLinks?.find((l) => !/^magnet:/i.test(l)) ||
    resource.cloudLinks?.[0] ||
    resource.magnet?.[0];
  if (!link) {
    showToast("没有可跳转的链接");
    return;
  }
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
    showToast("没有可下载的磁力链");
    return;
  }
  lixianResource.value = resource;
  lixianFolderId.value = null;
  lixianFolderPath.value = null;
  lixianNewName.value = resource.title || "";
  lixianDialogVisible.value = true;
};

const handleLixianFolderSelect = (folders: Folder[] | null) => {
  lixianFolderPath.value = folders;
  lixianFolderId.value = folders?.[folders.length - 1]?.cid || "0";
};

/** 提交 115 离线任务 */
const submitLixian = async (cid?: string) => {
  if (!lixianResource.value) return;
  const magnet = resourceStore.extractMagnets(lixianResource.value)[0];
  if (!magnet) {
    showToast("没有可下载的磁力链");
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
      lixianFolderPath.value = null;
      lixianNewName.value = "";
    }
  } finally {
    lixianSubmitting.value = false;
  }
};

const handleFolderSelect = (folders: Folder[] | null) => {
  if (!currentResource.value) return;
  currentFolderPath.value = folders;
  currentFolderId.value = folders?.[folders.length - 1]?.cid || "0";
};

const handleConfirmClick = async () => {
  if (saveDialogStep.value === 1) {
    if (!resourceStore.resourceSelect.some((x) => x.isChecked)) {
      showToast("请选择要保存的资源");
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

const searchMovieforTag = (tag: string) => {
  router.push({ path: "/resource", query: { keyword: tag } });
};

// 使用节流包装加载更多函数
const throttledLoadMore = throttle((channelId: string) => {
  resourceStore.searchResources("", true, channelId);
}, 2000);

// 滚动加载
const doScroll = () => {
  const appElement = document.querySelector("#app") as HTMLElement;
  if (appElement) {
    const { scrollHeight, scrollTop, clientHeight } = appElement;
    if (scrollHeight - (clientHeight + scrollTop) <= 1) {
      throttledLoadMore(currentTab.value);
    }
  }
};

// 生命周期
onMounted(() => {
  const appElement = document.querySelector("#app");
  if (appElement) {
    appElement.addEventListener("scroll", doScroll);
  }
});

onUnmounted(() => {
  const appElement = document.querySelector("#app");
  if (appElement) {
    appElement.removeEventListener("scroll", doScroll);
  }
});

// 监听标签页切换
watch(currentTab, () => {
  const appElement = document.querySelector("#app");
  if (appElement) {
    appElement.scrollTo(0, 0);
  }
});
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
.resource-list {
  min-height: 100%;
  background: var(--surface);
  padding-bottom: 20px;

  &__summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
    padding: 12px 16px 4px;

    .summary__title {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .summary__meta {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .summary__refresh {
      margin-left: auto;
      padding: 4px;
      font-size: 18px;
      color: var(--primary-500);
    }
  }

  &__tabs {
    :deep(.van-tabs__wrap) {
      background: var(--surface);
    }

    :deep(.van-tab) {
      padding: 0 12px;
      font-size: 14px;
    }

    :deep(.van-tabs__line) {
      background: var(--primary-500);
    }

    :deep(.van-tabs__content) {
      padding: 8px 0;
    }

    .tab-title {
      display: inline-block;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
    }

    .tab-count {
      display: inline-block;
      margin-left: 4px;
      padding: 0 6px;
      border-radius: 8px;
      background: var(--grey-200);
      color: var(--text-secondary);
      font-size: 11px;
      line-height: 16px;
      vertical-align: middle;
    }

    :deep(.van-tab--active .tab-count) {
      background: var(--primary-50);
      color: var(--primary-700);
    }
  }

  &__skeleton {
    padding: 12px;

    .skeleton__hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 4px 12px;
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .skeleton__card {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
      padding: 12px;
      background: var(--surface-raised);
      border-radius: 12px;
    }

    .skeleton__body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
      padding-top: 2px;
    }

    .sk {
      display: block;
      border-radius: 6px;
      background: linear-gradient(
        90deg,
        var(--grey-100) 25%,
        var(--grey-200) 37%,
        var(--grey-100) 63%
      );
      background-size: 400% 100%;
      animation: m-shimmer 1.4s ease infinite;

      &--cover {
        flex: none;
        width: 72px;
        height: 100px;
        border-radius: 8px;
      }

      &--pill {
        width: 80px;
        height: 18px;
        border-radius: 9px;
      }

      &--line {
        width: 92%;
        height: 14px;
      }

      &--short {
        width: 60%;
      }
    }
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 56px 24px 24px;
    text-align: center;

    .empty__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      margin-bottom: 14px;
      border-radius: 50%;
      background: var(--primary-100);
      color: var(--primary-500);
      font-size: 26px;
    }

    .empty__title {
      margin: 0 0 6px;
      font-size: 19px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .empty__desc {
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-tertiary);
    }

    .empty__recent {
      width: 100%;
      margin-top: 24px;
      padding: 14px;
      text-align: left;
      background: var(--surface-raised);
      border-radius: 12px;
      box-sizing: border-box;
    }

    .recent__head {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .recent__clear {
      font-size: 12px;
      font-weight: 400;
      color: var(--text-tertiary);
    }

    .recent__list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      padding: 5px 12px;
      border-radius: 15px;
      background: var(--grey-100);
      color: var(--text-secondary);
      font-size: 13px;
    }

    .empty__refresh {
      margin-top: 20px;
      font-size: 13px;
      color: var(--primary-600);
    }
  }
}

@keyframes m-shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.save-popup {
  &__container {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding-bottom: calc(env(safe-area-inset-bottom) + 50px);
  }

  &__header {
    flex-shrink: 0;
    padding: 16px;
    border-bottom: 0.5px solid var(--van-gray-3);
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 40px;

    .header__title {
      font-size: 16px;
      font-weight: 500;
    }

    .header__size {
      margin-left: auto;
      font-size: 13px;
      color: var(--van-gray-6);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    background: var(--van-background-2);

    .content__loading {
      padding: 32px 0;
    }
  }

  &__footer {
    flex-shrink: 0;
    padding: 12px 16px 16px;
    background: var(--theme-other_background);
    border-top: 0.5px solid var(--van-gray-3);
    padding-bottom: calc(16px + env(safe-area-inset-bottom));

    .footer__path {
      margin: 0 0 12px;

      :deep(.van-cell__title) {
        flex: none;
        padding-right: 8px;
        display: flex;
        align-items: center;
      }

      :deep(.van-cell__value) {
        flex: 1;
      }

      .path__label {
        font-size: 14px;
        color: var(--van-text-color);
        font-weight: 500;
        white-space: nowrap;
      }

      .path__value {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: var(--van-gray-1);
        border-radius: 4px;
        width: 100%;
        box-sizing: border-box;

        .value__icon {
          font-size: 16px;
          color: var(--theme-theme);
          flex-shrink: 0;
        }

        .value__text {
          font-size: 14px;
          color: var(--van-text-color);
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: left;
          display: block;

          &--placeholder {
            color: var(--van-gray-6);
          }
        }
      }
    }

    :deep(.van-cell__value) {
      flex: 1;
      text-align: left;
    }

    .van-button {
      height: 44px;
      font-size: 16px;
      font-weight: 500;
    }
  }

  :deep(.van-popup) {
    z-index: 2001 !important;
  }
}

// 全局样式优化
:deep(.van-cell) {
  padding: 16px 20px;

  &::after {
    display: none;
  }
}

:deep(.van-popup) {
  max-height: 90vh;
}

:deep(.van-overlay) {
  background-color: rgba(0, 0, 0, 0.7);
}
</style>
