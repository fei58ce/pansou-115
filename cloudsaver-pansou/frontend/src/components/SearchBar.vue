<template>
  <div class="pc-search">
    <!-- 搜索区域 -->
    <div class="pc-search__input">
      <el-input
        v-model="keyword"
        placeholder="输入片名搜索，或粘贴 115 / 夸克分享链接直接解析"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
        <template #append>
          <el-button :loading="resourcStore.loading" @click="handleSearch">搜索</el-button>
        </template>
      </el-input>
    </div>

    <!-- 用户操作区 -->
    <div class="pc-search__actions">
      <el-tooltip effect="dark" content="退出登录" placement="bottom">
        <button class="logout-btn" type="button" aria-label="退出登录" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
        </button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useResourceStore } from "@/stores/resource";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Search, SwitchButton } from "@element-plus/icons-vue";
import { STORAGE_KEYS } from "@/constants/storage";

// 路由相关
const route = useRoute();
const router = useRouter();
const resourcStore = useResourceStore();

// 响应式数据
const keyword = ref(resourcStore.keyword);
const routeKeyword = computed(() => route.query.keyword as string);

// 退出登录
const handleLogout = () => {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  router.push("/login");
  ElMessage.success("已退出登录");
};

// 搜索处理：先切到搜索页，结果和加载状态都在那里显示
const handleSearch = async () => {
  const searchText = keyword.value.trim();
  if (!searchText) {
    ElMessage.warning("请输入搜索内容");
    return;
  }

  if (route.path !== "/resource") {
    await router.push("/resource");
  }

  // 链接解析处理
  if (searchText.startsWith("http")) {
    await resourcStore.parsingCloudLink(searchText);
    return;
  }

  // 关键词搜索
  await resourcStore.searchResources(searchText);
};

// 监听路由参数变化
watch(
  () => routeKeyword.value,
  (newKeyword) => {
    if (newKeyword) {
      keyword.value = newKeyword;
      handleSearch();
    } else {
      keyword.value = resourcStore.keyword;
    }
  }
);
watch(
  () => resourcStore.keyword,
  (newKeyword) => {
    keyword.value = newKeyword;
  }
);
</script>

<style lang="scss" scoped>
.pc-search {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;

  &__input {
    flex: 1;
    min-width: 0;
    max-width: 760px;

    :deep(.el-input) {
      --el-input-height: 40px;
      font-size: var(--text-base);
    }

    :deep(.el-input__wrapper) {
      padding: 0 var(--space-3);
      border-radius: var(--radius) 0 0 var(--radius);
      background: var(--grey-100);
      box-shadow: 0 0 0 1px transparent inset;
      transition: var(--theme-transition);

      &:hover {
        box-shadow: 0 0 0 1px var(--border-strong) inset;
      }

      &.is-focus {
        background: var(--surface-raised);
        box-shadow:
          0 0 0 1px var(--primary-500) inset,
          var(--focus-ring);
      }
    }

    :deep(.el-input__prefix .el-icon) {
      font-size: 16px;
      color: var(--text-tertiary);
    }

    :deep(.el-input-group__append) {
      padding: 0;
      border-radius: 0 var(--radius) var(--radius) 0;
      background: var(--primary-500);
      box-shadow: none;
      overflow: hidden;

      .el-button {
        height: 40px;
        margin: 0;
        padding: 0 var(--space-5);
        color: #fff;
        font-weight: var(--weight-medium);
        border: none;
        border-radius: 0;
        background: transparent;

        &:hover {
          background: var(--primary-600);
        }
      }
    }
  }

  &__actions {
    margin-left: auto;

    .logout-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      color: var(--text-tertiary);
      background: transparent;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      cursor: pointer;
      transition: var(--theme-transition);

      .el-icon {
        font-size: 16px;
      }

      &:hover {
        color: var(--red-500);
        border-color: var(--red-100);
        background: var(--red-100);
      }

      &:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring);
      }
    }
  }
}
</style>
