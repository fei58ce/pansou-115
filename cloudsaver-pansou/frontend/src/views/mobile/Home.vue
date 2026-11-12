<template>
  <div class="home">
    <!-- 顶部搜索栏 -->
    <header class="home__header">
      <div class="header__wrapper">
        <van-search
          v-model="searchForm.keyword"
          class="header__search"
          shape="round"
          placeholder="搜片名，或粘贴分享链接"
          @search="handleSearch"
        />

        <van-icon name="user-circle-o" class="header__action" @click="handleLogout" />
      </div>
    </header>

    <!-- 主要内容区 -->
    <main class="home__content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- 底部导航栏 -->
    <van-tabbar class="home__tabbar" route>
      <van-tabbar-item to="/resource" icon="search">搜索</van-tabbar-item>
      <van-tabbar-item to="/douban" icon="video-o">豆瓣</van-tabbar-item>
      <van-tabbar-item to="/tmdb" icon="star-o">TMDB</van-tabbar-item>
      <van-tabbar-item to="/subscriptions" icon="bookmark-o">追更</van-tabbar-item>
      <van-tabbar-item to="/lixian" icon="todo-list-o">离线</van-tabbar-item>
      <van-tabbar-item to="/setting" icon="setting-o">设置</van-tabbar-item>
    </van-tabbar>

    <!-- 返回顶部 -->
    <van-back-top right="30px" bottom="100px" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { showConfirmDialog } from "vant";
import { useResourceStore } from "@/stores/resource";
import { useUserSettingStore } from "@/stores/userSetting";

// 接口定义
interface SearchForm {
  keyword: string;
}

// 状态管理
const resourceStore = useResourceStore();
const settingStore = useUserSettingStore();

// 响应式数据
const searchForm = ref<SearchForm>({
  keyword: "",
});

// 路由相关
const router = useRouter();
const route = useRoute();

// 初始化
settingStore.getSettings();

// 监听路由参数
watch(
  () => route.query.keyword as string,
  (keyword) => {
    if (keyword) {
      searchForm.value.keyword = keyword;
      handleSearch();
    } else {
      searchForm.value.keyword = resourceStore.keyword;
    }
  }
);
watch(
  () => resourceStore.keyword,
  (newKeyword) => {
    searchForm.value.keyword = newKeyword;
  }
);

// 方法定义：先切到搜索页，结果和加载状态都在那里显示
const handleSearch = async () => {
  const keyword = searchForm.value.keyword.trim();
  if (!keyword) return;

  if (route.path !== "/resource") {
    await router.push("/resource");
  }

  if (keyword.startsWith("http")) {
    await resourceStore.parsingCloudLink(keyword);
    return;
  }

  await resourceStore.searchResources(keyword);
};

const handleLogout = () => {
  showConfirmDialog({
    title: "退出登录",
    message: "确定要退出登录吗？",
  }).then(() => {
    localStorage.removeItem("token");
    router.push("/login");
  });
};
</script>

<style lang="scss" scoped>
.home {
  min-height: 100vh;
  background: var(--surface);
  display: flex;
  flex-direction: column;

  &__header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--surface-raised);
    box-shadow: 0 1px 0 var(--border);

    .header__wrapper {
      display: flex;
      align-items: center;
      padding: 8px 8px 8px 4px;
    }

    .header__search {
      flex: 1;
      padding: 0 4px;
      background: transparent;
    }

    .header__action {
      padding: 6px;
      color: var(--text-secondary);
      font-size: 24px;
      line-height: 1;

      &:active {
        color: var(--primary-500);
      }
    }
  }

  // 顶部留出搜索栏高度，底部留出 tabbar 和安全区域
  &__content {
    padding-top: 58px;
    padding-bottom: 100px;
    box-sizing: border-box;
    flex: 1;
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

:deep(.van-tabbar) {
  background: var(--surface-raised);
  border-top: 1px solid var(--border);
}

:deep(.van-tabbar-item) {
  color: var(--text-tertiary);
}

:deep(.van-tabbar-item--active) {
  color: var(--primary-500);
}
</style>
