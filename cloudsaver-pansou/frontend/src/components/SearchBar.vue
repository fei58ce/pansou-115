<template>
  <div class="pc-search">
    <img :src="mascotPeek" alt="" class="pc-search__mascot" />
    <!-- 搜索区域 -->
    <div class="pc-search__input">
      <el-input
        v-model="keyword"
        placeholder="输入片名搜索，或粘贴 115 / 夸克分享链接直接解析"
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <img :src="iconSearch" alt="" class="search-icon" />
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
          <img :src="iconPower" alt="" />
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
import mascotPeek from "@/assets/moe/mascot-peek.webp";
import iconSearch from "@/assets/moe/icon-search.webp";
import iconPower from "@/assets/moe/icon-power.webp";
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
  gap: var(--space-3);
  width: 100%;
  height: 100%;

  // 小人扒着的那条线压在顶栏底边上，像从下面探出头来
  &__mascot {
    flex: none;
    align-self: flex-end;
    height: 54px;
    margin-bottom: -1px;
    pointer-events: none;
    user-select: none;
  }

  &__input {
    flex: 1;
    min-width: 0;
    max-width: 760px;

    :deep(.el-input) {
      --el-input-height: 42px;
      font-size: var(--text-base);
    }

    :deep(.el-input__wrapper) {
      padding: 0 var(--space-4);
      border-radius: var(--radius-full) 0 0 var(--radius-full);
      background: var(--surface-raised);
      box-shadow: 0 0 0 var(--line-width) var(--line) inset;
      transition: var(--theme-transition);

      &:hover {
        box-shadow: 0 0 0 var(--line-width) var(--line) inset;
      }

      &.is-focus {
        box-shadow:
          0 0 0 var(--line-width) var(--line) inset,
          var(--focus-ring);
      }
    }

    .search-icon {
      width: 20px;
      height: 20px;
    }

    :deep(.el-input-group__append) {
      padding: 0;
      border-radius: 0 var(--radius-full) var(--radius-full) 0;
      background: var(--primary-500);
      box-shadow: 0 0 0 var(--line-width) var(--line) inset;
      overflow: hidden;

      .el-button {
        height: 42px;
        margin: 0;
        padding: 0 var(--space-6) 0 var(--space-5);
        color: var(--primary-foreground);
        font-weight: var(--weight-bold);
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
      width: 38px;
      height: 38px;
      padding: 0;
      background: var(--surface-raised);
      border: var(--line-width) solid var(--line);
      border-radius: var(--radius-sketch-sm);
      cursor: pointer;
      transition: var(--theme-transition);

      img {
        width: 20px;
        height: 20px;
      }

      &:hover {
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
