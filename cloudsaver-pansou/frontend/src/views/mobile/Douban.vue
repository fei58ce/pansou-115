<template>
  <div class="mobile-page douban">
    <!-- 榜单切换 -->
    <div class="douban__tabs">
      <span
        v-for="category in DOUBAN_CATEGORIES"
        :key="category.label"
        class="tabs__item"
        :class="{ 'is-active': category === currentCategory }"
        @click="switchCategory(category)"
      >
        {{ category.label }}
      </span>
    </div>
    <p class="douban__hint">点海报搜索资源，点片名打开豆瓣</p>

    <!-- 加载中：骨架屏 -->
    <div v-if="doubanStore.loading && !doubanStore.hotList.length" class="douban__grid">
      <div v-for="n in 9" :key="n" class="douban__item">
        <div class="douban__poster sk" />
        <div class="sk sk--line" />
      </div>
    </div>

    <!-- 电影列表 -->
    <div
      v-else-if="doubanStore.hotList.length"
      class="douban__grid"
      :class="{ 'is-refreshing': doubanStore.loading }"
    >
      <div v-for="movie in doubanStore.hotList" :key="movie.id" class="douban__item">
        <div class="douban__poster" @click="searchMovie(movie.title)">
          <van-image
            class="poster__img"
            :src="getProxyImageUrl(movie.cover)"
            fit="cover"
            lazy-load
            :alt="movie.title"
          />
          <span v-if="Number(movie.rate)" class="poster__rate" :class="rateClass(movie.rate)">
            {{ movie.rate }}
          </span>
          <span class="poster__search"><img :src="iconSearch" alt="" /></span>
        </div>
        <a :href="movie.url" target="_blank" rel="noopener noreferrer" class="douban__title">
          {{ movie.title }}
        </a>
      </div>
    </div>

    <!-- 空状态 -->
    <van-empty v-else description="豆瓣榜单暂时没取到，稍后再试" />
  </div>
</template>

<script setup lang="ts">
import iconSearch from "@/assets/moe/icon-search.webp";
import { computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDoubanStore } from "@/stores/douban";
import { getProxyImageUrl } from "@/utils/image";
import { DOUBAN_CATEGORIES, findDoubanCategory, type DoubanCategory } from "@/constants/douban";

// 路由相关
const router = useRouter();
const route = useRoute();

// 状态管理
const doubanStore = useDoubanStore();

const currentCategory = computed(() =>
  findDoubanCategory(route.query.type as string, route.query.tag as string)
);

// 离开页面（比如点海报去搜索）时路由参数也会变，那时不要再去取榜单
watch(
  currentCategory,
  (category) => {
    if (route.path !== "/douban") return;
    doubanStore.setCurrentParams({ type: category.type, tag: category.tag });
  },
  { immediate: true }
);

const switchCategory = (category: DoubanCategory) => {
  router.replace({ path: "/douban", query: category.query });
};

// 方法定义
const searchMovie = (title: string) => {
  router.push({
    path: "/resource",
    query: { keyword: title },
  });
};

const rateClass = (rate: string | number) => {
  const value = Number(rate);
  if (value >= 8) return "is-high";
  if (value >= 6) return "is-mid";
  return "is-low";
};
</script>

<style lang="scss" scoped>
.douban {
  padding-bottom: 12px;

  &__tabs {
    display: flex;
    gap: 8px;
    padding: 12px 12px 0;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    .tabs__item {
      flex: none;
      padding: 5px 14px;
      border: 1.5px solid var(--line);
      border-radius: var(--radius-sketch-pill);
      background: var(--surface-raised);
      color: var(--text-secondary);
      font-size: 13px;

      &.is-active {
        background: var(--pink-100);
        color: var(--text-primary);
        font-weight: 600;
      }
    }
  }

  &__hint {
    margin: 8px 14px 10px;
    color: var(--text-tertiary);
    font-size: 12px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px 10px;
    padding: 0 12px;
    transition: opacity 0.2s ease;

    &.is-refreshing {
      opacity: 0.6;
    }
  }

  &__item {
    min-width: 0;
  }

  &__poster {
    position: relative;
    aspect-ratio: 2 / 3;
    overflow: hidden;
    border: 1.5px solid var(--line-soft);
    border-radius: var(--radius-sketch-sm);
    background: var(--grey-200);
    box-shadow: var(--shadow-1);

    .poster__img {
      display: block;
      width: 100%;
      height: 100%;
    }

    .poster__rate {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 0 6px;
      border: 1.5px solid var(--line);
      border-radius: var(--radius-full);
      background: var(--grey-100);
      color: var(--text-primary);
      font-size: 11px;
      font-weight: 600;
      line-height: 16px;

      &.is-high {
        background: var(--primary-100);
        color: var(--primary-800);
      }

      &.is-mid {
        background: var(--pink-100);
        color: var(--pink-700);
      }
    }

    .poster__search {
      position: absolute;
      right: 6px;
      bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      box-sizing: border-box;
      border: 1.5px solid var(--line);
      border-radius: 50%;
      background: hsla(40, 60%, 99%, 0.92);

      img {
        width: 14px;
        height: 14px;
      }
    }
  }

  &__title {
    display: block;
    margin-top: 6px;
    overflow: hidden;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.sk {
  background: linear-gradient(90deg, var(--grey-100) 25%, var(--grey-200) 37%, var(--grey-100) 63%);
  background-size: 400% 100%;
  animation: m-shimmer 1.4s ease infinite;
  box-shadow: none;

  &--line {
    width: 70%;
    height: 13px;
    margin-top: 6px;
    border-radius: 4px;
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

:deep(.van-image__img) {
  object-fit: cover;
}
</style>
