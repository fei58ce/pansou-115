<template>
  <div class="home">
    <!-- 顶部搜索栏 -->
    <header class="home__header">
      <div class="header__wrapper">
        <van-search
          v-model="searchForm.keyword"
          class="header__search"
          shape="round"
          :left-icon="iconSearch"
          placeholder="搜片名，或粘贴分享链接"
          @search="handleSearch"
        />

        <button type="button" class="header__avatar" aria-label="退出登录" @click="handleLogout">
          <img :src="mascotLogo" alt="" class="moe-animate--breathe" />
        </button>
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
      <van-tabbar-item to="/resource" :icon="iconSearch">搜索</van-tabbar-item>
      <van-tabbar-item to="/douban" :icon="iconClapper">豆瓣</van-tabbar-item>
      <van-tabbar-item to="/tmdb" :icon="iconStar">TMDB</van-tabbar-item>
      <van-tabbar-item to="/subscriptions" :icon="iconBell">追更</van-tabbar-item>
      <van-tabbar-item to="/lixian" :icon="iconCloudBox">离线</van-tabbar-item>
      <van-tabbar-item to="/setting" :icon="iconGear">设置</van-tabbar-item>
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
import mascotLogo from "@/assets/moe/mascot-logo.webp";
import iconSearch from "@/assets/moe/icon-search.webp";
import iconClapper from "@/assets/moe/icon-clapper.webp";
import iconStar from "@/assets/moe/icon-star.webp";
import iconBell from "@/assets/moe/icon-bell.webp";
import iconCloudBox from "@/assets/moe/icon-cloud-box.webp";
import iconGear from "@/assets/moe/icon-gear.webp";

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
    background: var(--surface);
    box-shadow: 0 1px 0 var(--border-strong);

    .header__wrapper {
      display: flex;
      align-items: center;
      padding: 8px 8px 8px 4px;
    }

    .header__search {
      flex: 1;
      padding: 0 4px;
      background: transparent;

      :deep(.van-search__content) {
        background: var(--surface-raised);
        box-shadow: inset 0 0 0 1.5px var(--line);
      }
    }

    .header__avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      box-sizing: border-box;
      width: 36px;
      height: 36px;
      margin-left: 4px;
      padding: 2px;
      border: 1.5px solid var(--line);
      border-radius: 50%;
      background: var(--pink-50);
      cursor: pointer;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      &:active {
        opacity: 0.7;
      }

      &:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring);
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
  border-top: 1px solid var(--border-strong);
}

:deep(.van-tabbar-item) {
  margin: 4px 2px;
  border-radius: var(--radius-sketch-sm);
  color: var(--text-secondary);
}

:deep(.van-tabbar-item--active) {
  background: var(--pink-100);
  color: var(--text-primary);
  font-weight: 600;
}
</style>
