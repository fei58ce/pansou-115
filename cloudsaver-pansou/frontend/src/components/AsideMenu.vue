<template>
  <div class="pc-aside">
    <!-- Logo 区域 -->
    <div class="pc-aside__logo">
      <img :src="mascotLogo" alt="" class="logo__image moe-animate--breathe" />
      <span class="logo__title">{{ PROJECT_NAME }}</span>
    </div>

    <!-- 菜单区域 -->
    <el-menu
      :default-active="currentMenu?.index || '1'"
      :default-openeds="currentMenuOpen"
      class="pc-aside__menu"
    >
      <template v-for="menu in menuList" :key="menu.index">
        <!-- 子菜单 -->
        <el-sub-menu v-if="menu.children" :index="menu.index">
          <template #title>
            <img :src="menu.icon" alt="" class="menu-icon" />
            <span>{{ menu.title }}</span>
          </template>

          <el-menu-item
            v-for="child in menu.children"
            :key="child.index"
            :index="child.index"
            @click="handleMenuClick(child)"
          >
            <span>{{ child.title }}</span>
          </el-menu-item>
        </el-sub-menu>

        <!-- 普通菜单项 -->
        <el-menu-item
          v-else
          :index="menu.index"
          :disabled="menu.disabled"
          @click="handleMenuClick(menu)"
        >
          <img :src="menu.icon" alt="" class="menu-icon" />
          <span>{{ menu.title }}</span>
        </el-menu-item>
      </template>
    </el-menu>

    <img :src="mascotSidebar" alt="" class="pc-aside__mascot moe-animate--float" />

    <!-- GitHub 链接 -->
    <div class="pc-aside__footer">
      <a :href="PROJECT_GITHUB" target="_blank" rel="noopener noreferrer" class="github-link">
        <svg height="16" aria-hidden="true" viewBox="0 0 24 24" version="1.1" width="16">
          <path
            fill="currentColor"
            d="M12.5.75C6.146.75 1 5.896 1 12.25c0 5.089 3.292 9.387 7.863 10.91.575.101.79-.244.79-.546 0-.273-.014-1.178-.014-2.142-2.889.532-3.636-.704-3.866-1.35-.13-.331-.69-1.352-1.18-1.625-.402-.216-.977-.748-.014-.762.906-.014 1.553.834 1.769 1.179 1.035 1.74 2.688 1.25 3.349.948.1-.747.402-1.25.733-1.538-2.559-.287-5.232-1.279-5.232-5.678 0-1.25.445-2.285 1.178-3.09-.115-.288-.517-1.467.115-3.048 0 0 .963-.302 3.163 1.179.92-.259 1.897-.388 2.875-.388.977 0 1.955.13 2.875.388 2.2-1.495 3.162-1.179 3.162-1.179.633 1.581.23 2.76.115 3.048.733.805 1.179 1.825 1.179 3.09 0 4.413-2.688 5.39-5.247 5.678.417.36.776 1.05.776 2.128 0 1.538-.014 2.774-.014 3.162 0 .302.216.662.79.547C20.709 21.637 24 17.324 24 12.25 24 5.896 18.854.75 12.5.75Z"
          />
        </svg>
        <span>GitHub</span>
        <span class="version">v{{ pkg.version }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import mascotLogo from "@/assets/moe/mascot-logo.webp";
import mascotSidebar from "@/assets/moe/mascot-sidebar.webp";
import iconBell from "@/assets/moe/icon-bell.webp";
import iconSearch from "@/assets/moe/icon-search.webp";
import iconClapper from "@/assets/moe/icon-clapper.webp";
import iconStar from "@/assets/moe/icon-star.webp";
import iconCloudBox from "@/assets/moe/icon-cloud-box.webp";
import iconGear from "@/assets/moe/icon-gear.webp";
import { PROJECT_GITHUB, PROJECT_NAME } from "@/constants/project";
import pkg from "../../package.json";

// 类型定义
interface MenuItem {
  index: string;
  title: string;
  icon?: string;
  router?: string;
  children?: MenuItem[];
  disabled?: boolean;
}

// 路由相关
const router = useRouter();
const route = useRoute();

// 菜单配置
const menuList: MenuItem[] = [
  { index: "subscriptions", title: "我的追更", icon: iconBell, router: "/subscriptions" },
  {
    index: "1",
    title: "资源搜索",
    icon: iconSearch,
    router: "/resource",
  },
  {
    index: "2",
    title: "豆瓣榜单",
    icon: iconClapper,
    children: [
      {
        index: "2-1",
        title: "热门电影",
        router: "/douban?type=movie",
      },
      {
        index: "2-2",
        title: "热门电视剧",
        router: "/douban?type=tv",
      },
      {
        index: "2-3",
        title: "最新电影",
        router: "/douban?type=movie&tag=最新",
      },
      {
        index: "2-4",
        title: "热门综艺",
        router: "/douban?type=tv&tag=综艺",
      },
    ],
  },
  {
    index: "3",
    title: "TMDB榜单",
    icon: iconStar,
    router: "/tmdb",
  },
  {
    index: "4",
    title: "115离线任务",
    icon: iconCloudBox,
    router: "/lixian",
  },
  {
    index: "5",
    title: "设置",
    icon: iconGear,
    router: "/setting",
    disabled: false,
  },
];

const flatMenus = menuList.flatMap((menu) => menu.children || [menu]);

// 按路径匹配，带参数的菜单要求参数也一致，取匹配参数最多的那项；搜索词、分享链接等额外参数不影响高亮
const currentMenu = computed(() => {
  let best: MenuItem | undefined;
  let bestScore = -1;
  for (const menu of flatMenus) {
    if (!menu.router) continue;
    const target = new URL(menu.router, "http://local");
    if (target.pathname !== route.path) continue;
    const params = [...target.searchParams.entries()];
    const matched = params.every(([key, value]) => route.query[key] === value);
    const score = matched ? params.length : best ? -1 : 0;
    if (score > bestScore) {
      best = menu;
      bestScore = score;
    }
  }
  return best;
});

// 计算当前展开的子菜单
const currentMenuOpen = computed(() => {
  if (currentMenu.value?.index.includes("-")) {
    return [currentMenu.value.index.split("-")[0]];
  }
  return [];
});

// 菜单点击处理
const handleMenuClick = (menu: MenuItem) => {
  if (menu.router) {
    router.push(menu.router);
  }
};
</script>

<style lang="scss" scoped>
.pc-aside {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface);
  border-right: 1px solid var(--border);

  &__logo {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 64px;
    padding: 0 var(--space-4);
    flex: none;

    .logo__image {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }

    .logo__title {
      font-size: var(--text-md);
      font-weight: var(--weight-bold);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  &__menu {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-2) var(--space-3);
    border-right: none;
    background: transparent;
    --el-menu-item-height: 42px;
    --el-menu-sub-item-height: 38px;
    --el-menu-base-level-padding: 14px;
    --el-menu-level-padding: 16px;
    --el-menu-text-color: var(--text-primary);
    --el-menu-hover-text-color: var(--text-primary);
    --el-menu-hover-bg-color: var(--pink-50);
    --el-menu-active-color: var(--text-primary);

    :deep(.el-menu-item),
    :deep(.el-sub-menu__title) {
      margin: 2px 0;
      border-radius: var(--radius-sketch-sm);
      font-size: var(--text-base);
    }

    :deep(.el-menu-item.is-active) {
      background: var(--pink-100);
      font-weight: var(--weight-bold);
    }

    // 子菜单里有选中项时，父级标题也铺一层浅粉
    :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
      background: var(--pink-50);
      font-weight: var(--weight-bold);
    }

    :deep(.el-menu--inline) {
      background: transparent;
    }

    :deep(.el-menu--inline .el-menu-item) {
      padding-left: 46px !important;
    }

    :deep(.el-sub-menu__icon-arrow) {
      color: var(--line);
    }

    .menu-icon {
      flex: none;
      width: 22px;
      height: 22px;
      margin-right: var(--space-3);
    }
  }

  &__mascot {
    flex: none;
    display: block;
    width: 176px;
    margin: 0 auto var(--space-2);
    pointer-events: none;
    user-select: none;
  }

  // 窗口矮的时候把位置让给菜单
  @media (max-height: 760px) {
    &__mascot {
      display: none;
    }
  }

  &__footer {
    flex: none;
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border);

    .github-link {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      color: var(--text-tertiary);
      font-size: var(--text-sm);
      text-decoration: none;
      border-radius: var(--radius-sm);
      transition: var(--theme-transition);

      .version {
        margin-left: auto;
        font-size: var(--text-xs);
        color: var(--text-disabled);
      }

      &:hover {
        color: var(--text-primary);
        background: var(--grey-100);
      }
    }
  }
}
</style>
