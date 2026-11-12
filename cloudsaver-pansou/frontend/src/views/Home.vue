<template>
  <div class="pc-home">
    <!-- 主布局容器 -->
    <el-container class="pc-home__container">
      <!-- 侧边栏 -->
      <el-aside width="232px" class="pc-home__aside">
        <aside-menu />
      </el-aside>

      <!-- 主内容区 -->
      <el-container class="pc-home__main">
        <!-- 顶部搜索栏 -->
        <el-header class="pc-home__header">
          <search-bar />
        </el-header>

        <!-- 内容区域 -->
        <el-main class="pc-home__content">
          <div class="content-wrapper">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useUserSettingStore } from "@/stores/userSetting";
import "element-plus/es/components/loading/style/css";
import AsideMenu from "@/components/AsideMenu.vue";
import SearchBar from "@/components/SearchBar.vue";

const settingStore = useUserSettingStore();

// 初始化设置
onMounted(() => {
  settingStore.getSettings();
});
</script>

<style lang="scss" scoped>
.pc-home {
  position: relative;
  height: 100vh;
  background: var(--surface);
  color: var(--text-primary);

  &__container {
    height: 100%;
  }

  &__aside {
    overflow: hidden;
  }

  &__main {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    padding: 0;
    height: 100%;
    min-width: 0;
  }

  &__header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    height: 64px;
    padding: 0 var(--space-5);
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
  }

  &__content {
    flex: 1;
    height: 0;
    padding: var(--space-5);

    .content-wrapper {
      height: 100%;
    }
  }
}

// 路由过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
