<template>
  <div class="douban-page">
    <div class="douban-page__header">
      <div>
        <h2 class="header__title">
          {{ currentCategory.label }}<img :src="decoPopcorn" alt="" class="title-deco" />
        </h2>
        <p class="header__desc">点海报直接搜索资源，点片名打开豆瓣页面</p>
      </div>
      <div class="segmented" role="group" aria-label="榜单">
        <button
          v-for="category in DOUBAN_CATEGORIES"
          :key="category.label"
          type="button"
          :class="{ 'is-active': category === currentCategory }"
          @click="switchCategory(category)"
        >
          {{ category.label }}
        </button>
      </div>
    </div>

    <div v-if="doubanStore.loading && !doubanStore.hotList.length" class="movie-wall">
      <div v-for="n in 12" :key="n" class="movie-item">
        <div class="movie-poster sk" />
        <div class="sk sk--line" />
      </div>
    </div>

    <div
      v-else-if="doubanStore.hotList.length"
      class="movie-wall"
      :class="{ 'is-refreshing': doubanStore.loading }"
    >
      <div v-for="movie in doubanStore.hotList" :key="movie.id" class="movie-item">
        <div class="movie-poster" @click="searchMovie(movie.title)">
          <img :src="getProxyImageUrl(movie.cover)" :alt="movie.title" loading="lazy" />
          <span v-if="Number(movie.rate)" class="movie-rate" :class="rateClass(movie.rate)">
            {{ movie.rate }}
          </span>
          <div class="movie-poster-hover">
            <span class="hover__btn">
              <img :src="iconSearch" alt="" class="hover__icon" />
              搜索资源
            </span>
          </div>
        </div>
        <a
          :href="movie.url"
          target="_blank"
          rel="noopener noreferrer"
          class="movie-title"
          :title="movie.title"
        >
          {{ movie.title }}
        </a>
      </div>
    </div>

    <el-empty
      v-else
      :image="sceneEmpty"
      :image-size="300"
      description="豆瓣榜单暂时没取到，稍后刷新试试"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDoubanStore } from "@/stores/douban";
import decoPopcorn from "@/assets/moe/deco-popcorn.webp";
import iconSearch from "@/assets/moe/icon-search.webp";
import sceneEmpty from "@/assets/moe/scene-empty.webp";
import { getProxyImageUrl } from "@/utils/image";
import { DOUBAN_CATEGORIES, findDoubanCategory, type DoubanCategory } from "@/constants/douban";

const router = useRouter();
const route = useRoute();
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
  router.push({ path: "/douban", query: category.query });
};

const rateClass = (rate: string | number) => {
  const value = Number(rate);
  if (value >= 8) return "is-high";
  if (value >= 6) return "is-mid";
  return "is-low";
};

const searchMovie = (title: string) => {
  router.push({ path: "/resource", query: { keyword: title } });
};
</script>

<style lang="scss" scoped>
.douban-page {
  height: 100%;
  overflow-y: auto;

  &__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-bottom: var(--space-5);

    .header__title {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      color: var(--text-primary);
      line-height: var(--leading-tight);

      .title-deco {
        height: 28px;
        margin-left: var(--space-1);
        vertical-align: -5px;
      }
    }

    .header__desc {
      margin: var(--space-1) 0 0;
      color: var(--text-tertiary);
      font-size: var(--text-sm);
    }
  }
}

.segmented {
  display: inline-flex;
  padding: 3px;
  border: var(--line-width) solid var(--line);
  border-radius: var(--radius-sketch-pill);
  background: var(--surface-raised);

  button {
    height: 30px;
    padding: 0 var(--space-4);
    border: none;
    border-radius: var(--radius-sketch-pill);
    background: transparent;
    color: var(--text-secondary);
    font-family: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: var(--theme-transition);

    &.is-active {
      background: var(--pink-100);
      color: var(--text-primary);
      font-weight: var(--weight-bold);
    }

    &:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
  }
}

.movie-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-5) var(--space-4);
  padding-bottom: var(--space-6);
  transition: opacity var(--duration) var(--ease);

  &.is-refreshing {
    opacity: 0.6;
  }
}

.movie-item {
  min-width: 0;
}

.movie-poster {
  position: relative;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border: var(--line-width) solid var(--line-soft);
  border-radius: var(--radius-sketch-sm);
  background: var(--grey-200);
  box-shadow: var(--shadow-1);
  cursor: pointer;
  transition: box-shadow var(--duration) var(--ease);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s var(--ease);
  }

  &:hover {
    box-shadow: var(--shadow-3);

    img {
      transform: scale(1.03);
    }

    .movie-poster-hover {
      opacity: 1;
    }
  }
}

.movie-rate {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  padding: 0 7px;
  border: var(--line-width) solid var(--line);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  line-height: 18px;
  color: var(--text-primary);
  background: var(--grey-100);

  &.is-high {
    color: var(--primary-800);
    background: var(--primary-100);
  }

  &.is-mid {
    color: var(--pink-700);
    background: var(--pink-100);
  }
}

.movie-poster-hover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: var(--space-4);
  background: linear-gradient(to top, hsla(24, 30%, 15%, 0.7), transparent 60%);
  opacity: 0;
  transition: opacity var(--duration) var(--ease);

  .hover__btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 6px var(--space-3);
    border: var(--line-width) solid var(--line);
    border-radius: var(--radius-sketch-pill);
    background: var(--surface-raised);
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
  }

  .hover__icon {
    width: 16px;
    height: 16px;
  }
}

.movie-title {
  display: block;
  margin-top: var(--space-2);
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--primary-600);
  }
}

.sk {
  border-radius: var(--radius);
  background: linear-gradient(90deg, var(--grey-100) 25%, var(--grey-200) 37%, var(--grey-100) 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
  box-shadow: none;

  &--line {
    width: 70%;
    height: 16px;
    margin-top: var(--space-2);
    border-radius: var(--radius-sm);
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
</style>
