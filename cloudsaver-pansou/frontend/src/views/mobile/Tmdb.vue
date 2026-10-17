<template>
  <div class="mobile-page tmdb">
    <!-- 顶部筛选器 -->
    <div class="tmdb__filters">
      <el-radio-group v-model="currentType" size="small" @change="handleTypeChange">
        <el-radio-button label="trending">趋势</el-radio-button>
        <el-radio-button label="popular">流行</el-radio-button>
        <el-radio-button label="top_rated">高分</el-radio-button>
        <el-radio-button label="now_playing">上映</el-radio-button>
      </el-radio-group>
    </div>
    <div class="tmdb__filters">
      <el-radio-group v-model="currentMediaType" size="small" @change="handleMediaTypeChange">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="movie">电影</el-radio-button>
        <el-radio-button label="tv">电视</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 加载状态 -->
    <div v-if="tmdbStore.loading" class="tmdb__loading">
      <van-loading type="spinner" size="24px" vertical>加载中...</van-loading>
    </div>

    <!-- 列表 -->
    <div v-else class="tmdb__grid">
      <div
        v-for="item in tmdbStore.list"
        :key="`${item.mediaType}-${item.id}`"
        class="tmdb__item"
        @click="openDetail(item)"
      >
        <div class="tmdb__poster">
          <van-image :src="item.poster" fit="cover" lazy loading="skeleton" :alt="item.title" />
          <van-tag v-if="item.rating > 0" class="poster__rate" type="warning">
            ⭐ {{ item.rating.toFixed(1) }}
          </van-tag>
          <van-tag class="poster__type" type="primary">
            {{ item.mediaType === "movie" ? "电影" : "剧集" }}
          </van-tag>
        </div>
        <div class="tmdb__info">
          <div class="info__title">{{ item.title }}</div>
          <div v-if="item.releaseDate" class="info__date">{{ formatDate(item.releaseDate) }}</div>
          <div class="info__action">点击搜索资源</div>
        </div>
      </div>
    </div>

    <van-empty
      v-if="!tmdbStore.loading && tmdbStore.list.length === 0"
      description="暂无数据，请确认后端已配置 TMDB_API_KEY"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useTmdbStore } from "@/stores/tmdb";
import type { TmdbItem } from "@/types/tmdb";

const router = useRouter();
const tmdbStore = useTmdbStore();
const currentType = ref(tmdbStore.currentType);
const currentMediaType = ref(tmdbStore.currentMediaType);
const currentTimeWindow = ref(tmdbStore.currentTimeWindow);

tmdbStore.loadList();
watch(currentType, (val) => tmdbStore.loadList(val, undefined, undefined));
watch(currentMediaType, (val) => tmdbStore.loadList(undefined, val, undefined));
watch(currentTimeWindow, (val) => tmdbStore.loadList(undefined, undefined, val));

const handleTypeChange = (val: string | number | boolean | undefined) => {
  if (typeof val === "string") tmdbStore.loadList(val as any);
};
const handleMediaTypeChange = (val: string | number | boolean | undefined) => {
  if (typeof val === "string") tmdbStore.loadList(undefined, val as any, undefined);
};

const openDetail = (item: TmdbItem) => {
  router.push({ path: "/resource", query: { keyword: item.title } });
};

const formatDate = (date: string) => (date ? date.slice(0, 4) : "");
</script>

<style lang="scss" scoped>
@import "@/styles/common.scss";
.tmdb {
  &__filters {
    padding: 8px;
    display: flex;
    align-items: center;
    overflow-x: auto;

    &:deep(.el-radio-button__inner) {
      padding: 8px 12px;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-base);
    padding: 0 var(--spacing-base) var(--spacing-base);
  }

  &__item {
    background: var(--theme-other_background);
    border-radius: var(--border-radius-lg);
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  &__poster {
    position: relative;
    aspect-ratio: 2/3;
    background: #f5f5f5;

    .poster__rate,
    .poster__type {
      position: absolute;
      top: 8px;
      font-size: 12px;
      padding: 2px 6px;
    }
    .poster__rate {
      right: 8px;
    }
    .poster__type {
      left: 8px;
    }
  }

  &__info {
    padding: 6px 8px;

    .info__title {
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      color: var(--theme-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .info__date {
      margin-top: 2px;
      font-size: 12px;
      color: var(--theme-text-secondary);
    }
    .info__action {
      margin-top: 4px;
      font-size: 11px;
      color: var(--theme-theme, #1989fa);
    }
  }

  &__loading {
    padding: 40px 0;
    display: flex;
    justify-content: center;
  }
}
</style>
