<template>
  <div class="tmdb-page">
    <!-- 筛选器 -->
    <div class="tmdb-filters">
      <el-radio-group v-model="currentType" @change="handleTypeChange">
        <el-radio-button label="trending">趋势</el-radio-button>
        <el-radio-button label="popular">流行</el-radio-button>
        <el-radio-button label="top_rated">高分</el-radio-button>
        <el-radio-button label="now_playing">上映/播出</el-radio-button>
      </el-radio-group>

      <el-radio-group v-model="currentMediaType" @change="handleMediaTypeChange" style="margin-left: 12px">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="movie">电影</el-radio-button>
        <el-radio-button label="tv">电视</el-radio-button>
      </el-radio-group>

      <el-radio-group
        v-if="currentType === 'trending'"
        v-model="currentTimeWindow"
        @change="handleTimeWindowChange"
        style="margin-left: 12px"
      >
        <el-radio-button label="day">今日</el-radio-button>
        <el-radio-button label="week">本周</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 列表 -->
    <div v-loading="tmdbStore.loading" class="tmdb-grid">
      <div
        v-for="item in tmdbStore.list"
        :key="`${item.mediaType}-${item.id}`"
        class="tmdb-card"
        @click="openDetail(item)"
      >
        <div class="tmdb-poster">
          <el-image
            :src="item.poster"
            :alt="item.title"
            fit="cover"
            lazy
            class="tmdb-poster-img"
            hide-on-click-modal
          />
          <div v-if="item.rating > 0" class="tmdb-rating">
            <el-icon><StarFilled /></el-icon>
            {{ item.rating.toFixed(1) }}
          </div>
          <div class="tmdb-type">
            {{ item.mediaType === "movie" ? "电影" : "剧集" }}
          </div>
          <div class="tmdb-poster-hover" @click.stop="searchMovie(item.title)">
            <el-icon class="search_icon" size="28px"><Search /></el-icon>
            <span>搜索资源</span>
          </div>
        </div>
        <div class="tmdb-info">
          <el-link
            class="tmdb-title"
            :href="item.url"
            target="_blank"
            :underline="false"
            :title="item.title"
            @click.stop
          >
            {{ item.title }}
          </el-link>
          <div v-if="item.releaseDate" class="tmdb-date">{{ formatDate(item.releaseDate) }}</div>
        </div>
      </div>
      <el-empty
        v-if="!tmdbStore.loading && tmdbStore.list.length === 0"
        description="暂无数据，请确认后端已配置 TMDB_API_KEY"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useTmdbStore } from "@/stores/tmdb";
import { StarFilled, Search } from "@element-plus/icons-vue";
import type { TmdbItem } from "@/types/tmdb";

const router = useRouter();
const tmdbStore = useTmdbStore();

const currentType = ref(tmdbStore.currentType);
const currentMediaType = ref(tmdbStore.currentMediaType);
const currentTimeWindow = ref(tmdbStore.currentTimeWindow);

onMounted(() => {
  tmdbStore.loadList();
});

watch(currentType, (val) => tmdbStore.loadList(val, undefined, undefined));
watch(currentMediaType, (val) => tmdbStore.loadList(undefined, val, undefined));
watch(currentTimeWindow, (val) => tmdbStore.loadList(undefined, undefined, val));

const handleTypeChange = (val: string | number | boolean | undefined) => {
  if (typeof val === "string") tmdbStore.loadList(val as any);
};
const handleMediaTypeChange = (val: string | number | boolean | undefined) => {
  if (typeof val === "string") tmdbStore.loadList(undefined, val as any, undefined);
};
const handleTimeWindowChange = (val: string | number | boolean | undefined) => {
  if (typeof val === "string") tmdbStore.loadList(undefined, undefined, val as any);
};

const openDetail = (item: TmdbItem) => {
  searchMovie(item.title);
};

const searchMovie = (title: string) => {
  router.push({ path: "/resource", query: { keyword: title } });
};

const formatDate = (date: string) => (date ? date.slice(0, 4) : "");
</script>

<style lang="scss" scoped>
@import "@/styles/common.scss";
@import "@/styles/responsive.scss";

.tmdb-page {
  height: calc(100vh - 180px);
  display: flex;
  flex-direction: column;
}

.tmdb-filters {
  padding: 8px 4px 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.tmdb-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  justify-content: space-between;
  gap: 20px;
  padding: 4px;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    &:hover {
      background: rgba(0, 0, 0, 0.3);
    }
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.tmdb-card {
  width: 200px;
  background: var(--theme-card-bg);
  border-radius: var(--theme-radius);
  box-shadow: var(--theme-shadow);
  box-sizing: border-box;
  padding: 12px;
  cursor: pointer;
  transition: var(--theme-transition);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--theme-shadow-lg);
  }
}

.tmdb-poster {
  width: 100%;
  height: 280px;
  position: relative;
  overflow: hidden;
  border-radius: var(--theme-radius);
  box-sizing: border-box;
}

.tmdb-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tmdb-poster-hover {
  opacity: 0;
  transition: opacity 0.3s ease;
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  color: #fff;
  font-size: 14px;
  backdrop-filter: blur(2px);

  &:hover {
    opacity: 1;
  }
}

.tmdb-poster:hover .tmdb-poster-hover {
  opacity: 1;
}

.tmdb-rating {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fbbf24;
  padding: 2px 8px;
  border-radius: var(--theme-radius-sm);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
}

.tmdb-type {
  position: absolute;
  top: 8px;
  left: 8px;
  background: var(--theme-primary);
  color: white;
  padding: 2px 8px;
  border-radius: var(--theme-radius-sm);
  font-size: 12px;
}

.tmdb-info {
  padding: 10px 0 4px;
}

.tmdb-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-text-primary);
  @include text-ellipsis;
  line-height: 1.3;
}

.tmdb-date {
  margin-top: 4px;
  font-size: 12px;
  color: var(--theme-text-secondary);
}
</style>
